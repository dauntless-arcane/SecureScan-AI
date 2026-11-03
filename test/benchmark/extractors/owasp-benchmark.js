import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// OWASP Benchmark ships expectedresults-<version>.csv:
//   # test name, category, real vulnerability, cwe, ...
//   BenchmarkTest00001,pathtraver,true,22
// One test case per Java file; "false" rows are deliberately safe look-alikes,
// which is what makes a real false-positive rate measurable.

const CATEGORY_MAP = {
  cmdi: 'cmdi',
  crypto: 'weak-crypto',
  hash: 'weak-hash',
  ldapi: 'ldap',
  pathtraver: 'path-traversal',
  securecookie: 'insecure-cookie',
  sqli: 'sqli',
  trustbound: 'trust-boundary',
  weakrand: 'weak-random',
  xpathi: 'xpath',
  xss: 'xss',
};

const TESTCODE_DIR = 'src/main/java/org/owasp/benchmark/testcode';

export async function extract(checkoutDir) {
  const csvName = (await readdir(checkoutDir)).find((f) => /^expectedresults-.*\.csv$/.test(f));
  if (!csvName) throw new Error(`No expectedresults-*.csv in ${checkoutDir}`);
  const csv = await readFile(path.join(checkoutDir, csvName), 'utf8');
  const commit = spawnSync('git', ['-C', checkoutDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

  const entries = [];
  for (const row of csv.split(/\r?\n/)) {
    if (!row || row.startsWith('#')) continue;
    const [name, rawCategory, real, cwe] = row.split(',').map((s) => s.trim());
    const category = CATEGORY_MAP[rawCategory];
    if (!category) throw new Error(`Unmapped Benchmark category "${rawCategory}" (${name})`);
    entries.push({
      id: name,
      status: real === 'true' ? 'vuln' : 'safe',
      file: `${TESTCODE_DIR}/${name}.java`,
      category,
      cwe: [Number(cwe)],
      sast_detectable: true,
      title: `${rawCategory} (${real === 'true' ? 'real' : 'false-positive test'})`,
    });
  }

  return {
    repo_id: 'owasp-benchmark-java',
    commit,
    complete: true,
    // Standard Benchmark scoring: a finding only counts when its category
    // matches the test case's category; anything else in the file is ignored.
    unmatched_policy: 'ignore',
    strict_categories: true,
    scope: { include: [`${TESTCODE_DIR}/**`], exclude: [] },
    source: `Generated from ${csvName} at ${commit}.`,
    entries,
  };
}
