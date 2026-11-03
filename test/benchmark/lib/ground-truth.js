import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isKnownCategory } from './taxonomy.js';

export const BENCHMARK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Ground truth shape (static JSON file or extractor output):
 * {
 *   repo_id, commit,                 // commit the entries were written against
 *   complete: bool,                  // every real issue in scope is listed
 *   unmatched_policy: 'fp' | 'unlabeled' | 'ignore',
 *   scope: { include: [glob], exclude: [glob] },
 *   source: string,
 *   entries: [{ id, status: 'vuln'|'safe', file, lines?: [start, end], category,
 *               cwe?: [int], title, sast_detectable?: bool, anchor?: string, notes? }]
 * }
 */
export async function loadGroundTruth(repo, checkoutDir) {
  const spec = repo.ground_truth;
  let gt;
  if (spec.type === 'static') {
    gt = JSON.parse(await readFile(path.join(BENCHMARK_ROOT, spec.file), 'utf8'));
  } else if (spec.type === 'none') {
    gt = {
      repo_id: repo.id,
      commit: null,
      complete: false,
      unmatched_policy: 'unlabeled',
      scope: { include: ['**'], exclude: [] },
      source: 'none (scan-only)',
      entries: [],
    };
  } else if (spec.type === 'extractor') {
    const mod = await import(pathToFileURL(path.join(BENCHMARK_ROOT, spec.module)).href);
    gt = await mod.extract(checkoutDir, spec.options ?? {});
  } else {
    throw new Error(`Unknown ground_truth.type "${spec.type}" for ${repo.id}`);
  }
  const problems = validateGroundTruth(gt);
  if (problems.length) {
    throw new Error(`Invalid ground truth for ${repo.id}:\n  - ${problems.join('\n  - ')}`);
  }
  return gt;
}

export function validateGroundTruth(gt) {
  const problems = [];
  if (!gt || typeof gt !== 'object') return ['ground truth is not an object'];
  if (!Array.isArray(gt.entries)) problems.push('entries must be an array');
  if (!['fp', 'unlabeled', 'ignore'].includes(gt.unmatched_policy)) {
    problems.push(`unmatched_policy must be fp|unlabeled|ignore (got ${gt.unmatched_policy})`);
  }
  const ids = new Set();
  for (const [i, e] of (gt.entries ?? []).entries()) {
    const where = `entries[${i}]${e?.id ? ` (${e.id})` : ''}`;
    if (!e.id) problems.push(`${where}: missing id`);
    else if (ids.has(e.id)) problems.push(`${where}: duplicate id`);
    ids.add(e.id);
    if (!['vuln', 'safe'].includes(e.status)) problems.push(`${where}: status must be vuln|safe`);
    if (typeof e.file !== 'string' || !e.file) problems.push(`${where}: missing file`);
    if (!isKnownCategory(e.category)) problems.push(`${where}: unknown category "${e.category}"`);
    if (e.lines != null) {
      const ok = Array.isArray(e.lines) && e.lines.length === 2 && e.lines.every(Number.isInteger) && e.lines[0] <= e.lines[1] && e.lines[0] > 0;
      if (!ok) problems.push(`${where}: lines must be [start, end] positive integers`);
    }
  }
  return problems;
}

/**
 * Re-anchors line-based entries against the actual checkout the scan ran on.
 * Upstream repos keep moving, so when an entry's `anchor` text is no longer
 * on its recorded lines, it is relocated to the nearest line containing the
 * anchor. Entries whose file or anchor can't be found are flagged stale and
 * reported, rather than silently scored as misses.
 */
export async function resolveEntries(gt, checkoutDir) {
  const fileCache = new Map();
  const readLines = async (rel) => {
    if (!fileCache.has(rel)) {
      fileCache.set(
        rel,
        await readFile(path.join(checkoutDir, rel), 'utf8')
          .then((t) => t.split(/\r?\n/))
          .catch(() => null)
      );
    }
    return fileCache.get(rel);
  };

  const resolved = [];
  for (const entry of gt.entries) {
    const out = { ...entry, resolution: 'as-recorded' };
    const lines = await readLines(entry.file);
    if (!lines) {
      out.resolution = 'stale:file-missing';
    } else if (entry.lines && entry.anchor) {
      const [start, end] = entry.lines;
      const window = lines.slice(Math.max(0, start - 3), end + 2);
      if (!window.some((l) => l.includes(entry.anchor))) {
        const hits = [];
        lines.forEach((l, idx) => l.includes(entry.anchor) && hits.push(idx + 1));
        if (hits.length === 0) {
          out.resolution = 'stale:anchor-missing';
        } else {
          const best = hits.reduce((a, b) => (Math.abs(b - start) < Math.abs(a - start) ? b : a));
          const delta = best - start;
          out.lines = [start + delta, end + delta];
          out.resolution = `relocated:${delta > 0 ? '+' : ''}${delta}`;
        }
      }
    }
    resolved.push(out);
  }
  return resolved;
}

export function gtMeta(gt, entries) {
  return {
    source: gt.source,
    commit: gt.commit,
    complete: gt.complete,
    unmatched_policy: gt.unmatched_policy,
    strict_categories: Boolean(gt.strict_categories),
    entries: entries.length,
    relocated: entries.filter((e) => e.resolution.startsWith('relocated')).length,
    stale: entries.filter((e) => e.resolution.startsWith('stale')).map((e) => ({ id: e.id, resolution: e.resolution })),
  };
}

const globCache = new Map();
export function globToRegExp(glob) {
  if (globCache.has(glob)) return globCache.get(glob);
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      re += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const compiled = new RegExp(`^${re}$`);
  globCache.set(glob, compiled);
  return compiled;
}

export function inScope(file, scope) {
  const include = scope?.include?.length ? scope.include : ['**'];
  const exclude = scope?.exclude ?? [];
  return include.some((g) => globToRegExp(g).test(file)) && !exclude.some((g) => globToRegExp(g).test(file));
}
