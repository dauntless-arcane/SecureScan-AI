# SecureScanAI benchmark report

Run `2026-11-03T04-37-35-393` (vulpy scan-only check) · SecureScanAI `4e356f6c33` (uncommitted changes) · 1/1 repos completed

## Key findings

- Semgrep detected 11 of 31 known vulnerabilities (35.5%); 11 of 21 that a static scanner could reasonably find (52.4%).
- Complete blind spots (0 detected, 2+ known): sqli (4), authn (4), insecure-cookie (2), csrf (2).
- False-positive rate on deliberately safe code: 3/20 (15.0%).
- 4 findings duplicate an already-reported file:line (overlapping rulesets), inflating the raw count by 16.7%.

## Headline metrics

| Metric | Value | Basis |
|---|---|---|
| Recall | 35.5% | 11/31 known vulns, type-matched |
| Recall (SAST-detectable only) | 52.4% | 11/21 |
| Recall incl. loose matches | 35.5% | 11/31 |
| Precision (labeled findings) | 78.6% | 11 TP / 3 FP |
| False-positive rate (safe code) | 15.0% | 3/20 safe entries flagged |
| Youden index (TPR − FPR) | n/a | needs ≥30 safe samples (have 20); run owasp-benchmark-java |
| Findings | 24 | 20 distinct file:line |
| AI fix end-to-end success | n/a | 0/0 verified |

## Per repository

| Repo | Lang | GT | Findings | Recall | Precision | FPR | Clone | Scan | Fixes verified | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| vulpy | python | 51 | 24 | 35.5% (11/31) | 78.6% | 15.0% | 10.0 s | 12.1 s | - | ok |

## Detection by category

| Category | Known | Detected | Loose | Missed | Recall | Safe flagged | FPR |
|---|---|---|---|---|---|---|---|
| sqli | 4 | 0 | 0 | 4 | 0.0% | 0/11 | 0.0% |
| hardcoded-secret | 9 | 4 | 0 | 5 | 44.4% | - | n/a |
| authn | 4 | 0 | 0 | 4 | 0.0% | - | n/a |
| debug-mode | 4 | 4 | 0 | 0 | 100.0% | - | n/a |
| weak-random | 1 | 0 | 0 | 1 | 0.0% | 0/3 | 0.0% |
| xss | 2 | 2 | 0 | 0 | 100.0% | 2/2 | 100.0% |
| csrf | 2 | 0 | 0 | 2 | 0.0% | - | n/a |
| insecure-cookie | 2 | 0 | 0 | 2 | 0.0% | - | n/a |
| mass-assignment | 1 | 0 | 0 | 1 | 0.0% | 0/1 | 0.0% |
| weak-hash | 0 | 0 | 0 | 0 | n/a | 0/2 | 0.0% |
| cmdi | 0 | 0 | 0 | 0 | n/a | 1/1 | 100.0% |
| jwt | 1 | 1 | 0 | 0 | 100.0% | - | n/a |
| path-traversal | 1 | 0 | 0 | 1 | 0.0% | - | n/a |

## Missed vulnerabilities a SAST tool should find

| Repo | Entry | Category | Location | Description |
|---|---|---|---|---|
| vulpy | vb-sqli-login | sqli | `bad/libuser.py:12-12` | Login SQL injection (str.format into SELECT) |
| vulpy | vb-sqli-create | sqli | `bad/libuser.py:25-25` | User creation SQL injection (%-format into INSERT) |
| vulpy | vb-sqli-chpasswd | sqli | `bad/libuser.py:53-53` | Password change SQL injection |
| vulpy | vb-weak-random-apikey | weak-random | `bad/libapi.py:14-14` | API key derived from Mersenne Twister random.getrandbits |
| vulpy | vb-path-injection-keygen | path-traversal | `bad/libapi.py:16-22` | Username interpolated into /tmp glob and file path (traversal / deleting other users' keys) |
| vulpy | vb-cookie-flags | insecure-cookie | `bad/libsession.py:7-7` | Session cookie without HttpOnly/Secure/SameSite |
| vulpy | vg-sqli-user-create | sqli | `good/libuser.py:61-61` | Hardened version still %-formats username into INSERT |
| vulpy | vg-hardcoded-fernet | hardcoded-secret | `good/libsession.py:9-9` | Hardcoded Fernet session-encryption key |
| vulpy | vg-cookie-flags | insecure-cookie | `good/libsession.py:32-34` | Session cookie without HttpOnly/Secure/SameSite |
| vulpy | vg-jwt-secret | hardcoded-secret | `good/libapi.py:10-10` | Hardcoded JWT signing secret |

## False positives

| Repo | Rule | Location | Why counted | Severity |
|---|---|---|---|---|
| vulpy | lang/dangerous-subprocess-use-tainted-env-args | `bad/brute.py:21` | flagged-known-safe (vb-safe-brute-subprocess) | ERROR |
| vulpy | flask/template-unescaped-with-safe | `bad/templates/messages.html:8` | flagged-known-safe (vb-safe-flash-messages) | WARNING |
| vulpy | flask/template-unescaped-with-safe | `good/templates/messages.html:8` | flagged-known-safe (vg-safe-flash-messages) | WARNING |

## Rules, noisiest first

| Rule | Total | TP | FP | Unlabeled | Out of scope | Precision | Repos |
|---|---|---|---|---|---|---|---|
| lang/request-with-http | 4 | 0 | 0 | 4 | 0 | n/a | vulpy |
| flask/template-unescaped-with-safe | 4 | 2 | 2 | 0 | 0 | 50.0% | vulpy |
| cryptography/crypto-mode-without-authentication | 2 | 0 | 0 | 0 | 2 | n/a | vulpy |
| lang/dangerous-subprocess-use-tainted-env-args | 1 | 0 | 1 | 0 | 0 | 0.0% | vulpy |
| flask/avoid_hardcoded_config_SECRET_KEY | 4 | 4 | 0 | 0 | 0 | 100.0% | vulpy |
| flask/avoid_using_app_run_directly | 4 | 0 | 0 | 0 | 0 | n/a | vulpy |
| flask/debug-enabled | 4 | 4 | 0 | 0 | 0 | 100.0% | vulpy |
| jwt/jwt-python-hardcoded-secret | 1 | 1 | 0 | 0 | 0 | 100.0% | vulpy |

## AI fix pipeline

_No fixes attempted in this run (--max-fixes 0)._

## Method and caveats

- Each repo is scanned through the public backend API (submit → poll → report), exactly as the UI does. The harness keeps its own checkout of the same commit to resolve ground-truth line anchors and to measure fix diffs.
- A finding is a true positive when it is in the same file, within 2 lines of a known vulnerability, and its CWE-derived category matches (or is closely related to) the vulnerability's category. Same place with an unrelated category is a "loose" match: counted separately, never as a TP.
- False positives come from two sources: findings on code labeled deliberately safe (all repos), and any unmatched in-scope finding for repos whose ground truth is marked complete. For other repos unmatched findings are "unlabeled": review them and promote real issues into ground truth, then re-score with `report.js --rematch`.
- OWASP Benchmark uses its own scoring rules: exact category match per test-case file; findings of other categories are ignored.
- "SAST-detectable" marks vulnerabilities a static scanner can reasonably be expected to see (injection sinks, weak crypto, secrets). Logic flaws such as IDOR, CSRF, or missing rate limits are listed for completeness but excluded from that recall figure.
- Fix verification only checks that the same Semgrep rule no longer fires on that file. It does not prove the fix is correct, compiles, or preserves behavior. Red flags (large rewrite, shrunk file, truncated context) mark fixes that likely silenced the scanner by deleting code or were produced from a truncated file.
- Upstream repos move. Ground-truth entries carry an anchor string and are relocated automatically when line numbers drift; entries whose anchor disappears are reported as stale and excluded from scoring.
