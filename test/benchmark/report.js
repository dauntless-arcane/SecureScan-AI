#!/usr/bin/env node
// Renders summary.json + per-repo analysis into report.md and report.html.
// Standalone usage re-renders an existing run, optionally re-scoring saved
// scans against the *current* ground truth (no re-scan needed):
//   node test/benchmark/report.js [resultsDir] [--rematch]
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_CACHE_DIR, loadCatalog } from './lib/config.js';
import { ensureCheckout } from './lib/git.js';
import { BENCHMARK_ROOT, gtMeta, loadGroundTruth, resolveEntries } from './lib/ground-truth.js';
import { analyze, enrichFindings, shortRule } from './lib/matcher.js';
import { buildSummary } from './lib/summary.js';

const CLASSES = ['tp', 'fp', 'loose', 'unlabeled', 'ignored', 'out-of-scope'];
const CLASS_LABELS = {
  tp: 'True positive',
  fp: 'False positive',
  loose: 'Right place, wrong type',
  unlabeled: 'Unlabeled',
  ignored: 'Ignored (scoring rule)',
  'out-of-scope': 'Out of scope',
};

const pct = (x, digits = 1) => (x == null ? 'n/a' : `${(x * 100).toFixed(digits)}%`);
const ms = (x) => (x == null ? 'n/a' : x >= 60_000 ? `${(x / 60_000).toFixed(1)} min` : `${(x / 1000).toFixed(1)} s`);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

async function loadAnalyses(outDir, summary) {
  const analyses = {};
  for (const r of summary.repos) {
    const file = path.join(outDir, 'repos', r.id, 'analysis.json');
    if (existsSync(file)) analyses[r.id] = JSON.parse(await readFile(file, 'utf8'));
  }
  return analyses;
}

// ---------------------------------------------------------------- insights

function buildInsights(summary, analyses) {
  const t = summary.totals;
  const out = [];
  if (summary.repos_failed.length) {
    out.push(`${summary.repos_failed.length} repo(s) did not complete: ${summary.repos_failed.map((f) => `${f.id} (${f.status}: ${truncate(f.error, 120)})`).join('; ')}.`);
  }
  if (t.vuln_total) {
    out.push(
      `Semgrep detected ${t.vuln_detected} of ${t.vuln_total} known vulnerabilities (${pct(t.recall)}); ` +
        `${t.sast_detectable_detected} of ${t.sast_detectable_total} that a static scanner could reasonably find (${pct(t.recall_sast_detectable)}).`
    );
  }
  if (t.vuln_detected_including_loose > t.vuln_detected) {
    out.push(`${t.vuln_detected_including_loose - t.vuln_detected} more were hit at the right location but tagged with an unrelated CWE (loose matches), which is a rule metadata issue rather than a detection gap.`);
  }
  const cats = Object.entries(summary.by_category)
    .filter(([, c]) => c.vuln_total >= 2)
    .map(([cat, c]) => ({ cat, ...c }));
  const blind = cats.filter((c) => c.detected === 0).sort((a, b) => b.vuln_total - a.vuln_total);
  if (blind.length) out.push(`Complete blind spots (0 detected, 2+ known): ${blind.map((c) => `${c.cat} (${c.vuln_total})`).join(', ')}.`);
  if (t.safe_total) out.push(`False-positive rate on deliberately safe code: ${t.safe_flagged}/${t.safe_total} (${pct(t.false_positive_rate)}).`);
  const noisy = Object.entries(summary.by_rule)
    .map(([rule, c]) => ({ rule, ...c, noise: c.fp + c['out-of-scope'] }))
    .filter((c) => c.noise >= 3)
    .sort((a, b) => b.noise - a.noise)
    .slice(0, 3);
  if (noisy.length) out.push(`Noisiest rules: ${noisy.map((r) => `${r.short_rule} (${r.fp} FP, ${r['out-of-scope']} out-of-scope)`).join('; ')}.`);
  const f = summary.fixes;
  if (f.attempted && !f.generated) {
    const kinds = Object.entries(f.generation_error_kinds).map(([k, v]) => `${k} ×${v}`).join(', ');
    out.push(`AI fixes: none of ${f.attempted} could be generated (${kinds}), so the fix and verification stages were not exercised in this run.`);
  } else if (f.attempted) {
    out.push(
      `AI fixes: ${f.generated}/${f.attempted} generated, ${f.verified}/${f.verification_attempted} verified by re-scan ` +
        `(${pct(f.end_to_end_rate)} end-to-end); ${f.verified - f.verified_without_red_flags} verified fixes carried a red flag (large rewrite, shrunk file, or truncated context).`
    );
  }
  const dup = t.findings - t.findings_distinct_locations;
  if (dup > 0) out.push(`${dup} findings duplicate an already-reported file:line (overlapping rulesets), inflating the raw count by ${pct(dup / t.findings)}.`);
  return out;
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// ---------------------------------------------------------------- markdown

function renderMarkdown(summary, analyses) {
  const t = summary.totals;
  const L = [];
  L.push(`# SecureScanAI benchmark report`, '');
  L.push(`Run \`${summary.run.run_id}\`${summary.run.label ? ` (${summary.run.label})` : ''} · SecureScanAI \`${summary.run.securescan_commit?.slice(0, 10) ?? '?'}\`${summary.run.securescan_dirty ? ' (uncommitted changes)' : ''} · ${summary.repos_ok}/${summary.repos_attempted} repos completed`, '');
  L.push('## Key findings', '', ...buildInsights(summary, analyses).map((s) => `- ${s}`), '');

  L.push('## Headline metrics', '');
  L.push('| Metric | Value | Basis |', '|---|---|---|');
  L.push(`| Recall | ${pct(t.recall)} | ${t.vuln_detected}/${t.vuln_total} known vulns, type-matched |`);
  L.push(`| Recall (SAST-detectable only) | ${pct(t.recall_sast_detectable)} | ${t.sast_detectable_detected}/${t.sast_detectable_total} |`);
  L.push(`| Recall incl. loose matches | ${pct(t.recall_including_loose)} | ${t.vuln_detected_including_loose}/${t.vuln_total} |`);
  L.push(`| Precision (labeled findings) | ${pct(t.precision)} | ${t.findings_by_classification.tp} TP / ${t.findings_by_classification.fp} FP |`);
  L.push(`| False-positive rate (safe code) | ${pct(t.false_positive_rate)} | ${t.safe_flagged}/${t.safe_total} safe entries flagged |`);
  L.push(
    `| Youden index (TPR − FPR) | ${t.youden_index == null || t.safe_total < 30 ? 'n/a' : t.youden_index.toFixed(3)} | ${t.safe_total < 30 ? `needs ≥30 safe samples (have ${t.safe_total}); run owasp-benchmark-java` : '0 = random, 1 = perfect'} |`
  );
  L.push(`| Findings | ${t.findings} | ${t.findings_distinct_locations} distinct file:line |`);
  L.push(`| AI fix end-to-end success | ${pct(summary.fixes.end_to_end_rate)} | ${summary.fixes.verified}/${summary.fixes.attempted} verified |`, '');

  L.push('## Per repository', '');
  L.push('| Repo | Lang | GT | Findings | Recall | Precision | FPR | Clone | Scan | Fixes verified | Status |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of summary.repos) {
    const m = r.metrics;
    const gt = r.ground_truth ? `${r.ground_truth.entries}${r.ground_truth.complete ? ' (complete)' : ''}` : '-';
    L.push(
      `| ${r.id} | ${r.language} | ${gt} | ${m?.findings_total ?? '-'} | ${m?.vuln_total ? `${pct(m.recall)} (${m.vuln_detected}/${m.vuln_total})` : '-'} | ${m ? pct(m.precision) : '-'} | ${m?.safe_total ? pct(m.false_positive_rate) : '-'} | ${ms(r.timings?.clone_ms)} | ${ms(r.timings?.scan_ms)} | ${r.fixes?.attempted ? `${r.fixes.verified}/${r.fixes.attempted}` : '-'} | ${r.status === 'ok' ? 'ok' : `**${r.status}**: ${mdCell(truncate(r.error, 80))}`} |`
    );
  }
  L.push('');

  L.push('## Detection by category', '');
  L.push('| Category | Known | Detected | Loose | Missed | Recall | Safe flagged | FPR |', '|---|---|---|---|---|---|---|---|');
  for (const [cat, c] of sortedCategories(summary)) {
    L.push(`| ${cat} | ${c.vuln_total} | ${c.detected} | ${c.detected_loose} | ${c.missed} | ${pct(c.recall)} | ${c.safe_total ? `${c.safe_flagged}/${c.safe_total}` : '-'} | ${pct(c.false_positive_rate)} |`);
  }
  L.push('');

  L.push('## Missed vulnerabilities a SAST tool should find', '');
  const missed = missedDetectable(summary, analyses);
  if (!missed.length) L.push('_None._');
  else {
    L.push('| Repo | Entry | Category | Location | Description |', '|---|---|---|---|---|');
    for (const m of missed.slice(0, 80)) L.push(`| ${m.repo} | ${m.id} | ${m.category} | \`${m.file}:${m.lines?.join('-') ?? '*'}\` | ${mdCell(m.title)} |`);
    if (missed.length > 80) L.push('', `_…and ${missed.length - 80} more (see analysis.json)._`);
  }
  L.push('');

  L.push('## False positives', '');
  const fps = falsePositives(summary, analyses);
  if (!fps.length) L.push('_None._');
  else {
    L.push('| Repo | Rule | Location | Why counted | Severity |', '|---|---|---|---|---|');
    for (const f of fps.slice(0, 60)) L.push(`| ${f.repo} | ${f.short_rule} | \`${f.file}:${f.start_line}\` | ${f.fp_reason}${f.matched_entries.length ? ` (${f.matched_entries.join(', ')})` : ''} | ${f.severity} |`);
    if (fps.length > 60) L.push('', `_…and ${fps.length - 60} more._`);
  }
  L.push('');

  L.push('## Rules, noisiest first', '');
  L.push('| Rule | Total | TP | FP | Unlabeled | Out of scope | Precision | Repos |', '|---|---|---|---|---|---|---|---|');
  for (const [rule, c] of noisyRules(summary).slice(0, 25)) {
    L.push(`| ${c.short_rule} | ${c.total} | ${c.tp} | ${c.fp} | ${c.unlabeled} | ${c['out-of-scope']} | ${pct(c.precision)} | ${[...new Set(c.repos)].join(', ')} |`);
  }
  L.push('');

  const f = summary.fixes;
  L.push('## AI fix pipeline', '');
  if (!f.attempted) L.push('_No fixes attempted in this run (--max-fixes 0)._');
  else {
    L.push('| Stage | Count | Rate |', '|---|---|---|');
    L.push(`| Attempted | ${f.attempted} | |`);
    L.push(`| Fix generated | ${f.generated} | ${pct(f.generation_rate)} |`);
    L.push(`| Verified (finding gone on re-scan) | ${f.verified} | ${pct(f.verified_rate_of_generated)} of verified attempts |`);
    L.push(`| Verified with no red flags | ${f.verified_without_red_flags} | |`);
    L.push(`| Verification FAILED (still detected) | ${f.verification_failed} | |`);
    L.push(`| Verification errors | ${f.verification_errors} | |`);
    L.push('', `Median fix latency ${ms(f.median_fix_latency_ms)}, median verification ${ms(f.median_verify_latency_ms)}.`);
    if (Object.keys(f.generation_error_kinds).length) L.push('', `Generation errors: ${Object.entries(f.generation_error_kinds).map(([k, v]) => `${k} ×${v}`).join(', ')}.`);
    if (Object.keys(f.red_flags).length) L.push('', `Red flags: ${Object.entries(f.red_flags).map(([k, v]) => `${k} ×${v}`).join(', ')}.`);
    L.push('', '| Repo | Finding | Class | Generated | Diff (−/+) | Red flags | Verification |', '|---|---|---|---|---|---|---|');
    for (const rec of fixRows(summary)) {
      L.push(
        `| ${rec.repo} | ${rec.rule} \`${rec.file}:${rec.start_line}\` | ${rec.classification} | ${rec.fix.ok ? 'yes' : `no: ${mdCell(truncate(rec.fix.error, 70))}`} | ${rec.fix.diff ? `−${rec.fix.diff.removed ?? '?'}/+${rec.fix.diff.added ?? '?'}` : '-'} | ${rec.fix.red_flags?.join(', ') || '-'} | ${verificationLabel(rec)} |`
      );
    }
  }
  L.push('');
  L.push('## Method and caveats', '', ...methodNotes(summary).map((s) => `- ${s}`), '');
  return L.join('\n');
}

function verificationLabel(rec) {
  if (!rec.verification) return rec.fix.ok ? 'skipped' : '-';
  if (!rec.verification.ok) return `error: ${truncate(rec.verification.error, 60)}`;
  return rec.verification.verified ? 'VERIFIED' : `FAILED (${rec.verification.remaining_count} remaining)`;
}

function sortedCategories(summary) {
  return Object.entries(summary.by_category).sort((a, b) => b[1].vuln_total + b[1].safe_total - (a[1].vuln_total + a[1].safe_total) || a[0].localeCompare(b[0]));
}

function noisyRules(summary) {
  return Object.entries(summary.by_rule).sort((a, b) => b[1].fp + b[1]['out-of-scope'] + b[1].unlabeled - (a[1].fp + a[1]['out-of-scope'] + a[1].unlabeled) || b[1].total - a[1].total);
}

function missedDetectable(summary, analyses) {
  const out = [];
  for (const r of summary.repos) {
    for (const e of analyses[r.id]?.entries ?? []) {
      if (e.status === 'vuln' && e.outcome === 'missed' && e.sast_detectable !== false) out.push({ repo: r.id, ...e });
    }
  }
  // Benchmark-sized corpora would swamp the table; list hand-authored repos first.
  return out.sort((a, b) => (a.repo === 'owasp-benchmark-java') - (b.repo === 'owasp-benchmark-java'));
}

function falsePositives(summary, analyses) {
  const out = [];
  for (const r of summary.repos) for (const f of analyses[r.id]?.findings ?? []) if (f.classification === 'fp') out.push({ repo: r.id, ...f });
  return out.sort((a, b) => (a.repo === 'owasp-benchmark-java') - (b.repo === 'owasp-benchmark-java'));
}

function fixRows(summary) {
  return summary.repos.flatMap((r) => (r.fix_records ?? []).map((rec) => ({ repo: r.id, rule: shortRule(rec.rule_id), ...rec })));
}

function methodNotes(summary) {
  return [
    'Each repo is scanned through the public backend API (submit → poll → report), exactly as the UI does. The harness keeps its own checkout of the same commit to resolve ground-truth line anchors and to measure fix diffs.',
    `A finding is a true positive when it is in the same file, within ${summary.run.options?.lineTolerance ?? 2} lines of a known vulnerability, and its CWE-derived category matches (or is closely related to) the vulnerability's category. Same place with an unrelated category is a "loose" match: counted separately, never as a TP.`,
    'False positives come from two sources: findings on code labeled deliberately safe (all repos), and any unmatched in-scope finding for repos whose ground truth is marked complete. For other repos unmatched findings are "unlabeled": review them and promote real issues into ground truth, then re-score with `report.js --rematch`.',
    'OWASP Benchmark uses its own scoring rules: exact category match per test-case file; findings of other categories are ignored.',
    '"SAST-detectable" marks vulnerabilities a static scanner can reasonably be expected to see (injection sinks, weak crypto, secrets). Logic flaws such as IDOR, CSRF, or missing rate limits are listed for completeness but excluded from that recall figure.',
    'Fix verification only checks that the same Semgrep rule no longer fires on that file. It does not prove the fix is correct, compiles, or preserves behavior. Red flags (large rewrite, shrunk file, truncated context) mark fixes that likely silenced the scanner by deleting code or were produced from a truncated file.',
    'Upstream repos move. Ground-truth entries carry an anchor string and are relocated automatically when line numbers drift; entries whose anchor disappears are reported as stale and excluded from scoring.',
  ];
}

// ---------------------------------------------------------------- html

const SERIES = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6'];

function stackedBar(counts, total) {
  if (!total) return '<div class="stack empty">no findings</div>';
  const segs = CLASSES.map((c, i) => ({ c, i, n: counts[c] ?? 0 }))
    .filter((s) => s.n > 0)
    .map((s) => `<span class="seg" style="flex-grow:${s.n};background:var(${SERIES[s.i]})" title="${esc(CLASS_LABELS[s.c])}: ${s.n} (${pct(s.n / total)})"></span>`)
    .join('');
  return `<div class="stack" role="img" aria-label="${esc(CLASSES.map((c) => `${CLASS_LABELS[c]} ${counts[c] ?? 0}`).join(', '))}">${segs}</div>`;
}

function legend() {
  return `<div class="legend">${CLASSES.map((c, i) => `<span><i style="background:var(${SERIES[i]})"></i>${esc(CLASS_LABELS[c])}</span>`).join('')}</div>`;
}

function bar(value, label) {
  const w = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return `<div class="bar" title="${esc(label)}"><span style="width:${w}%"></span></div>`;
}

function renderHtml(summary, analyses) {
  const t = summary.totals;
  const f = summary.fixes;
  const tile = (label, value, sub) => `<div class="tile"><div class="tile-label">${esc(label)}</div><div class="tile-value">${esc(value)}</div><div class="tile-sub">${esc(sub)}</div></div>`;

  const repoRows = summary.repos
    .map((r) => {
      const m = r.metrics;
      const status = r.status === 'ok' ? '<span class="ok">ok</span>' : `<span class="bad">${esc(r.status)}</span><div class="muted small">${esc(truncate(r.error, 160))}</div>`;
      const total = m?.findings_total ?? 0;
      return `<tr>
        <td><a href="${esc(r.url)}">${esc(r.id)}</a><div class="muted small">${esc(r.language)} · ${esc(r.framework)}</div></td>
        <td class="num">${r.ground_truth ? `${r.ground_truth.entries}${r.ground_truth.complete ? ' ✓' : ''}` : '–'}</td>
        <td class="num">${m ? total : '–'}</td>
        <td class="wide">${m ? stackedBar(m.findings_by_classification, total) : ''}</td>
        <td class="num">${m?.vuln_total ? `${pct(m.recall)}<div class="muted small">${m.vuln_detected}/${m.vuln_total}</div>` : '–'}</td>
        <td class="num">${m ? pct(m.precision) : '–'}</td>
        <td class="num">${m?.safe_total ? `${pct(m.false_positive_rate)}<div class="muted small">${m.safe_flagged}/${m.safe_total}</div>` : '–'}</td>
        <td class="num">${ms(r.timings?.clone_ms)}<div class="muted small">scan ${ms(r.timings?.scan_ms)}</div></td>
        <td class="num">${r.fixes?.attempted ? `${r.fixes.verified}/${r.fixes.attempted}` : '–'}</td>
        <td>${status}${r.head_moved_during_scan ? '<div class="warn small">HEAD moved during scan</div>' : ''}${r.ground_truth?.stale?.length ? `<div class="warn small">${r.ground_truth.stale.length} stale GT entries</div>` : ''}</td>
      </tr>`;
    })
    .join('');

  const catRows = sortedCategories(summary)
    .map(
      ([cat, c]) => `<tr>
      <td>${esc(cat)}</td>
      <td class="num">${c.vuln_total}</td>
      <td class="num">${c.detected}</td>
      <td class="num">${c.detected_loose}</td>
      <td class="wide">${c.vuln_total ? `<div class="barcell">${bar(c.recall, `${cat}: ${c.detected}/${c.vuln_total} detected`)}<span class="barval">${pct(c.recall, 0)}</span></div>` : ''}</td>
      <td class="num">${c.safe_total ? `${c.safe_flagged}/${c.safe_total}` : '–'}</td>
    </tr>`
    )
    .join('');

  const missed = missedDetectable(summary, analyses);
  const missedRows = missed
    .slice(0, 150)
    .map((m) => `<tr><td>${esc(m.repo)}</td><td>${esc(m.category)}</td><td><code>${esc(m.file)}:${esc(m.lines?.join('-') ?? '*')}</code></td><td>${esc(m.title)}</td></tr>`)
    .join('');

  const fps = falsePositives(summary, analyses);
  const fpRows = fps
    .slice(0, 150)
    .map((x) => `<tr><td>${esc(x.repo)}</td><td><code>${esc(x.short_rule)}</code></td><td><code>${esc(x.file)}:${esc(x.start_line)}</code></td><td>${esc(x.fp_reason)}${x.matched_entries.length ? `<div class="muted small">${esc(x.matched_entries.join(', '))}</div>` : ''}</td><td>${esc(x.severity)}</td></tr>`)
    .join('');

  const ruleRows = noisyRules(summary)
    .slice(0, 30)
    .map(([rule, c]) => `<tr><td><code title="${esc(rule)}">${esc(c.short_rule)}</code></td><td class="num">${c.total}</td><td class="num">${c.tp}</td><td class="num">${c.fp}</td><td class="num">${c.unlabeled}</td><td class="num">${c['out-of-scope']}</td><td class="num">${pct(c.precision)}</td></tr>`)
    .join('');

  const fixRowsHtml = fixRows(summary)
    .map((rec) => {
      const v = verificationLabel(rec);
      const cls = v === 'VERIFIED' ? 'ok' : v.startsWith('FAILED') || v.startsWith('error') ? 'bad' : 'muted';
      return `<tr>
        <td>${esc(rec.repo)}</td>
        <td><code>${esc(rec.rule)}</code><div class="muted small"><code>${esc(rec.file)}:${esc(rec.start_line)}</code></div></td>
        <td>${esc(rec.classification)}</td>
        <td>${rec.fix.ok ? `yes <span class="muted small">${ms(rec.fix.latency_ms)}</span>` : `<span class="bad">no</span><div class="muted small">${esc(truncate(rec.fix.error, 140))}</div>`}</td>
        <td class="num">${rec.fix.diff ? `−${rec.fix.diff.removed ?? '?'} / +${rec.fix.diff.added ?? '?'}` : '–'}</td>
        <td>${rec.fix.red_flags?.length ? rec.fix.red_flags.map((x) => `<span class="chip">${esc(x)}</span>`).join(' ') : '–'}</td>
        <td><span class="${cls}">${esc(v)}</span></td>
      </tr>`;
    })
    .join('');

  const section = (title, body) => `<section><h2>${esc(title)}</h2>${body}</section>`;
  const table = (head, rows, empty = 'None.') => (rows ? `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">${esc(empty)}</p>`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SecureScanAI Benchmark Report</title>
<style>
:root {
  color-scheme: light;
  --surface: #fcfcfb; --surface-2: #f3f2ef; --border: #e2e0da;
  --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #77756f;
  --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100; --series-5: #e87ba4; --series-6: #008300;
  --good: #0a7d0a; --critical: #c13333; --warning: #8a5a00;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface: #1a1a19; --surface-2: #232321; --border: #383835;
    --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #9a998f;
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500; --series-5: #d55181; --series-6: #008300;
    --good: #3cc43c; --critical: #e66767; --warning: #fab219;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --surface: #1a1a19; --surface-2: #232321; --border: #383835;
  --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #9a998f;
  --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500; --series-5: #d55181; --series-6: #008300;
  --good: #3cc43c; --critical: #e66767; --warning: #fab219;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--surface); color: var(--text-primary); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1200px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 40px 0 12px; }
.meta, .muted { color: var(--text-secondary); }
.small { font-size: 12px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 24px 0; }
.tile { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
.tile-label { color: var(--text-secondary); font-size: 12px; }
.tile-value { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tile-sub { color: var(--text-muted); font-size: 12px; }
ul.insights { padding-left: 20px; } ul.insights li { margin: 6px 0; }
.scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: 12px; color: var(--text-secondary); font-weight: 600; background: var(--surface-2); white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.wide { min-width: 180px; }
code { font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; word-break: break-all; }
.stack { display: flex; gap: 2px; height: 12px; border-radius: 4px; overflow: hidden; margin-top: 4px; }
.stack.empty { color: var(--text-muted); font-size: 12px; height: auto; }
.seg { min-width: 3px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 8px 0 12px; color: var(--text-secondary); font-size: 12px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.barcell { display: flex; align-items: center; gap: 8px; }
.bar { flex: 1; height: 10px; background: var(--surface-2); border-radius: 4px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--series-1); border-radius: 0 4px 4px 0; }
.barval { width: 42px; text-align: right; font-variant-numeric: tabular-nums; color: var(--text-secondary); font-size: 12px; }
.ok { color: var(--good); font-weight: 600; } .bad { color: var(--critical); font-weight: 600; } .warn { color: var(--warning); }
.chip { display: inline-block; border: 1px solid var(--border); border-radius: 10px; padding: 0 8px; font-size: 11px; color: var(--text-secondary); }
ol.method li { margin: 6px 0; color: var(--text-secondary); }
a { color: var(--series-1); }
</style>
</head>
<body>
<main>
<h1>SecureScanAI benchmark report</h1>
<div class="meta">Run <code>${esc(summary.run.run_id)}</code>${summary.run.label ? ` · ${esc(summary.run.label)}` : ''} · SecureScanAI <code>${esc(summary.run.securescan_commit?.slice(0, 10) ?? '?')}</code>${summary.run.securescan_dirty ? ' (uncommitted changes)' : ''} · ${summary.repos_ok}/${summary.repos_attempted} repos completed · scanner ${esc(summary.repos.find((r) => r.scanner)?.scanner?.name ?? '?')} ${esc(summary.repos.find((r) => r.scanner)?.scanner?.version ?? '')}</div>

<div class="tiles">
${tile('Recall', pct(t.recall), `${t.vuln_detected} of ${t.vuln_total} known vulns`)}
${tile('Recall, SAST-detectable', pct(t.recall_sast_detectable), `${t.sast_detectable_detected} of ${t.sast_detectable_total}`)}
${tile('Precision', pct(t.precision), `${t.findings_by_classification.tp} TP · ${t.findings_by_classification.fp} FP`)}
${tile('False-positive rate', pct(t.false_positive_rate), `${t.safe_flagged} of ${t.safe_total} safe spots flagged`)}
${tile('AI fixes verified', pct(f.end_to_end_rate), `${f.verified} of ${f.attempted} attempted`)}
</div>

${section('Key findings', `<ul class="insights">${buildInsights(summary, analyses).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`)}
${section('Per repository', `${legend()}${table(['Repo', 'GT entries', 'Findings', 'Finding classification', 'Recall', 'Precision', 'FPR', 'Clone / scan', 'Fixes verified', 'Status'], repoRows)}`)}
${section('Detection by category', table(['Category', 'Known', 'Detected', 'Loose', 'Recall', 'Safe flagged'], catRows))}
${section(`Missed vulnerabilities a SAST tool should find (${missed.length})`, table(['Repo', 'Category', 'Location', 'Description'], missedRows))}
${section(`False positives (${fps.length})`, table(['Repo', 'Rule', 'Location', 'Why counted', 'Severity'], fpRows))}
${section('Rules, noisiest first', table(['Rule', 'Total', 'TP', 'FP', 'Unlabeled', 'Out of scope', 'Precision'], ruleRows))}
${section(
  'AI fix pipeline',
  f.attempted
    ? `<p class="muted">Generated ${f.generated}/${f.attempted} · verified ${f.verified}/${f.verification_attempted} · median fix ${ms(f.median_fix_latency_ms)} · median verification ${ms(f.median_verify_latency_ms)}</p>${table(['Repo', 'Finding', 'Class', 'Generated', 'Diff −/+', 'Red flags', 'Verification'], fixRowsHtml)}`
    : '<p class="muted">No fixes attempted in this run.</p>'
)}
${section('Method and caveats', `<ol class="method">${methodNotes(summary).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`)}
</main>
</body>
</html>`;
}

// ---------------------------------------------------------------- entry points

export async function writeReports(outDir, summary) {
  const analyses = await loadAnalyses(outDir, summary);
  // fix_records are needed for the per-fix tables but are kept out of summary.json
  for (const r of summary.repos) {
    const file = path.join(outDir, 'repos', r.id, 'fixes.json');
    r.fix_records = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : [];
  }
  const md = path.join(outDir, 'report.md');
  const html = path.join(outDir, 'report.html');
  await writeFile(md, renderMarkdown(summary, analyses));
  await writeFile(html, renderHtml(summary, analyses));
  for (const r of summary.repos) delete r.fix_records;
  return [md, html, path.join(outDir, 'summary.json')];
}

async function rematch(outDir, cacheDir) {
  const catalog = await loadCatalog();
  const prior = JSON.parse(await readFile(path.join(outDir, 'summary.json'), 'utf8'));
  const results = [];
  for (const row of prior.repos) {
    const resultFile = path.join(outDir, 'repos', row.id, 'result.json');
    const result = JSON.parse(await readFile(resultFile, 'utf8'));
    result.repo = catalog.find((r) => r.id === row.id) ?? result.repo;
    if (result.status === 'ok') {
      const report = JSON.parse(await readFile(path.join(outDir, 'repos', row.id, 'scan.json'), 'utf8'));
      const checkoutDir = path.join(cacheDir, row.id);
      await ensureCheckout(result.repo.url, checkoutDir, result.head_sha);
      const gt = await loadGroundTruth(result.repo, checkoutDir);
      const entries = await resolveEntries(gt, checkoutDir);
      const analysis = analyze({ findings: enrichFindings(report), gt, entries, lineTolerance: prior.run.options?.lineTolerance ?? 2 });
      result.gt_meta = gtMeta(gt, entries);
      result.metrics = analysis.metrics;
      await writeFile(path.join(outDir, 'repos', row.id, 'analysis.json'), JSON.stringify(analysis, null, 2));
      await writeFile(resultFile, JSON.stringify(result, null, 2));
      console.log(`[${row.id}] re-scored: recall ${pct(analysis.metrics.recall)}, precision ${pct(analysis.metrics.precision)}`);
    }
    results.push(result);
  }
  const summary = buildSummary({ ...prior.run, rematched_at: new Date().toISOString() }, results);
  await writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { rematch: { type: 'boolean', default: false }, 'cache-dir': { type: 'string', default: DEFAULT_CACHE_DIR } },
  });
  const resultsRoot = path.join(BENCHMARK_ROOT, 'results');
  const outDir = path.resolve(positionals[0] ?? path.join(resultsRoot, (await readFile(path.join(resultsRoot, 'LATEST'), 'utf8')).trim()));
  const summary = values.rematch ? await rematch(outDir, values['cache-dir']) : JSON.parse(await readFile(path.join(outDir, 'summary.json'), 'utf8'));
  for (const f of await writeReports(outDir, summary)) console.log(f);
}
