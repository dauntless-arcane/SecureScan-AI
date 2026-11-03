#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createApiClient } from './lib/api-client.js';
import { loadCatalog, parseRunArgs, RUN_HELP, selectRepos } from './lib/config.js';
import { ensureCheckout, remoteHeadSha } from './lib/git.js';
import { BENCHMARK_ROOT, gtMeta, loadGroundTruth, resolveEntries } from './lib/ground-truth.js';
import { analyze, enrichFindings } from './lib/matcher.js';
import { runFixes, selectFindingsForFix } from './lib/fixes.js';
import { buildSummary } from './lib/summary.js';
import { writeReports } from './report.js';

const opts = parseRunArgs(process.argv.slice(2));
if (opts.help) {
  console.log(RUN_HELP);
  process.exit(0);
}

const catalog = await loadCatalog();
if (opts.list) {
  for (const r of catalog) console.log(`${r.tier.padEnd(6)} ${r.id.padEnd(22)} ${r.language.padEnd(11)} gt=${r.ground_truth.type.padEnd(9)} ${r.url}`);
  process.exit(0);
}

const repos = selectRepos(catalog, opts);
const runId = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
const outDir = path.resolve(opts.out ?? path.join(BENCHMARK_ROOT, 'results', runId));
await mkdir(path.join(outDir, 'repos'), { recursive: true });

const api = createApiClient({ baseUrl: opts.api });
try {
  await api.health();
} catch (err) {
  console.error(`Backend not reachable at ${opts.api} (${err.message}).`);
  console.error('Start it first: `docker compose up --build` or `npm run backend:dev`.');
  process.exit(1);
}

const gitOut = (args) => spawnSync('git', args, { cwd: BENCHMARK_ROOT, encoding: 'utf8' }).stdout.trim() || null;
const run = {
  run_id: runId,
  label: opts.label,
  started_at: new Date().toISOString(),
  finished_at: null,
  api: opts.api,
  options: { ...opts, help: undefined, list: undefined },
  securescan_commit: gitOut(['rev-parse', 'HEAD']),
  securescan_dirty: Boolean(gitOut(['status', '--porcelain', '--', ':!test/benchmark/results'])),
  node: process.version,
  repo_ids: repos.map((r) => r.id),
};

console.log(`Run ${runId}: ${repos.length} repo(s) -> ${outDir}`);

const results = new Array(repos.length);
let next = 0;
async function worker() {
  while (next < repos.length) {
    const i = next++;
    results[i] = await processRepo(repos[i]);
    await writeFile(path.join(outDir, 'repos', repos[i].id, 'result.json'), JSON.stringify(results[i], null, 2));
  }
}
await Promise.all(Array.from({ length: Math.min(opts.concurrency, repos.length) }, worker));

run.finished_at = new Date().toISOString();
const summary = buildSummary(run, results);
await writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(path.join(BENCHMARK_ROOT, 'results', 'LATEST'), path.relative(path.join(BENCHMARK_ROOT, 'results'), outDir));
const written = await writeReports(outDir, summary);
console.log(`\nDone. ${summary.repos_ok}/${summary.repos_attempted} repos ok.`);
for (const f of written) console.log(`  ${f}`);

async function processRepo(repo) {
  const log = (msg) => console.log(`[${repo.id}] ${msg}`);
  const repoDir = path.join(outDir, 'repos', repo.id);
  await mkdir(repoDir, { recursive: true });
  const result = { repo, status: 'error', error: null };
  const t0 = Date.now();

  try {
    result.head_sha = await remoteHeadSha(repo.url);
    log(`HEAD ${result.head_sha.slice(0, 10)}; preparing local checkout`);
    const checkoutDir = path.join(opts.cacheDir, repo.id);
    result.checkout_sha = await ensureCheckout(repo.url, checkoutDir, result.head_sha);

    log('submitting scan');
    const submitted = await api.submit(repo.url);
    const { state, timeline } = await api.waitForScan(submitted.scan_id, {
      timeoutMs: opts.scanTimeoutMs,
      onStatus: (s) => log(`status ${s}`),
    });
    result.scan_id = submitted.scan_id;
    result.head_sha_after = await remoteHeadSha(repo.url).catch(() => null);
    const at = (s) => timeline.find((t) => t.status === s)?.at_ms ?? null;
    result.timings = {
      timeline,
      clone_ms: at('SCANNING') != null && at('CLONING') != null ? at('SCANNING') - at('CLONING') : null,
      scan_ms: at('COMPLETED') != null && at('SCANNING') != null ? at('COMPLETED') - at('SCANNING') : null,
    };

    if (state.status === 'FAILED') {
      result.status = 'scan-failed';
      result.error = state.error;
      log(`scan FAILED: ${state.error}`);
      return result;
    }

    const report = await api.report(submitted.scan_id);
    await writeFile(path.join(repoDir, 'scan.json'), JSON.stringify(report, null, 2));
    result.scanner = { name: report.scanner, version: report.semgrep_version, command: report.semgrep_command, errors: report.raw?.errors?.length ?? 0 };

    const gt = await loadGroundTruth(repo, checkoutDir);
    const entries = await resolveEntries(gt, checkoutDir);
    const analysis = analyze({ findings: enrichFindings(report), gt, entries, lineTolerance: opts.lineTolerance });
    result.gt_meta = gtMeta(gt, entries);
    result.metrics = analysis.metrics;
    await writeFile(path.join(repoDir, 'ground-truth.resolved.json'), JSON.stringify({ ...gt, entries }, null, 2));
    log(
      `${analysis.metrics.findings_total} findings; ` +
        (gt.entries.length ? `recall ${pct(analysis.metrics.recall)} (${analysis.metrics.vuln_detected}/${analysis.metrics.vuln_total}), precision ${pct(analysis.metrics.precision)}` : 'no ground truth (scan-only)')
    );

    const selected = selectFindingsForFix(analysis.findings, { max: opts.maxFixes, classes: opts.fixClasses });
    result.fix_records = await runFixes({ api, scanId: submitted.scan_id, selected, checkoutDir, verify: opts.verify, log });
    await writeFile(path.join(repoDir, 'analysis.json'), JSON.stringify(analysis, null, 2));
    await writeFile(path.join(repoDir, 'fixes.json'), JSON.stringify(result.fix_records, null, 2));

    result.status = 'ok';
  } catch (err) {
    result.error = err.message;
    log(`ERROR: ${err.message}`);
  } finally {
    result.timings = { ...result.timings, total_ms: Date.now() - t0 };
  }
  return result;
}

function pct(x) {
  return x == null ? 'n/a' : `${(x * 100).toFixed(1)}%`;
}
