// Line-level edit distance (Myers O(ND)) between the original file and an AI
// fix. Only counts are needed, not the edit script: with insert/delete edits,
// D = added + removed and (newLen - oldLen) = added - removed.
function editDistance(a, b, maxD) {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxD);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return d;
    }
  }
  return null; // exceeds maxD
}

const normalize = (text) => text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');

export function diffStats(original, fixed, { maxD = 20_000 } = {}) {
  const a = normalize(original);
  const b = normalize(fixed);
  const d = editDistance(a, b, maxD);
  if (d == null) {
    return { original_lines: a.length, fixed_lines: b.length, added: null, removed: null, changed_ratio: 1, too_large: true };
  }
  const added = (d + b.length - a.length) / 2;
  const removed = (d - b.length + a.length) / 2;
  return {
    original_lines: a.length,
    fixed_lines: b.length,
    added,
    removed,
    // share of the original file's lines that were removed/rewritten
    changed_ratio: a.length ? removed / a.length : 1,
    too_large: false,
  };
}

/** Heuristic red flags for an AI fix, derived from its diff against the original file. */
export function fixRedFlags(stats, { originalBytes, contextLimitBytes }) {
  const flags = [];
  if (stats.added === 0 && stats.removed === 0) flags.push('no-change');
  if (stats.too_large || (stats.changed_ratio > 0.4 && stats.removed > 20)) flags.push('large-rewrite');
  if (stats.original_lines > 20 && stats.fixed_lines < stats.original_lines * 0.6) flags.push('file-shrunk');
  if (originalBytes > contextLimitBytes) flags.push('context-truncated');
  return flags;
}
