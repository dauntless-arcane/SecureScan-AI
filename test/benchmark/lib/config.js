import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { BENCHMARK_ROOT } from './ground-truth.js';

export const TIERS = ['smoke', 'core', 'full'];

// Kept outside the repo (and OneDrive) on purpose: OWASP Benchmark alone is
// ~240 MB and would otherwise be synced/indexed.
export const DEFAULT_CACHE_DIR = process.env.BENCHMARK_CACHE_DIR || path.join(os.tmpdir(), 'securescanai-benchmark-cache');

export async function loadCatalog() {
  const catalog = JSON.parse(await readFile(path.join(BENCHMARK_ROOT, 'repos.json'), 'utf8'));
  return catalog.repos;
}

export function selectRepos(catalog, { repos, tier }) {
  if (repos) {
    const wanted = repos.split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = wanted.filter((id) => !catalog.some((r) => r.id === id));
    if (unknown.length) throw new Error(`Unknown repo id(s): ${unknown.join(', ')}. Use --list to see the catalog.`);
    return wanted.map((id) => catalog.find((r) => r.id === id));
  }
  const maxTier = TIERS.indexOf(tier);
  if (maxTier < 0) throw new Error(`--tier must be one of ${TIERS.join(', ')}`);
  return catalog.filter((r) => TIERS.indexOf(r.tier) <= maxTier);
}

export function parseRunArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      api: { type: 'string', default: process.env.SECURESCAN_API || 'http://localhost:4000' },
      repos: { type: 'string' },
      tier: { type: 'string', default: 'smoke' },
      'max-fixes': { type: 'string', default: '3' },
      'fix-classes': { type: 'string', default: 'tp,loose,unlabeled' },
      'no-verify': { type: 'boolean', default: false },
      concurrency: { type: 'string', default: '1' },
      'line-tolerance': { type: 'string', default: '2' },
      'scan-timeout-min': { type: 'string', default: '30' },
      out: { type: 'string' },
      'cache-dir': { type: 'string', default: DEFAULT_CACHE_DIR },
      label: { type: 'string', default: '' },
      list: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  const int = (name, min) => {
    const n = Number(values[name]);
    if (!Number.isInteger(n) || n < min) throw new Error(`--${name} must be an integer >= ${min}`);
    return n;
  };
  const fixClasses = values['fix-classes'].split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = ['tp', 'loose', 'unlabeled', 'fp', 'ignored'];
  const bad = fixClasses.filter((c) => !allowed.includes(c));
  if (bad.length) throw new Error(`--fix-classes: unknown class(es) ${bad.join(', ')}; allowed: ${allowed.join(', ')}`);
  return {
    api: values.api,
    repos: values.repos,
    tier: values.tier,
    maxFixes: int('max-fixes', 0),
    fixClasses,
    verify: !values['no-verify'],
    concurrency: int('concurrency', 1),
    lineTolerance: int('line-tolerance', 0),
    scanTimeoutMs: int('scan-timeout-min', 1) * 60_000,
    out: values.out,
    cacheDir: values['cache-dir'],
    label: values.label,
    list: values.list,
    help: values.help,
  };
}

export const RUN_HELP = `
SecureScanAI benchmark runner

Drives a running SecureScanAI backend against intentionally vulnerable repos,
scores findings against ground truth, samples AI fixes + verification, and
writes results + a report under test/benchmark/results/<timestamp>/.

Usage: node test/benchmark/run.js [options]

  --api <url>              Backend base URL (default $SECURESCAN_API or http://localhost:4000)
  --tier <smoke|core|full> Repo tier to run (default smoke; tiers are cumulative)
  --repos <id,id>          Explicit repo ids (overrides --tier)
  --max-fixes <n>          AI fixes per repo (default 3; 0 = scan + scoring only)
  --fix-classes <list>     Which finding classes may be fixed, in priority order
                           (default tp,loose,unlabeled)
  --no-verify              Generate fixes but skip verification re-scans
  --concurrency <n>        Repos processed in parallel (default 1)
  --line-tolerance <n>     Lines of slack when matching findings to entries (default 2)
  --scan-timeout-min <n>   Per-scan polling timeout in minutes (default 30)
  --out <dir>              Output directory (default results/<timestamp>)
  --cache-dir <dir>        Where harness clones live (default $BENCHMARK_CACHE_DIR or OS temp)
  --label <text>           Free-text label stored with the run (e.g. "baseline semgrep")
  --list                   Print the repo catalog and exit
`;
