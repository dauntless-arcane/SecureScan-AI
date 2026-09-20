import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGithubUrl } from '../utils/validateGithubUrl.js';
import { generateFix } from './aiFixService.js';
import { assembleContext, buildFindingContext } from './contextBuilder.js';
import { verifyFix } from './verificationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACES_ROOT = path.resolve(__dirname, '../../workspaces');
const CLONE_TIMEOUT_MS = 30_000;
const SCAN_TIMEOUT_MS = 180_000;

// Registry rulesets pulled at scan time. No `auto` (it requires metrics
// reporting); metrics stay off so nothing about the scanned code is sent
// to Semgrep's servers, only anonymous rule downloads.
export const SEMGREP_CONFIGS = ['p/security-audit', 'p/secrets', 'p/sql-injection', 'p/flask', 'p/owasp-top-ten'];

export const ScanStatus = Object.freeze({
  QUEUED: 'QUEUED',
  CLONING: 'CLONING',
  CLONED: 'CLONED',
  SCANNING: 'SCANNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

// In-memory job store. Fine for this single-process POC; replace with a
// real store if the backend ever needs to survive a restart or scale out.
const scans = new Map();

export function createScan(repoUrl) {
  const validation = validateGithubUrl(repoUrl);
  if (!validation.valid) {
    return { error: validation.reason };
  }

  const scanId = randomUUID();
  const workspacePath = path.join(WORKSPACES_ROOT, scanId);

  const scan = {
    scanId,
    status: ScanStatus.QUEUED,
    repoUrl: validation.cloneUrl,
    workspacePath,
    error: null,
    semgrepVersion: null,
    semgrepCommand: null,
    semgrepRaw: null,
    findings: [],
    // Remediation context, built from the clone before it's deleted.
    // `fileCache` dedupes file content across findings that share a file;
    // `findingContexts[i]` just points at the paths relevant to findings[i].
    fileCache: new Map(),
    findingContexts: [],
    // AI fix results generated so far, keyed by finding index, so
    // verification can reuse a fix without re-calling OpenRouter.
    fixResults: new Map(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  scans.set(scanId, scan);

  // Defer so the caller observes the initial QUEUED state before it flips to CLONING.
  setImmediate(() => {
    cloneRepository(scan)
      .then(() => runSemgrepScan(scan))
      .catch((err) => {
        markFailed(scan, err instanceof Error ? err.message : 'Unknown error during scan.');
      });
  });

  return { scan: toPublicScan(scan) };
}

export function getScan(scanId) {
  const scan = scans.get(scanId);
  return scan ? toPublicScan(scan) : null;
}

export function getScanReport(scanId) {
  const scan = scans.get(scanId);
  if (!scan) {
    return null;
  }
  return {
    scan_id: scan.scanId,
    repo_url: scan.repoUrl,
    status: scan.status,
    scanner: 'Semgrep',
    semgrep_version: scan.semgrepVersion,
    semgrep_command: scan.semgrepCommand,
    finding_count: scan.findings.length,
    findings: scan.findings,
    raw: scan.semgrepRaw,
  };
}

export async function requestFindingFix(scanId, findingIndex) {
  const scan = scans.get(scanId);
  if (!scan) {
    return { error: 'not_found', message: 'Scan not found.' };
  }

  const finding = scan.findings[findingIndex];
  const pointer = scan.findingContexts[findingIndex];
  if (!finding || !pointer) {
    return { error: 'not_found', message: 'Finding not found for this scan.' };
  }

  try {
    const context = assembleContext(finding, pointer, scan.fileCache);
    const result = await generateFix(context);
    scan.fixResults.set(findingIndex, result);
    return { fix: result };
  } catch (err) {
    return { error: 'ai_error', message: err instanceof Error ? err.message : 'Failed to generate fix.' };
  }
}

export async function verifyFinding(scanId, findingIndex) {
  const scan = scans.get(scanId);
  if (!scan) {
    return { error: 'not_found', message: 'Scan not found.' };
  }

  const finding = scan.findings[findingIndex];
  if (!finding) {
    return { error: 'not_found', message: 'Finding not found for this scan.' };
  }

  const fix = scan.fixResults.get(findingIndex);
  if (!fix) {
    return {
      error: 'fix_not_ready',
      message: 'No AI fix has been generated for this finding yet. Generate a fix before verifying it.',
    };
  }

  const outcome = await verifyFix({ repoUrl: scan.repoUrl, finding, fix });
  if (outcome.error) {
    return { error: outcome.error, message: outcome.message };
  }
  return { result: outcome.result };
}

async function cloneRepository(scan) {
  scan.status = ScanStatus.CLONING;
  scan.updatedAt = new Date().toISOString();

  await mkdir(WORKSPACES_ROOT, { recursive: true });

  try {
    await cloneInto(scan.repoUrl, scan.workspacePath);
  } catch (err) {
    await cleanupWorkspace(scan.workspacePath);
    throw err;
  }

  scan.status = ScanStatus.CLONED;
  scan.updatedAt = new Date().toISOString();
}

// Pure clone helper with no scan-state side effects, so verificationService
// can clone a fresh, isolated copy of the same repository for its own
// short-lived workspace.
export async function cloneInto(repoUrl, destPath) {
  await new Promise((resolve, reject) => {
    const git = spawn('git', ['clone', '--depth', '1', '--single-branch', '--no-tags', '--', repoUrl, destPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      git.kill('SIGKILL');
    }, CLONE_TIMEOUT_MS);

    git.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    git.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start git: ${err.message}`));
    });

    git.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`git clone timed out after ${CLONE_TIMEOUT_MS / 1000}s.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `git clone exited with code ${code}.`));
        return;
      }
      resolve();
    });
  });
}

function buildSemgrepArgs(workspacePath) {
  return [
    'scan',
    ...SEMGREP_CONFIGS.flatMap((config) => ['--config', config]),
    '--json',
    '--quiet',
    '--metrics=off',
    '--no-git-ignore',
    workspacePath,
  ];
}

// Pure Semgrep runner with no scan-state side effects, using the same
// configuration/args as the initial scan, so verificationService re-runs
// the identical scanner rather than a second bespoke configuration.
export async function executeSemgrep(workspacePath) {
  const args = buildSemgrepArgs(workspacePath);

  const { stdout } = await new Promise((resolve, reject) => {
    const semgrep = spawn('semgrep', args, {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      semgrep.kill('SIGKILL');
    }, SCAN_TIMEOUT_MS);

    semgrep.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    semgrep.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    semgrep.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start semgrep: ${err.message}`));
    });

    semgrep.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Semgrep scan timed out after ${SCAN_TIMEOUT_MS / 1000}s.`));
        return;
      }
      // Semgrep exits non-zero for CLI/config errors; a clean scan with
      // findings still exits 0 since we don't pass --error.
      if (code !== 0) {
        reject(new Error(stderr.trim() || `semgrep exited with code ${code}.`));
        return;
      }
      resolve({ stdout });
    });
  });

  return JSON.parse(stdout);
}

async function runSemgrepScan(scan) {
  scan.status = ScanStatus.SCANNING;
  scan.updatedAt = new Date().toISOString();

  scan.semgrepCommand = `semgrep ${buildSemgrepArgs(scan.workspacePath).join(' ')}`;

  const raw = await executeSemgrep(scan.workspacePath);
  scan.semgrepVersion = raw.version ?? null;
  scan.semgrepRaw = raw;
  scan.findings = (raw.results ?? []).map((result) => toFinding(result, scan.workspacePath));

  // Build remediation context (whole file + local deps) for every finding
  // while the clone still exists; nothing below this can touch the clone.
  for (const finding of scan.findings) {
    const pointer = await buildFindingContext(finding, scan.workspacePath, scan.fileCache);
    scan.findingContexts.push(pointer);
  }

  scan.status = ScanStatus.COMPLETED;
  scan.updatedAt = new Date().toISOString();

  // The clone is only needed to scan it and to build remediation context for
  // AI fixes; once both are done there's no reason to keep it on disk.
  await cleanupWorkspace(scan.workspacePath);
}

export function toFinding(result, workspacePath) {
  return {
    rule_id: result.check_id,
    message: result.extra?.message ?? null,
    severity: result.extra?.severity ?? null,
    file: path.relative(workspacePath, result.path).split(path.sep).join('/'),
    start_line: result.start?.line ?? null,
    end_line: result.end?.line ?? null,
  };
}

async function markFailed(scan, message) {
  scan.status = ScanStatus.FAILED;
  scan.error = message;
  scan.updatedAt = new Date().toISOString();
  await cleanupWorkspace(scan.workspacePath);
}

async function cleanupWorkspace(workspacePath) {
  try {
    await rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; nothing further to do if this fails.
  }
}

function toPublicScan(scan) {
  const publicScan = {
    scan_id: scan.scanId,
    status: scan.status,
  };
  if (scan.status === ScanStatus.FAILED) {
    publicScan.error = scan.error;
  }
  if (scan.status === ScanStatus.COMPLETED) {
    publicScan.scanner = 'Semgrep';
    publicScan.finding_count = scan.findings.length;
  }
  return publicScan;
}
