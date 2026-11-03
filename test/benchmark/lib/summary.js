import { summarizeFixes } from './fixes.js';

const ratio = (n, d) => (d > 0 ? n / d : null);
const sum = (xs, f) => xs.reduce((acc, x) => acc + (f(x) ?? 0), 0);

/**
 * Aggregates per-repo results into run-level numbers. Micro-averaged totals
 * (pooling every entry/finding) are the headline; per-repo rows keep the
 * detail so a big corpus like OWASP Benchmark can't hide a small one.
 */
export function buildSummary(run, repoResults) {
  const ok = repoResults.filter((r) => r.status === 'ok');
  const withGt = ok.filter((r) => r.metrics.entries_total > 0);
  const m = (r) => r.metrics;

  const vulnTotal = sum(withGt, (r) => m(r).vuln_total);
  const detected = sum(withGt, (r) => m(r).vuln_detected);
  const detectedLoose = sum(withGt, (r) => m(r).vuln_detected_including_loose);
  const detectableTotal = sum(withGt, (r) => m(r).sast_detectable_total);
  const detectableDetected = sum(withGt, (r) => m(r).sast_detectable_detected);
  const safeTotal = sum(withGt, (r) => m(r).safe_total);
  const safeFlagged = sum(withGt, (r) => m(r).safe_flagged);
  const tp = sum(withGt, (r) => m(r).findings_by_classification.tp);
  const fp = sum(withGt, (r) => m(r).findings_by_classification.fp);

  const byCategory = {};
  for (const r of withGt) {
    for (const [cat, c] of Object.entries(m(r).by_category)) {
      byCategory[cat] ??= { vuln_total: 0, detected: 0, detected_loose: 0, missed: 0, safe_total: 0, safe_flagged: 0, findings_tp: 0, findings_fp: 0 };
      for (const [k, v] of Object.entries(c)) byCategory[cat][k] += v;
    }
  }
  for (const c of Object.values(byCategory)) {
    c.recall = ratio(c.detected, c.vuln_total);
    c.false_positive_rate = ratio(c.safe_flagged, c.safe_total);
  }

  const byRule = {};
  for (const r of ok) {
    for (const [rule, c] of Object.entries(m(r).by_rule)) {
      byRule[rule] ??= { short_rule: c.short_rule, total: 0, tp: 0, fp: 0, loose: 0, unlabeled: 0, ignored: 0, 'out-of-scope': 0, repos: [] };
      for (const [k, v] of Object.entries(c)) if (typeof v === 'number') byRule[rule][k] += v;
      byRule[rule].repos.push(r.repo.id);
    }
  }
  for (const c of Object.values(byRule)) c.precision = ratio(c.tp, c.tp + c.fp);

  const allFixRecords = ok.flatMap((r) => r.fix_records ?? []);

  return {
    run,
    repos_attempted: repoResults.length,
    repos_ok: ok.length,
    repos_failed: repoResults.filter((r) => r.status !== 'ok').map((r) => ({ id: r.repo.id, status: r.status, error: r.error })),
    repos_with_ground_truth: withGt.length,
    totals: {
      findings: sum(ok, (r) => m(r).findings_total),
      findings_distinct_locations: sum(ok, (r) => m(r).findings_distinct_locations),
      findings_by_classification: ['tp', 'fp', 'loose', 'unlabeled', 'ignored', 'out-of-scope'].reduce(
        (acc, k) => ({ ...acc, [k]: sum(ok, (r) => m(r).findings_by_classification[k]) }),
        {}
      ),
      vuln_total: vulnTotal,
      vuln_detected: detected,
      vuln_detected_including_loose: detectedLoose,
      sast_detectable_total: detectableTotal,
      sast_detectable_detected: detectableDetected,
      safe_total: safeTotal,
      safe_flagged: safeFlagged,
      recall: ratio(detected, vulnTotal),
      recall_including_loose: ratio(detectedLoose, vulnTotal),
      recall_sast_detectable: ratio(detectableDetected, detectableTotal),
      precision: ratio(tp, tp + fp),
      false_positive_rate: ratio(safeFlagged, safeTotal),
      youden_index: safeTotal > 0 && vulnTotal > 0 ? ratio(detected, vulnTotal) - ratio(safeFlagged, safeTotal) : null,
      scan_ms_total: sum(ok, (r) => r.timings?.scan_ms),
    },
    by_category: byCategory,
    by_rule: byRule,
    fixes: summarizeFixes(allFixRecords),
    repos: repoResults.map((r) => ({
      id: r.repo.id,
      name: r.repo.name,
      language: r.repo.language,
      framework: r.repo.framework,
      tier: r.repo.tier,
      url: r.repo.url,
      status: r.status,
      error: r.error ?? null,
      head_sha: r.head_sha ?? null,
      head_moved_during_scan: r.head_sha && r.head_sha_after ? r.head_sha !== r.head_sha_after : false,
      ground_truth: r.gt_meta ?? null,
      timings: r.timings ?? null,
      scanner: r.scanner ?? null,
      metrics: r.metrics ?? null,
      fixes: r.fix_records ? summarizeFixes(r.fix_records) : null,
    })),
  };
}
