# PicklePro — Test Results

Run date: 2026-10-12 · Branch: `qa-suite` · Environment: Windows laptop, Node v24.19.0, local MongoDB 9.0 (isolated test databases). Production: read-only smoke checks only.

## 1. Scenario statistics (actual)
| Category | Created | Implemented (automated) | Executed | Pass | Fail | Blocked | Not run |
|---|---|---|---|---|---|---|---|
| Unit | 139 | 139 | 139 | 139 | 0 | 0 | 0 |
| API | 346 | 346 | 346 | 346 | 0 | 0 | 0 |
| Draw engine | 259 | 259 | 259 | 259 | 0 | 0 | 0 |
| Concurrency / race | 30 | 30 | 30 | 30 | 0 | 0 | 0 |
| Database integrity & recovery | 45 | 45 | 45 | 45 | 0 | 0 | 0 |
| Security | 89 | 89 | 89 | 89 | 0 | 0 | 0 |
| SIT (HTTP + sockets + DB, predictions, viewers, import, config, caches) | 78 | 78 | 78 | 78 | 0 | 0 | 0 |
| Original regression suite | 23 | 23 | 23 | 23 | 0 | 0 | 0 |
| **Automated total** | **1,009** | **1,009** | **1,009** | **1,009** | **0** | 0 | 0 |
| Performance (load, stress, spike, soak) | 15 | 15 (script) | 15 | 15 | 0 | 0 | 0 |
| Production read-only smoke | 14 | — | 14 | 14 | 0 | 0 | 0 |
| Manual / physical-device (TEST_PLAN §4) | 12 | — | 0 | — | — | 0 | **12** |
| Browser E2E automation (Playwright) | — | — | — | — | — | **Blocked**: no browser-automation dependency installed; key journeys were exercised earlier in the in-app browser and are listed as manual cases | — |

Final command and output: `cd server && npm test` → `tests 1009, pass 1009, fail 0` (≈ 134 s).

**Failure history retained:** during this session the first runs failed 34 scenarios (UNIT 8, API 12, RACE 7, SEC 3, SIT 2, plus the test-runner discovery issue). After analysis, 5 were product defects that were fixed (below); the rest were test-design mistakes that were corrected (e.g. a test that assumed a result while a previous 1.5 s spin was still running, a URL the client normalises before sending, an expectation that an empty settings update should fail). No test was skipped or weakened to pass; every fixed defect has regression tests.

## 2. Product changes made because of failing tests
| Area | Change | Regression tests |
|---|---|---|
| Name uniqueness | `cleanName` now applies Unicode NFC and removes invisible characters (zero-width, soft hyphen, BOM, bidi/control), so look-alike names can't be entered twice | UNIT-021…028, API players "duplicate via zero-width / decomposed accent", SIT import |
| Unknown API paths | answered 401 when anonymous (login check ran on every `/api` path); now the check is per host route, unknown paths → 404 | API unknown-* (16), API health/kids |
| Prediction input types | a nickname/name sent as an object was stored as "[object Object]"; now must be text | SEC injection nickname, SIT predict "name as number" |
| Read scalability | `GET /state` rebuilt state from Mongo on every request (≈ 420 req/s ceiling locally); now served from a cache refreshed on every change (never stale after a change, never early); leaderboard ranking cached per change | SIT cache-* (4) + all existing state/leaderboard tests |
| Client load | switch badges polled both draws every 20 s → every 60 s and only when visible; leaderboard refresh after a reveal spread over ~1.5 s | build + manual |
| Test runner | `npm test` also executed helper and load-test files; now runs only `test/**/*.test.js` | run output |

## 3. Data integrity (verified)
- Invariants checked after every pick and every race: each player on at most one team; one-by-one rounds fill a prefix of teams (no gaps); assigned counts match; placed players leave the pool.
- Duplicate assignments prevented at **two** levels: the server's one-at-a-time processing + stale-team guard, and unique MongoDB indexes (verified directly: `(tournament, round, team)` and `playerId` for live picks, `(tournament, sequence)`, `(tournament, nameKey)`, guesses).
- Restart recovery: committed picks, undo history and a mid-spin reveal (main and kids) survive restarts; 3 restarts in a row leave state identical; sessions survive restarts.
- Database outage: health → 503; a draw during the outage fails with a generic error and leaves no partial pick; drawing resumes after reconnect.
- **Limitation (by design):** the processing lock is in memory — correct for the single Render instance; not safe for multiple instances (would need Mongo transactions).

## 4. Performance (local, isolated — not production capacity)
Environment: same laptop, server in-process, local MongoDB. Free Render has far less CPU, so treat these as upper bounds, not promises.

| Phones connected | Connect p50 / p95 (ms) | Draw ack (ms) | Reveal reaches all phones p50 / p95 / max (ms) | Missed | State correct |
|---|---|---|---|---|---|
| 10 | 82 / 86 | 29 | 65 / 65 / 65 | 0 | yes |
| 25 | 125 / 133 | 36 | 64 / 65 / 65 | 0 | yes |
| 50 | 215 / 228 | 21 | 71 / 74 / 74 | 0 | yes |
| 100 | 216 / 250 | 70 | 77 / 79 / 79 | 0 | yes |
| 250 | 178 / 194 | 57 | 67 / 71 / 71 | 0 | yes |
| 500 | 148 / 169 | 101 | 88 / 101 / 102 | 0 | yes |
| **1,000** | 142 / 159 | 193 | 166 / 191 / 194 | 0 | yes |

HTTP `GET /api/state` (keep-alive clients, 8 s each):
| Concurrency | Before cache: req/s, p95 | After cache: req/s, p50 / p95 / p99 (ms) | Errors |
|---|---|---|---|
| 1 | 72, 16 ms | 75, 15 / 17 / 20 | 0 |
| 10 | 374, 35 ms | 1,749, 5 / 9 / 26 | 0 |
| 50 | 421, 145 ms | 2,325, 17 / 35 / 134 | 0 |
| 100 | 442, 275 ms | 2,363, 33 / 68 / 267 | 0 |
| `/leaderboard` 100 | — | 2,555, 31 / 45 / 337 | 0 |

- **Spike:** 500 phones opening at once all connected in 1.8 s; next reveal reached all (p95 147 ms), 0 missed.
- **Soak:** 90–150 s with 100 steady phones, 580–960 churn connections and a draw every 3 s: 0 draw errors; heap flat (≈ 51 MB start → 51 MB end, max ≈ 100 MB during churn); no listener accumulation.
- Highest concurrency tested: **1,000 simultaneous Socket.IO viewers** (local). Not tested on Render (rule: no load on production); the free instance's CPU will be the first bottleneck — test a staging service if you expect hundreds of phones.

## 5. Security (non-destructive)
- Verified: every host route in both events rejects missing / forged / foreign-secret / expired / malformed cookies (110 cases); cookie HttpOnly + SameSite=Strict + 12 h, Secure in production; brute-force limit (10 failures → 429, per IP, reset on success); forged socket events (12 kinds × 2 events) change nothing and aren't relayed; reactions whitelisted, rate-limited, never cross events; Mongo-operator-shaped inputs rejected or ignored; formula-like names exported as plain text (no Excel formula); safe export filenames; helmet headers present, no `x-powered-by`; REST API grants no cross-origin reads; no `.env` tracked, no credentials in git history (README placeholder only), 0 secret patterns in the built and live bundles; errors are `{ error }` without stack traces or DB details.
- Known, accepted: Socket.IO accepts any origin (broadcast-only by design; clients can only send whitelisted reactions); host login is shared via Vercel's IP for rate limiting (documented fallback: Render URL); single shared host password.
- Not executed: authenticated penetration testing against production, dependency CVE audit (`npm audit` not run in this session).

## 6. Production smoke (read-only, 2026-10-12)
Health `{"ok":true,"db":"up"}`; main state LIVE / kids DRAFT, no pending data leaked; anonymous `/admin`, `/tournaments`, `/export.xlsx` (both events) and `POST /draw` → 401; CSP / nosniff / frame headers present; live bundle 0 secret patterns; manifest and service worker 200. (Production still runs the previous build — the fixes above are not deployed.)

## 7. Reproduce
```bash
cd server && npm test                                   # 1,009 scenarios
node --test --test-reporter=tap "test/**/*.test.js" > run.tap   # raw results for the catalogue
node --expose-gc perf/load.mjs 120                      # local performance run
```

## 8. Outstanding
- 12 manual physical-device cases (TEST_PLAN §4) — especially iPhone/Android audio and real multi-phone viewer counts.
- No automated browser E2E (Playwright not installed — add it only if you want UI regression automation).
- Load on a staging Render service (to know real free-tier capacity).
- `npm audit` / dependency review.

## 9. Production-readiness decision
**READY WITH CONDITIONS.** All 1,009 automated scenarios pass; data-integrity, concurrency, reveal-secrecy, restart and security checks have direct evidence; the fixes found are low-risk and covered by regression tests. Conditions: deploy the `qa-suite` fixes after review, complete the manual device checks (audio, multi-phone), keep to one Render instance, and set up UptimeRobot / open the site before the event because of free-tier cold starts.
