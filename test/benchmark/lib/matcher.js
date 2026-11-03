import { categoriesCompatible, categoriesForFinding, parseCwes } from './taxonomy.js';
import { inScope } from './ground-truth.js';

/**
 * Joins backend findings with the raw Semgrep results they were derived from
 * (same order; see scanService.toFinding) so CWE/confidence metadata, which
 * the backend's slim finding objects drop, is available for matching.
 */
export function enrichFindings(report) {
  const raw = report.raw?.results ?? [];
  return report.findings.map((finding, index) => {
    let source = raw[index];
    if (!source || source.check_id !== finding.rule_id) {
      source = raw.find(
        (r) => r.check_id === finding.rule_id && r.start?.line === finding.start_line && normalizePath(r.path).endsWith(finding.file)
      );
    }
    const meta = source?.extra?.metadata ?? {};
    const cwes = parseCwes(meta.cwe);
    return {
      index,
      rule_id: finding.rule_id,
      short_rule: shortRule(finding.rule_id),
      message: finding.message,
      file: normalizePath(finding.file),
      start_line: finding.start_line,
      end_line: finding.end_line ?? finding.start_line,
      severity: finding.severity,
      confidence: meta.confidence ?? null,
      likelihood: meta.likelihood ?? null,
      impact: meta.impact ?? null,
      owasp: meta.owasp ?? [],
      cwes,
      categories: categoriesForFinding({ cwes, ruleId: finding.rule_id }),
      snippet: source?.extra?.lines ?? null,
    };
  });
}

function normalizePath(p) {
  return (p ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
}

// Line gap between a finding and an entry (0 = overlapping, file-level entries always 0).
function distance(finding, entry) {
  if (!entry.lines) return 0;
  const [s, e] = entry.lines;
  if (finding.start_line > e) return finding.start_line - e;
  if (finding.end_line < s) return s - finding.end_line;
  return 0;
}

// The tolerance exists to absorb off-by-a-line reporting, not to let one
// finding credit a *different* adjacent vulnerability, so only the closest
// candidates are kept.
function nearest(finding, candidates) {
  if (candidates.length < 2) return candidates;
  const best = Math.min(...candidates.map((e) => distance(finding, e)));
  return candidates.filter((e) => distance(finding, e) === best);
}

// "python.flask.security.injection.raw-html-concat.raw-html-format" -> "flask/raw-html-format"
// (the last segment alone collides across rulesets, e.g. flask vs django).
export function shortRule(ruleId) {
  const parts = (ruleId ?? '').split('.');
  return parts.length > 2 ? `${parts[1]}/${parts[parts.length - 1]}` : ruleId;
}

/**
 * Classifies every finding against the resolved ground truth and computes
 * detection/precision metrics. See README "Scoring" for the exact rules.
 */
export function analyze({ findings, gt, entries, lineTolerance = 2 }) {
  const byFile = new Map();
  for (const entry of entries) {
    if (!byFile.has(entry.file)) byFile.set(entry.file, []);
    byFile.get(entry.file).push(entry);
  }
  const entryState = new Map(entries.map((e) => [e.id, { strict: [], loose: [] }]));
  // OWASP-Benchmark-style keys score on the exact category (crypto vs hash
  // are separate test classes), so related-category matching is disabled.
  const sameType = gt.strict_categories
    ? (f, e) => f.categories.includes(e.category)
    : (f, e) => categoriesCompatible(f.categories, e.category);

  const classified = findings.map((f) => {
    const out = { ...f, classification: null, matched_entries: [] };
    if (!inScope(f.file, gt.scope)) {
      out.classification = 'out-of-scope';
      return out;
    }
    const candidates = (byFile.get(f.file) ?? []).filter((e) => !e.resolution.startsWith('stale') && distance(f, e) <= lineTolerance);
    const vulnTyped = nearest(f, candidates.filter((e) => e.status === 'vuln' && sameType(f, e)));
    const safeTyped = nearest(f, candidates.filter((e) => e.status === 'safe' && sameType(f, e)));
    const vulnLoose = nearest(f, candidates.filter((e) => e.status === 'vuln' && !sameType(f, e)));

    if (vulnTyped.length) {
      out.classification = 'tp';
      out.matched_entries = vulnTyped.map((e) => e.id);
      for (const e of vulnTyped) entryState.get(e.id).strict.push(f.index);
    } else if (safeTyped.length) {
      out.classification = 'fp';
      out.fp_reason = 'flagged-known-safe';
      out.matched_entries = safeTyped.map((e) => e.id);
      for (const e of safeTyped) entryState.get(e.id).strict.push(f.index);
    } else if (vulnLoose.length) {
      out.classification = 'loose';
      out.matched_entries = vulnLoose.map((e) => e.id);
      for (const e of vulnLoose) entryState.get(e.id).loose.push(f.index);
    } else if (gt.unmatched_policy === 'fp') {
      out.classification = 'fp';
      out.fp_reason = 'not-in-complete-ground-truth';
    } else if (gt.unmatched_policy === 'ignore') {
      out.classification = 'ignored';
    } else {
      out.classification = 'unlabeled';
    }
    return out;
  });

  const resolvedEntries = entries.map((e) => {
    const state = entryState.get(e.id);
    let outcome;
    if (e.resolution.startsWith('stale')) outcome = 'stale';
    else if (e.status === 'vuln') outcome = state.strict.length ? 'detected' : state.loose.length ? 'detected-loose' : 'missed';
    else outcome = state.strict.length ? 'flagged' : 'clean';
    return { ...e, outcome, matched_findings: state.strict, loose_findings: state.loose };
  });

  return { findings: classified, entries: resolvedEntries, metrics: computeMetrics(classified, resolvedEntries, gt) };
}

const ratio = (n, d) => (d > 0 ? n / d : null);

function computeMetrics(findings, entries, gt) {
  const count = (list, pred) => list.filter(pred).length;
  const live = entries.filter((e) => e.outcome !== 'stale');
  const vulns = live.filter((e) => e.status === 'vuln');
  const safes = live.filter((e) => e.status === 'safe');
  const detectableVulns = vulns.filter((e) => e.sast_detectable !== false);

  const tp = count(findings, (f) => f.classification === 'tp');
  const fp = count(findings, (f) => f.classification === 'fp');
  const detected = count(vulns, (e) => e.outcome === 'detected');
  const detectedLoose = count(vulns, (e) => e.outcome === 'detected' || e.outcome === 'detected-loose');
  const safeFlagged = count(safes, (e) => e.outcome === 'flagged');
  const tpr = ratio(detected, vulns.length);
  const fpr = ratio(safeFlagged, safes.length);

  const locations = new Set(findings.map((f) => `${f.file}:${f.start_line}`));

  const byCategory = {};
  const bump = (cat, key, n = 1) => {
    byCategory[cat] ??= { vuln_total: 0, detected: 0, detected_loose: 0, missed: 0, safe_total: 0, safe_flagged: 0, findings_tp: 0, findings_fp: 0 };
    byCategory[cat][key] += n;
  };
  for (const e of vulns) {
    bump(e.category, 'vuln_total');
    if (e.outcome === 'detected') bump(e.category, 'detected');
    if (e.outcome === 'detected-loose') bump(e.category, 'detected_loose');
    if (e.outcome === 'missed') bump(e.category, 'missed');
  }
  for (const e of safes) {
    bump(e.category, 'safe_total');
    if (e.outcome === 'flagged') bump(e.category, 'safe_flagged');
  }
  for (const f of findings) {
    if (f.classification === 'tp') bump(entries.find((e) => e.id === f.matched_entries[0]).category, 'findings_tp');
    if (f.classification === 'fp') bump(f.categories[0], 'findings_fp');
  }

  const byRule = {};
  for (const f of findings) {
    byRule[f.rule_id] ??= { short_rule: f.short_rule, total: 0, tp: 0, fp: 0, loose: 0, unlabeled: 0, ignored: 0, 'out-of-scope': 0 };
    byRule[f.rule_id].total += 1;
    byRule[f.rule_id][f.classification] += 1;
  }

  const bySeverity = {};
  for (const f of findings) {
    const sev = f.severity ?? 'UNKNOWN';
    bySeverity[sev] ??= { total: 0, tp: 0, fp: 0 };
    bySeverity[sev].total += 1;
    if (f.classification === 'tp') bySeverity[sev].tp += 1;
    if (f.classification === 'fp') bySeverity[sev].fp += 1;
  }

  return {
    ground_truth_complete: Boolean(gt.complete),
    unmatched_policy: gt.unmatched_policy,
    findings_total: findings.length,
    findings_distinct_locations: locations.size,
    findings_by_classification: {
      tp,
      fp,
      loose: count(findings, (f) => f.classification === 'loose'),
      unlabeled: count(findings, (f) => f.classification === 'unlabeled'),
      ignored: count(findings, (f) => f.classification === 'ignored'),
      'out-of-scope': count(findings, (f) => f.classification === 'out-of-scope'),
    },
    entries_total: entries.length,
    entries_stale: entries.length - live.length,
    vuln_total: vulns.length,
    vuln_detected: detected,
    vuln_detected_including_loose: detectedLoose,
    vuln_missed: vulns.length - detectedLoose,
    sast_detectable_total: detectableVulns.length,
    sast_detectable_detected: count(detectableVulns, (e) => e.outcome === 'detected'),
    safe_total: safes.length,
    safe_flagged: safeFlagged,
    recall: tpr,
    recall_including_loose: ratio(detectedLoose, vulns.length),
    recall_sast_detectable: ratio(count(detectableVulns, (e) => e.outcome === 'detected'), detectableVulns.length),
    precision: ratio(tp, tp + fp),
    false_positive_rate: fpr,
    youden_index: tpr != null && fpr != null ? tpr - fpr : null,
    by_category: byCategory,
    by_rule: byRule,
    by_severity: bySeverity,
  };
}
