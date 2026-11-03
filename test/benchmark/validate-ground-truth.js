#!/usr/bin/env node
// Checks every ground-truth file against a real checkout: schema problems,
// entries whose file/anchor no longer exists, and (with --show) the actual
// source line each entry points at, so line numbers can be eyeballed.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_CACHE_DIR, loadCatalog } from './lib/config.js';
import { ensureCheckout } from './lib/git.js';
import { loadGroundTruth, resolveEntries } from './lib/ground-truth.js';

const { values } = parseArgs({
  options: {
    repos: { type: 'string' },
    head: { type: 'boolean', default: false },
    show: { type: 'boolean', default: false },
    'cache-dir': { type: 'string', default: DEFAULT_CACHE_DIR },
  },
});

const catalog = await loadCatalog();
const wanted = values.repos?.split(',').map((s) => s.trim());
const repos = catalog.filter((r) => r.ground_truth.type !== 'none' && (!wanted || wanted.includes(r.id)));

let problems = 0;
for (const repo of repos) {
  const checkoutDir = path.join(values['cache-dir'], repo.id);
  let sha = null;
  if (repo.ground_truth.type === 'static' && !values.head) {
    sha = JSON.parse(await readFile(path.resolve(import.meta.dirname, repo.ground_truth.file), 'utf8')).commit;
  }
  process.stdout.write(`\n== ${repo.id} @ ${sha ? sha.slice(0, 10) : 'HEAD'} ... `);
  let gt;
  let entries;
  try {
    const actual = await ensureCheckout(repo.url, checkoutDir, sha);
    console.log(actual.slice(0, 10));
    gt = await loadGroundTruth(repo, checkoutDir);
    entries = await resolveEntries(gt, checkoutDir);
  } catch (err) {
    console.log(`\n  ERROR ${err.message}`);
    problems++;
    continue;
  }

  const counts = { vuln: 0, safe: 0 };
  for (const e of entries) counts[e.status]++;
  console.log(`  ${entries.length} entries (${counts.vuln} vuln, ${counts.safe} safe), complete=${gt.complete}, unmatched=${gt.unmatched_policy}`);

  const fileLines = new Map();
  for (const e of entries) {
    const bad = e.resolution.startsWith('stale');
    const moved = e.resolution.startsWith('relocated');
    if (bad) problems++;
    if (!values.show && !bad && !moved) continue;
    let text = '';
    if (!bad && e.lines) {
      if (!fileLines.has(e.file)) fileLines.set(e.file, (await readFile(path.join(checkoutDir, e.file), 'utf8')).split(/\r?\n/));
      text = fileLines.get(e.file)[e.lines[0] - 1]?.trim() ?? '';
      if (text.length > 110) text = `${text.slice(0, 107)}...`;
    }
    const where = `${e.file}:${e.lines ? e.lines.join('-') : '*'}`;
    console.log(`  ${bad ? 'STALE' : moved ? 'MOVED' : 'ok   '} ${e.status.padEnd(4)} ${e.category.padEnd(16)} ${e.id.padEnd(30)} ${where} [${e.resolution}]${text ? `\n        ${text}` : ''}`);
  }
}

console.log(problems ? `\n${problems} problem(s) found.` : '\nAll ground truth resolved cleanly.');
process.exit(problems ? 1 : 0);
