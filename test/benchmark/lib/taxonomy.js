// Vulnerability categories used to decide whether a scanner finding and a
// ground-truth entry describe the *same kind* of issue. Scanners and answer
// keys rarely agree on the exact CWE (e.g. Semgrep tags a Flask
// render_template_string rule as CWE-96 while an answer key says SSTI /
// CWE-1336), so matching happens on these coarser buckets instead.
export const CATEGORY_CWES = Object.freeze({
  sqli: [89, 564],
  nosqli: [943],
  cmdi: [77, 78, 88],
  'code-injection': [94, 95, 96, 470, 913],
  ssti: [1336],
  'file-inclusion': [98, 829],
  xss: [79, 80, 83, 87],
  'path-traversal': [22, 23, 35, 36, 73],
  ssrf: [918],
  xxe: [611, 776, 827],
  xpath: [643, 91],
  ldap: [90],
  deserialization: [502],
  'open-redirect': [601],
  'header-injection': [113, 93],
  'log-injection': [117],
  'weak-crypto': [323, 326, 327, 780],
  'weak-hash': [328, 759, 760, 916],
  'weak-random': [330, 331, 338],
  'hardcoded-secret': [259, 321, 547, 798],
  csrf: [352],
  'insecure-cookie': [315, 539, 614, 1004, 1275],
  'trust-boundary': [501],
  'info-disclosure': [200, 209, 497, 532, 538],
  'debug-mode': [11, 215, 489],
  dos: [400, 674, 770, 1333],
  authn: [256, 257, 287, 306, 307, 384, 521, 522, 565, 613, 620, 640],
  jwt: [345, 347],
  authz: [284, 285, 639, 862, 863],
  'mass-assignment': [915],
  'file-upload': [434],
  'insecure-transport': [295, 297, 311, 319],
  misconfig: [16, 346, 693, 942, 1021],
  'prototype-pollution': [1321],
  'regex-injection': [185, 625],
  'insecure-tempfile': [377, 379],
  'supply-chain': [353, 1104, 1357],
  'sensitive-data': [312, 359],
});

export const CATEGORIES = Object.freeze(Object.keys(CATEGORY_CWES));

// Categories that legitimately overlap. A finding in one counts as the same
// "type" as an entry in a related one (both directions).
const RELATED_GROUPS = [
  ['ssti', 'code-injection', 'xss'],
  ['file-inclusion', 'path-traversal', 'code-injection'],
  ['weak-crypto', 'weak-hash'],
  ['jwt', 'authn', 'hardcoded-secret'],
  ['debug-mode', 'info-disclosure'],
  ['sqli', 'nosqli'],
  ['authn', 'insecure-cookie'],
  ['header-injection', 'open-redirect'],
];

const CWE_TO_CATEGORY = new Map();
for (const [category, cwes] of Object.entries(CATEGORY_CWES)) {
  for (const cwe of cwes) CWE_TO_CATEGORY.set(cwe, category);
}

const RELATED = new Map(CATEGORIES.map((c) => [c, new Set([c])]));
for (const group of RELATED_GROUPS) {
  for (const a of group) for (const b of group) RELATED.get(a).add(b);
}

/** Parses Semgrep-style CWE metadata ("CWE-89: Improper ...", 89, "89") into numbers. */
export function parseCwes(raw) {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out = new Set();
  for (const item of list) {
    if (typeof item === 'number' && Number.isInteger(item)) {
      out.add(item);
      continue;
    }
    if (typeof item !== 'string') continue;
    const match = item.match(/CWE-(\d+)/i) ?? item.match(/^\s*(\d+)\s*$/);
    if (match) out.add(Number(match[1]));
  }
  return [...out];
}

export function categoriesForCwes(cwes) {
  const out = new Set();
  for (const cwe of cwes) {
    const category = CWE_TO_CATEGORY.get(cwe);
    if (category) out.add(category);
  }
  return out.size ? [...out] : ['other'];
}

// Semgrep rule ids carry strong type signals even when CWE metadata is
// missing or generic. Used only as a fallback when CWEs map to "other".
const RULE_ID_HINTS = [
  [/sql|sqli|sequelize-.*injection|knex-.*raw/i, 'sqli'],
  [/nosql|mongo.*(injection|where)/i, 'nosqli'],
  [/command|subprocess|shell|os-system|child-process|exec-?sync|spawn/i, 'cmdi'],
  [/\beval\b|eval-|exec-detected|code-injection|new-function|vm-runin/i, 'code-injection'],
  [/template-string|ssti|render-template-string|jinja2?-.*(autoescape|injection)/i, 'ssti'],
  [/xss|innerhtml|dangerously|unescaped|html-?safe|mark-?safe|direct-response-write|raw-html/i, 'xss'],
  [/path-traversal|path-join|directory-traversal|send-?file|tainted-path|open-.*user-input/i, 'path-traversal'],
  [/ssrf|request-forgery|dynamic-urllib|urllib.*dynamic|tainted-url/i, 'ssrf'],
  [/xxe|defused|xml-?parser|lxml|external-entit/i, 'xxe'],
  [/xpath/i, 'xpath'],
  [/ldap/i, 'ldap'],
  [/pickle|yaml-?load|deserializ|marshal|unserialize|node-serialize/i, 'deserialization'],
  [/open-?redirect|redirect/i, 'open-redirect'],
  [/md5|sha1|weak-hash|insecure-hash/i, 'weak-hash'],
  [/\bdes\b|rc4|ecb|weak-cipher|insecure-cipher|crypto/i, 'weak-crypto'],
  [/random|math-random|pseudo-random/i, 'weak-random'],
  [/jwt/i, 'jwt'],
  [/secret|password|api-?key|token|credential|hardcoded/i, 'hardcoded-secret'],
  [/csrf/i, 'csrf'],
  [/cookie|httponly|samesite/i, 'insecure-cookie'],
  [/debug/i, 'debug-mode'],
  [/redos|regex-dos|regular-expression-dos/i, 'dos'],
  [/cors/i, 'misconfig'],
  [/prototype-pollution/i, 'prototype-pollution'],
  [/github-actions|mutable-action-tag|third-party-action/i, 'supply-chain'],
];

/**
 * Categories for a scanner finding: CWE-derived plus the first rule-id hint.
 * Both are used because rule CWE metadata is sometimes plainly wrong (e.g.
 * flask avoid_hardcoded_config_SECRET_KEY is tagged CWE-489 "debug code").
 */
export function categoriesForFinding({ cwes, ruleId }) {
  const fromCwe = categoriesForCwes(cwes).filter((c) => c !== 'other');
  const lastSegment = ruleId?.split('.').pop() ?? '';
  const hint = RULE_ID_HINTS.find(([pattern]) => pattern.test(lastSegment))?.[1];
  const out = [...new Set([...fromCwe, ...(hint ? [hint] : [])])];
  return out.length ? out : ['other'];
}

/** True when any finding category is the same as, or related to, the entry's category. */
export function categoriesCompatible(findingCategories, entryCategory) {
  const related = RELATED.get(entryCategory);
  if (!related) return findingCategories.includes(entryCategory);
  return findingCategories.some((c) => related.has(c));
}

export function isKnownCategory(category) {
  return RELATED.has(category) || category === 'other';
}
