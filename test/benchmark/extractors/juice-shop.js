import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Juice Shop marks the exact vulnerable line of each "coding challenge" with
// `vuln-code-snippet vuln-line <challengeKey...>` comments, and lists each
// challenge's category in data/static/challenges.yml. That is a partial but
// authoritative answer key: it only covers coding challenges, so findings
// elsewhere are "unlabeled", not false positives.

const EXCLUDED_PREFIXES = ['data/static/codefixes/', 'test/', '.ai/', 'node_modules/'];

const CATEGORY_MAP = {
  XSS: 'xss',
  'Broken Access Control': 'authz',
  'Broken Authentication': 'authn',
  'Sensitive Data Exposure': 'info-disclosure',
  'Observability Failures': 'info-disclosure',
  'Security Misconfiguration': 'misconfig',
  'Cryptographic Issues': 'weak-crypto',
  'Insecure Deserialization': 'deserialization',
  'Vulnerable Components': 'supply-chain',
  'Unvalidated Redirects': 'open-redirect',
  XXE: 'xxe',
};

// Challenge-key overrides where the Juice Shop category is too coarse.
const KEY_OVERRIDES = [
  [/^chatbot/i, 'other', false], // LLM prompt injection, not a code-level sink
  [/^noSql/i, 'nosqli', true],
  [/leakedKey/i, 'hardcoded-secret', true],
];

const SAST_DETECTABLE = new Set([
  'sqli', 'nosqli', 'xss', 'code-injection', 'xxe', 'deserialization', 'open-redirect',
  'weak-crypto', 'weak-hash', 'hardcoded-secret', 'path-traversal',
]);

function classify(key, jsCategory) {
  for (const [pattern, category, detectable] of KEY_OVERRIDES) {
    if (pattern.test(key)) return { category, detectable };
  }
  const category = jsCategory === 'Injection' ? 'sqli' : (CATEGORY_MAP[jsCategory] ?? 'other');
  return { category, detectable: SAST_DETECTABLE.has(category) };
}

function parseChallenges(yamlText) {
  const byKey = new Map();
  let current = {};
  for (const line of yamlText.split(/\r?\n/)) {
    if (line.startsWith('-')) current = {};
    const name = line.match(/^\s+name:\s*'?(.+?)'?\s*$/);
    if (name && !current.name) current.name = name[1];
    const category = line.match(/^\s+category:\s*'?(.+?)'?\s*$/);
    if (category) current.category = category[1];
    const key = line.match(/^\s+key:\s*(\w+)/);
    if (key) byKey.set(key[1], { ...current });
  }
  return byKey;
}

export async function extract(checkoutDir) {
  const listing = spawnSync('git', ['-C', checkoutDir, 'ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (listing.status !== 0) throw new Error(`git ls-files failed in ${checkoutDir}: ${listing.stderr}`);
  const files = listing.stdout.split('\n').filter((f) => f && !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)));

  const challenges = parseChallenges(await readFile(path.join(checkoutDir, 'data/static/challenges.yml'), 'utf8'));
  const commit = spawnSync('git', ['-C', checkoutDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

  const grouped = new Map(); // file:line:category -> entry
  for (const file of files) {
    if (/\.(png|jpe?g|gif|ico|svg|woff2?|ttf|pdf|zip|gz|mp4|stl|glb|sqlite)$/i.test(file)) continue;
    let text;
    try {
      text = await readFile(path.join(checkoutDir, file), 'utf8');
    } catch {
      continue; // e.g. path too long on Windows; reported via missing entries
    }
    if (!text.includes('vuln-code-snippet vuln-line')) continue;
    text.split(/\r?\n/).forEach((lineText, idx) => {
      const marker = lineText.match(/vuln-code-snippet vuln-line\s+([\w ]+)/);
      if (!marker) return;
      for (const key of marker[1].trim().split(/\s+/)) {
        const meta = challenges.get(key) ?? {};
        const { category, detectable } = classify(key, meta.category);
        const line = idx + 1;
        const id = `${file}:${line}:${category}`;
        if (!grouped.has(id)) {
          grouped.set(id, {
            id: `js-${grouped.size + 1}-${key}`,
            status: 'vuln',
            file,
            lines: [line, line],
            category,
            cwe: [],
            sast_detectable: detectable,
            title: '',
            challenges: [],
            juice_shop_category: meta.category ?? 'unknown',
          });
        }
        const entry = grouped.get(id);
        entry.challenges.push(key);
        entry.title = `${entry.juice_shop_category}: ${entry.challenges.map((k) => challenges.get(k)?.name ?? k).join(' / ')}`;
      }
    });
  }

  return {
    repo_id: 'juice-shop',
    commit,
    complete: false,
    unmatched_policy: 'unlabeled',
    scope: {
      include: ['**'],
      exclude: ['data/static/codefixes/**', 'test/**', '**/*.spec.ts', 'node_modules/**', '**/*.min.js', 'frontend/src/assets/**', '.ai/**', '.github/**'],
    },
    source: `Generated from 'vuln-code-snippet vuln-line' markers + data/static/challenges.yml at ${commit}. Covers coding challenges only.`,
    entries: [...grouped.values()],
  };
}
