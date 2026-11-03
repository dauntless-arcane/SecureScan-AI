# SecureScanAI benchmark

Automated accuracy testing for SecureScanAI. This tool runs the real backend against intentionally vulnerable open-source repos, scores each finding against a ground-truth answer key, samples AI fixes, and writes a Markdown and HTML report.

```
repos.json ──► run.js ──► backend API (submit → poll → report → fix → verify)
                 │
                 ├─ own checkout of the same commit (anchor resolution, fix diffs)
                 ├─ ground-truth/*.json  or  extractors/*.js
                 └─ results/<timestamp>/  summary.json · report.md · report.html · repos/<id>/*
```

## Quick start

```bash
# 1. Start the backend (pick one)
docker compose up --build backend          # Linux container, recommended
npm run backend:dev                        # native; needs git + semgrep on PATH

# 2. Run the fast tier (2 small Python repos, about 1 minute + fix time)
npm run benchmark -- --tier smoke

# 3. Open the report
#    test/benchmark/results/<timestamp>/report.html
```

Other useful runs:

```bash
npm run benchmark -- --list                         # catalog
npm run benchmark -- --tier core --max-fixes 5      # 9 repos
npm run benchmark -- --repos vulpy,juice-shop       # specific repos
npm run benchmark -- --tier core --max-fixes 0      # scan + scoring only (no LLM cost)
npm run benchmark:validate -- --show                # check ground truth against real code
npm run benchmark:report -- --rematch               # re-score latest run with current ground truth
```

Run `node test/benchmark/run.js --help` to see every option.

## Corpus

| Tier | Repo | Language | Ground truth |
|---|---|---|---|
| smoke | DSVW | Python | hand-authored, **complete** (26 vuln + 3 safe) |
| smoke | we45 Vulnerable-Flask-App | Python/Flask | hand-authored, **complete** (20 vuln + 2 safe) |
| core | vulpy (bad/ + good/) | Python/Flask | hand-authored (30 vuln + 18 safe) |
| core | dvpwa, pygoat, NodeGoat, dvna, vulnerable-node | Py / JS | scan-only for now |
| core | OWASP Juice Shop | TypeScript | extracted from the repo's `vuln-code-snippet` markers (partial) |
| full | OWASP Benchmark Java | Java | extracted from `expectedresults-1.2.csv` (2,740 labeled cases) |
| full | WebGoat, DVWA, RailsGoat, dvws-node, Tiredful-API, vulnpy | mixed | scan-only |

Tiers are cumulative: `core` includes `smoke`, and `full` includes everything.

## Scoring

For each finding, in this order:

| Class | Rule |
|---|---|
| `out-of-scope` | file outside the ground truth's `scope` (CI workflows, Dockerfiles, vendored code, tests) |
| `tp` | same file, within `--line-tolerance` lines (default 2) of a **vuln** entry, and category compatible |
| `fp` | same as above but the entry is labeled **safe**, *or* unmatched in a repo whose ground truth is `complete` |
| `loose` | right place, unrelated category (e.g. CWE metadata mismatch). Never counted as a TP |
| `unlabeled` | unmatched in a repo with partial ground truth. Needs human triage |
| `ignored` | unmatched under OWASP Benchmark's scoring rules |

A finding only credits the nearest entries, so one finding can't count for two adjacent vulnerabilities.

The category comes from the finding's CWE metadata (`lib/taxonomy.js`), falling back to rule-id keywords. Closely related categories are treated as compatible, e.g. SSTI ≈ code injection ≈ XSS, and weak-hash ≈ weak-crypto. OWASP Benchmark sets `strict_categories`, so it uses exact matching.

**Metrics.**
- Recall = detected vuln entries / vuln entries.
- Recall (SAST-detectable) excludes logic flaws such as IDOR, CSRF, and rate limits.
- Precision = TP / (TP + FP) over labeled findings.
- False-positive rate = safe entries flagged / safe entries.
- Youden = TPR − FPR, shown only with at least 30 safe samples.

**AI fixes.** Each repo gets up to `--max-fixes` fixes. TPs are fixed first, highest severity first, rotating across categories. Every fix is re-verified by the backend, and the harness diffs it against the original file to flag `large-rewrite`, `file-shrunk`, `no-change`, and `context-truncated` (the primary file exceeds the backend's 60 KB context limit).

## Ground-truth format

```jsonc
{
  "repo_id": "dsvw",
  "commit": "9ca3c9a…",              // commit the entries were written against
  "complete": true,                    // every real issue in scope is listed
  "unmatched_policy": "fp",            // fp | unlabeled | ignore
  "scope": { "include": ["dsvw.py"], "exclude": [] },
  "entries": [
    {
      "id": "dsvw-cmdi", "status": "vuln",          // vuln | safe
      "file": "dsvw.py", "lines": [31, 31],         // omit lines = whole file
      "category": "cmdi", "cwe": [78],
      "sast_detectable": true,
      "anchor": "\"nslookup \" + params[\"domain\"], shell=True",
      "title": "OS command injection via ?domain"
    }
  ]
}
```

`anchor` is a substring of the vulnerable line. When upstream code moves, the entry is relocated to the nearest line that contains the anchor. If the anchor disappears, the entry is reported as stale and excluded from scoring. Run `npm run benchmark:validate -- --show` after editing; it prints the real source line behind every entry.

**Adding a repo.**
1. Add it to `repos.json`.
2. Write `ground-truth/<id>.json`, or an extractor in `extractors/` that exports `extract(checkoutDir) → groundTruth`.
3. Validate it.

**Triage loop for partial ground truth.**
1. Open the `unlabeled` findings in `results/<run>/repos/<id>/analysis.json`.
2. Add real issues as `vuln` entries and false alarms as `safe` entries.
3. Run `npm run benchmark:report -- --rematch` to re-score without re-scanning.

## Known limitations

- The backend's 30 s clone timeout and 180 s scan timeout (`backend/src/services/scanService.js`) are too short for Juice Shop (about 49 s to clone here) and OWASP Benchmark (about 240 MB). Those repos show up as `scan-failed` until the timeouts are raised.
- Running the backend natively on Windows can produce incomplete checkouts of repos with deep paths (Juice Shop's frontend) because the backend's `git clone` doesn't set `core.longpaths`. Docker avoids this.
- The backend always scans the default branch HEAD. The harness records the HEAD SHA before and after each scan and warns if it moved.
- Verification only proves that the same Semgrep rule stops firing. It doesn't prove the fix is correct.
- Harness clones are cached in `$BENCHMARK_CACHE_DIR`, or `<os temp>/securescanai-benchmark-cache` by default. They're kept outside the repo and OneDrive on purpose.
