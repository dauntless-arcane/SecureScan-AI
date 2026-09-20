import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WORKSPACES_ROOT, cloneInto, executeSemgrep, toFinding } from './scanService.js';

/**
 * Verifies one AI-generated remediation by applying it to a fresh, isolated
 * clone of the repository (the original scan workspace is deleted by the
 * time verification runs) and re-running Semgrep. Never touches the
 * original scan workspace or the user's repository.
 *
 * @param {{ repoUrl: string, finding: object, fix: { file_path: string, fixed_code: string } }} input
 */
export async function verifyFix({ repoUrl, finding, fix }) {
  // Defense in depth: aiFixService already rejects a fix targeting any file
  // other than the primary finding's file, but verification re-checks
  // independently since it's the last line of defense before disk writes.
  if (fix.file_path !== finding.file) {
    return {
      error: 'invalid_fix',
      message: `Fix file_path ("${fix.file_path}") does not match the original finding's file ("${finding.file}").`,
    };
  }

  const workspacePath = resolveWorkspacePath(`verify-${randomUUID()}`);

  await mkdir(WORKSPACES_ROOT, { recursive: true });

  try {
    await cloneInto(repoUrl, workspacePath);

    const targetPath = resolveSafeFilePath(workspacePath, fix.file_path);
    if (!targetPath) {
      return {
        error: 'invalid_fix',
        message: `Fix file_path ("${fix.file_path}") would escape the verification workspace.`,
      };
    }

    // Only the AI's primary file is ever written. No dependency/config/
    // package files are touched, and nothing in the workspace is executed —
    // Semgrep (static analysis) is the only thing run against it.
    await writeFile(targetPath, fix.fixed_code, 'utf8');

    const raw = await executeSemgrep(workspacePath);
    const postFixFindings = (raw.results ?? []).map((result) => toFinding(result, workspacePath));

    const remainingFindings = postFixFindings.filter(
      (candidate) => candidate.rule_id === finding.rule_id && candidate.file === finding.file
    );

    const originalFindingSummary = {
      rule_id: finding.rule_id,
      file: finding.file,
      start_line: finding.start_line,
    };

    if (remainingFindings.length === 0) {
      return {
        result: {
          verified: true,
          status: 'VERIFIED',
          original_finding: originalFindingSummary,
          remaining_findings: [],
          message: 'The original Semgrep finding was no longer detected after applying the proposed fix.',
        },
      };
    }

    return {
      result: {
        verified: false,
        status: 'FAILED',
        original_finding: originalFindingSummary,
        remaining_findings: remainingFindings,
        message: 'The original finding is still detected after applying the proposed fix.',
      },
    };
  } catch (err) {
    return {
      error: 'verification_error',
      message: err instanceof Error ? err.message : 'Verification failed.',
    };
  } finally {
    await rm(workspacePath, { recursive: true, force: true }).catch(() => {});
  }
}

/** Builds the verification workspace path and guards it against escaping WORKSPACES_ROOT. */
function resolveWorkspacePath(verificationId) {
  const absRoot = path.resolve(WORKSPACES_ROOT);
  const absPath = path.resolve(absRoot, verificationId);

  if (absPath !== absRoot && !absPath.startsWith(absRoot + path.sep)) {
    throw new Error('Verification workspace path escapes the workspace root.');
  }
  return absPath;
}

/** Resolves the AI's file_path inside the verification workspace, rejecting any path traversal. */
function resolveSafeFilePath(workspacePath, relPath) {
  if (path.isAbsolute(relPath)) return null;

  const absWorkspace = path.resolve(workspacePath);
  const absPath = path.resolve(absWorkspace, relPath);

  if (absPath !== absWorkspace && !absPath.startsWith(absWorkspace + path.sep)) {
    return null; // would escape the verification workspace
  }
  return absPath;
}
