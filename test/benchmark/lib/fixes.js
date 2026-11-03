import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTEXT_LIMITS } from '../../../backend/src/services/contextBuilder.js';
import { diffStats, fixRedFlags } from './diff.js';

const CLASS_PRIORITY = { tp: 0, loose: 1, unlabeled: 2, fp: 3, ignored: 4 };
const SEVERITY_PRIORITY = { ERROR: 0, WARNING: 1, INFO: 2 };

/**
 * Picks which findings get an AI fix. Every fix costs an LLM call plus a full
 * re-clone and re-scan for verification, so this is capped. Order: confirmed
 * true positives first, highest severity first, then round-robin across
 * vulnerability categories so one noisy rule can't eat the whole budget.
 */
export function selectFindingsForFix(findings, { max, classes }) {
  if (max <= 0) return [];
  const seen = new Set();
  const pool = findings
    .filter((f) => classes.includes(f.classification))
    .sort(
      (a, b) =>
        CLASS_PRIORITY[a.classification] - CLASS_PRIORITY[b.classification] ||
        (SEVERITY_PRIORITY[a.severity] ?? 3) - (SEVERITY_PRIORITY[b.severity] ?? 3) ||
        a.index - b.index
    )
    .filter((f) => {
      const key = `${f.file}:${f.start_line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const buckets = new Map();
  for (const f of pool) {
    const key = `${f.classification}|${f.categories[0]}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  }

  const picked = [];
  for (const cls of classes) {
    const queues = [...buckets.entries()].filter(([k]) => k.startsWith(`${cls}|`)).map(([, q]) => q);
    while (picked.length < max && queues.some((q) => q.length)) {
      for (const q of queues) {
        if (picked.length >= max) break;
        if (q.length) picked.push(q.shift());
      }
    }
  }
  return picked;
}

// Set once the provider rejects our credentials, so the rest of the run
// doesn't burn time (and, for other repos, report N identical failures).
let fatalFixError = null;

export async function runFixes({ api, scanId, selected, checkoutDir, verify, log }) {
  const records = [];
  if (fatalFixError && selected.length) log(`skipping ${selected.length} fix(es): ${fatalFixError}`);
  for (const [n, finding] of selected.entries()) {
    if (fatalFixError) break;
    const label = `[fix ${n + 1}/${selected.length}] #${finding.index} ${finding.short_rule} ${finding.file}:${finding.start_line}`;
    const record = {
      finding_index: finding.index,
      rule_id: finding.rule_id,
      file: finding.file,
      start_line: finding.start_line,
      severity: finding.severity,
      classification: finding.classification,
      categories: finding.categories,
      matched_entries: finding.matched_entries,
      fix: null,
      verification: null,
    };

    const fixStart = Date.now();
    try {
      const fix = await api.fix(scanId, finding.index);
      const original = await readFile(path.join(checkoutDir, finding.file), 'utf8').catch(() => null);
      const stats = original != null ? diffStats(original, fix.fixed_code) : null;
      record.fix = {
        ok: true,
        latency_ms: Date.now() - fixStart,
        model: fix.model,
        explanation: fix.explanation,
        changes: fix.changes,
        fixed_code: fix.fixed_code,
        diff: stats,
        red_flags: stats
          ? fixRedFlags(stats, {
              originalBytes: Buffer.byteLength(original, 'utf8'),
              contextLimitBytes: CONTEXT_LIMITS.MAX_PRIMARY_FILE_BYTES,
            })
          : ['original-unavailable'],
      };
      log(`${label} -> fix ok (${record.fix.latency_ms} ms, -${stats?.removed ?? '?'}/+${stats?.added ?? '?'} lines)`);
    } catch (err) {
      record.fix = { ok: false, latency_ms: Date.now() - fixStart, error: err.message, http_status: err.status ?? null };
      log(`${label} -> fix FAILED: ${err.message}`);
      const kind = classifyFixError(err.message);
      if (kind === 'auth-error' || kind === 'missing-api-key') {
        fatalFixError = `${kind} from the AI provider; fix the backend's OPENROUTER_API_KEY and re-run`;
        log(`stopping all remaining fixes in this run: ${fatalFixError}`);
      }
    }

    if (verify && record.fix.ok) {
      const verifyStart = Date.now();
      try {
        const result = await api.verify(scanId, finding.index);
        record.verification = {
          ok: true,
          latency_ms: Date.now() - verifyStart,
          status: result.status,
          verified: result.verified,
          remaining_count: result.remaining_findings?.length ?? 0,
          remaining_findings: result.remaining_findings ?? [],
          message: result.message,
        };
        log(`${label} -> ${result.status} (${record.verification.latency_ms} ms)`);
      } catch (err) {
        record.verification = { ok: false, latency_ms: Date.now() - verifyStart, error: err.message, http_status: err.status ?? null };
        log(`${label} -> verification ERROR: ${err.message}`);
      }
    }
    records.push(record);
  }
  return records;
}

export function summarizeFixes(records) {
  const attempted = records.length;
  const generated = records.filter((r) => r.fix?.ok);
  const verifiedAttempts = generated.filter((r) => r.verification);
  const verified = verifiedAttempts.filter((r) => r.verification.ok && r.verification.verified);
  const failed = verifiedAttempts.filter((r) => r.verification.ok && !r.verification.verified);
  const verifyErrors = verifiedAttempts.filter((r) => !r.verification.ok);
  const flagCounts = {};
  for (const r of generated) for (const f of r.fix.red_flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  const errorKinds = {};
  for (const r of records.filter((x) => !x.fix?.ok)) {
    const kind = classifyFixError(r.fix?.error ?? '');
    errorKinds[kind] = (errorKinds[kind] ?? 0) + 1;
  }
  const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const cleanVerified = verified.filter((r) => r.fix.red_flags.length === 0);
  return {
    attempted,
    generated: generated.length,
    generation_errors: attempted - generated.length,
    generation_error_kinds: errorKinds,
    verification_attempted: verifiedAttempts.length,
    verified: verified.length,
    verification_failed: failed.length,
    verification_errors: verifyErrors.length,
    generation_rate: attempted ? generated.length / attempted : null,
    verified_rate_of_generated: verifiedAttempts.length ? verified.length / verifiedAttempts.length : null,
    end_to_end_rate: attempted ? verified.length / attempted : null,
    verified_without_red_flags: cleanVerified.length,
    red_flags: flagCounts,
    median_fix_latency_ms: median(records.filter((r) => r.fix?.ok).map((r) => r.fix.latency_ms)),
    median_verify_latency_ms: median(verifiedAttempts.filter((r) => r.verification.ok).map((r) => r.verification.latency_ms)),
  };
}

function classifyFixError(message) {
  if (/OPENROUTER_API_KEY/i.test(message)) return 'missing-api-key';
  if (/OpenRouter request failed \((401|403)\)/i.test(message)) return 'auth-error';
  if (/timed out/i.test(message)) return 'timeout';
  if (/not valid JSON|not a JSON object/i.test(message)) return 'invalid-json';
  if (/missing (a )?valid/i.test(message)) return 'schema-violation';
  if (/unexpected file/i.test(message)) return 'wrong-file';
  if (/OpenRouter request failed \((429|402)/i.test(message)) return 'rate-limit-or-credits';
  if (/OpenRouter request failed/i.test(message)) return 'provider-error';
  if (/empty response/i.test(message)) return 'empty-response';
  return 'other';
}
