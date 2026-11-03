# SecureScanAI benchmark report

Run `2026-11-03T04-34-25-874` (smoke test of harness) · SecureScanAI `4e356f6c33` (uncommitted changes) · 2/2 repos completed

## Key findings

- Semgrep detected 9 of 46 known vulnerabilities (19.6%); 9 of 31 that a static scanner could reasonably find (29.0%).
- Complete blind spots (0 detected, 2+ known): hardcoded-secret (5), xss (4), info-disclosure (3), jwt (3), xxe (2), authz (2), file-upload (2).
- False-positive rate on deliberately safe code: 1/5 (20.0%).
- Noisiest rules: github-actions/github-actions-mutable-action-tag (0 FP, 11 out-of-scope).
- AI fixes: none of 4 could be generated (auth-error ×4), so the fix and verification stages were not exercised in this run.
- 3 findings duplicate an already-reported file:line (overlapping rulesets), inflating the raw count by 10.0%.

## Headline metrics

| Metric | Value | Basis |
|---|---|---|
| Recall | 19.6% | 9/46 known vulns, type-matched |
| Recall (SAST-detectable only) | 29.0% | 9/31 |
| Recall incl. loose matches | 19.6% | 9/46 |
| Precision (labeled findings) | 82.4% | 14 TP / 3 FP |
| False-positive rate (safe code) | 20.0% | 1/5 safe entries flagged |
| Youden index (TPR − FPR) | n/a | needs ≥30 safe samples (have 5); run owasp-benchmark-java |
| Findings | 30 | 27 distinct file:line |
| AI fix end-to-end success | 0.0% | 0/4 verified |

## Per repository

| Repo | Lang | GT | Findings | Recall | Precision | FPR | Clone | Scan | Fixes verified | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| dsvw | python | 29 (complete) | 10 | 15.4% (4/26) | 66.7% | 33.3% | 4.0 s | 12.1 s | 0/2 | ok |
| vulnerable-flask-app | python | 22 (complete) | 20 | 25.0% (5/20) | 90.9% | 0.0% | 4.0 s | 20.1 s | 0/2 | ok |

## Detection by category

| Category | Known | Detected | Loose | Missed | Recall | Safe flagged | FPR |
|---|---|---|---|---|---|---|---|
| sqli | 4 | 1 | 0 | 3 | 25.0% | 0/2 | 0.0% |
| hardcoded-secret | 5 | 0 | 0 | 5 | 0.0% | - | n/a |
| xss | 4 | 0 | 0 | 4 | 0.0% | - | n/a |
| deserialization | 2 | 2 | 0 | 0 | 100.0% | 1/1 | 100.0% |
| info-disclosure | 3 | 0 | 0 | 3 | 0.0% | - | n/a |
| jwt | 3 | 0 | 0 | 3 | 0.0% | - | n/a |
| ssti | 3 | 2 | 0 | 1 | 66.7% | - | n/a |
| xxe | 2 | 0 | 0 | 2 | 0.0% | 0/1 | 0.0% |
| authz | 2 | 0 | 0 | 2 | 0.0% | - | n/a |
| file-upload | 2 | 0 | 0 | 2 | 0.0% | - | n/a |
| path-traversal | 1 | 0 | 0 | 1 | 0.0% | 0/1 | 0.0% |
| ssrf | 2 | 1 | 0 | 1 | 50.0% | - | n/a |
| authn | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| cmdi | 1 | 1 | 0 | 0 | 100.0% | - | n/a |
| code-injection | 1 | 1 | 0 | 0 | 100.0% | - | n/a |
| csrf | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| dos | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| file-inclusion | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| header-injection | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| insecure-cookie | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| misconfig | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| open-redirect | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| weak-hash | 1 | 1 | 0 | 0 | 100.0% | - | n/a |
| weak-random | 1 | 0 | 0 | 1 | 0.0% | - | n/a |
| xpath | 1 | 0 | 0 | 1 | 0.0% | - | n/a |

## Missed vulnerabilities a SAST tool should find

| Repo | Entry | Category | Location | Description |
|---|---|---|---|---|
| dsvw | dsvw-sqli-id | sqli | `dsvw.py:22-22` | Blind/UNION SQL injection via ?id concatenated into SELECT |
| dsvw | dsvw-xss-reflected | xss | `dsvw.py:25-25` | Reflected XSS / frame injection / clickjacking payload via ?v written into HTML |
| dsvw | dsvw-path-traversal | path-traversal | `dsvw.py:29-29` | Path traversal / source code disclosure via ?path opened directly |
| dsvw | dsvw-ssrf-path | ssrf | `dsvw.py:29-29` | SSRF: ?path containing :// is fetched server-side |
| dsvw | dsvw-xxe | xxe | `dsvw.py:33-33` | XXE: lxml parser with load_dtd/resolve_entities/no_network=False on ?xml |
| dsvw | dsvw-xpath | xpath | `dsvw.py:35-35` | Blind XPath injection via ?name |
| dsvw | dsvw-sqli-comment | sqli | `dsvw.py:42-42` | SQL injection: ?comment %-formatted into INSERT |
| dsvw | dsvw-xss-stored | xss | `dsvw.py:46-46` | Stored XSS: comments rendered into HTML table unescaped |
| dsvw | dsvw-file-inclusion | file-inclusion | `dsvw.py:48-48` | Remote/local file inclusion: ?include opened or fetched as program source |
| dsvw | dsvw-ssti | ssti | `dsvw.py:55-55` | Server-side template (format-string) injection via ?tmpl with os module in scope |
| dsvw | dsvw-xss-jsonp | xss | `dsvw.py:59-59` | JSONP callback XSS: ?callback echoed as executable JavaScript |
| dsvw | dsvw-sqli-login | sqli | `dsvw.py:61-61` | Login bypass SQL injection / HTTP parameter pollution via password |
| dsvw | dsvw-weak-session-id | weak-random | `dsvw.py:62-62` | Session ID generated with non-cryptographic random.choices |
| dsvw | dsvw-open-redirect | open-redirect | `dsvw.py:70-70` | Unvalidated redirect via ?redir into Location header |
| dsvw | dsvw-header-injection | header-injection | `dsvw.py:74-74` | HTTP response splitting via ?charset in Content-Type header |
| vulnerable-flask-app | vfa-secret-hmac | hardcoded-secret | `app/app.py:26-26` | Hardcoded (and trivially guessable) JWT HMAC key |
| vulnerable-flask-app | vfa-secret-hmac-2 | hardcoded-secret | `app/app.py:27-27` | Second hardcoded HMAC key |
| vulnerable-flask-app | vfa-secret-key | hardcoded-secret | `app/app.py:28-28` | Hardcoded Flask secret_key (session signing) |
| vulnerable-flask-app | vfa-default-admin | hardcoded-secret | `app/app.py:62-63` | Default admin account with hardcoded password |
| vulnerable-flask-app | vfa-jwt-hardcoded-verify | jwt | `app/app.py:86-86` | JWT verified with the hardcoded 'secret' key |
| vulnerable-flask-app | vfa-jwt-hardcoded-sign | jwt | `app/app.py:184-184` | JWT signed with the hardcoded 'secret' key |
| vulnerable-flask-app | vfa-jwt-no-verify | jwt | `app/app.py:97-97` | JWT decoded without signature verification (used by /get/<cust_id>) |

## False positives

| Repo | Rule | Location | Why counted | Severity |
|---|---|---|---|---|
| dsvw | lang/use-defused-xml | `dsvw.py:2` | not-in-complete-ground-truth | ERROR |
| dsvw | lang/avoid-pickle | `dsvw.py:10` | flagged-known-safe (dsvw-safe-pickle-dumps) | WARNING |
| vulnerable-flask-app | html-templates/var-in-href | `app/templates/index.html:12` | not-in-complete-ground-truth | WARNING |

## Rules, noisiest first

| Rule | Total | TP | FP | Unlabeled | Out of scope | Precision | Repos |
|---|---|---|---|---|---|---|---|
| github-actions/github-actions-mutable-action-tag | 11 | 0 | 0 | 0 | 11 | n/a | dsvw, vulnerable-flask-app |
| lang/avoid-pickle | 2 | 1 | 1 | 0 | 0 | 50.0% | dsvw |
| lang/use-defused-xml | 1 | 0 | 1 | 0 | 0 | 0.0% | dsvw |
| security/missing-user-entrypoint | 1 | 0 | 0 | 0 | 1 | n/a | vulnerable-flask-app |
| security/missing-user | 1 | 0 | 0 | 0 | 1 | n/a | vulnerable-flask-app |
| html-templates/var-in-href | 1 | 0 | 1 | 0 | 0 | 0.0% | vulnerable-flask-app |
| flask/dangerous-template-string | 2 | 2 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |
| flask/render-template-string | 2 | 2 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |
| lang/dynamic-urllib-use-detected | 1 | 1 | 0 | 0 | 0 | 100.0% | dsvw |
| lang/subprocess-shell-true | 1 | 1 | 0 | 0 | 0 | 100.0% | dsvw |
| lang/exec-detected | 1 | 1 | 0 | 0 | 0 | 100.0% | dsvw |
| django/raw-html-format | 1 | 1 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |
| flask/raw-html-format | 1 | 1 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |
| lang/insecure-hash-algorithm-md5 | 1 | 1 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |
| lang/md5-used-as-password | 1 | 1 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |
| flask/tainted-sql-string | 1 | 1 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |
| flask/insecure-deserialization | 1 | 1 | 0 | 0 | 0 | 100.0% | vulnerable-flask-app |

## AI fix pipeline

| Stage | Count | Rate |
|---|---|---|
| Attempted | 4 | |
| Fix generated | 0 | 0.0% |
| Verified (finding gone on re-scan) | 0 | n/a of verified attempts |
| Verified with no red flags | 0 | |
| Verification FAILED (still detected) | 0 | |
| Verification errors | 0 | |

Median fix latency n/a, median verification n/a.

Generation errors: auth-error ×4.

| Repo | Finding | Class | Generated | Diff (−/+) | Red flags | Verification |
|---|---|---|---|---|---|---|
| dsvw | lang/subprocess-shell-true `dsvw.py:31` | tp | no: OpenRouter request failed (401): {"error":{"message":"API key expired… | - | - | - |
| dsvw | lang/dynamic-urllib-use-detected `dsvw.py:7` | tp | no: OpenRouter request failed (401): {"error":{"message":"API key expired… | - | - | - |
| vulnerable-flask-app | flask/dangerous-template-string `app/app.py:103` | tp | no: OpenRouter request failed (401): {"error":{"message":"API key expired… | - | - | - |
| vulnerable-flask-app | flask/tainted-sql-string `app/app.py:261` | tp | no: OpenRouter request failed (401): {"error":{"message":"API key expired… | - | - | - |

## Method and caveats

- Each repo is scanned through the public backend API (submit → poll → report), exactly as the UI does. The harness keeps its own checkout of the same commit to resolve ground-truth line anchors and to measure fix diffs.
- A finding is a true positive when it is in the same file, within 2 lines of a known vulnerability, and its CWE-derived category matches (or is closely related to) the vulnerability's category. Same place with an unrelated category is a "loose" match: counted separately, never as a TP.
- False positives come from two sources: findings on code labeled deliberately safe (all repos), and any unmatched in-scope finding for repos whose ground truth is marked complete. For other repos unmatched findings are "unlabeled": review them and promote real issues into ground truth, then re-score with `report.js --rematch`.
- OWASP Benchmark uses its own scoring rules: exact category match per test-case file; findings of other categories are ignored.
- "SAST-detectable" marks vulnerabilities a static scanner can reasonably be expected to see (injection sinks, weak crypto, secrets). Logic flaws such as IDOR, CSRF, or missing rate limits are listed for completeness but excluded from that recall figure.
- Fix verification only checks that the same Semgrep rule no longer fires on that file. It does not prove the fix is correct, compiles, or preserves behavior. Red flags (large rewrite, shrunk file, truncated context) mark fixes that likely silenced the scanner by deleting code or were produced from a truncated file.
- Upstream repos move. Ground-truth entries carry an anchor string and are relocated automatically when line numbers drift; entries whose anchor disappears are reported as stale and excluded from scoring.
