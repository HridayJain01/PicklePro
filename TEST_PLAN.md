# PicklePro — Test Plan

Scope: the live team-draw app as implemented in this repository (main 28-team draw + kids 4-team draw, one link, host page, projector). Companion files: [`TEST_CASES.md`](TEST_CASES.md) (every executed scenario with its real status) and [`TEST_RESULTS.md`](TEST_RESULTS.md) (results, performance, security, readiness).

## 1. Safety rules followed
- All destructive, concurrent and load tests run **locally** against isolated databases (`picklepro_qa_<suite>`, `picklepro_test`, `picklepro_perf`) that are dropped at the start of each run. The load script refuses remote/`mongodb+srv` URIs.
- Production received **read-only** smoke checks only (health, public state, 401 checks, headers, bundle secret scan). No production draw, write or load.
- Fixes are on branch `qa-suite`; nothing is deployed without approval.

## 2. Application inventory (from the source, not the README)
| Feature | Role | Entry point | Backend / DB | Routes & events | Automated coverage | Main risks |
|---|---|---|---|---|---|---|
| Host login / session | Host | `/admin` login form | `auth.js`, HMAC cookie | `POST /api/auth/login`, `/logout`, `GET /auth/me` | API, SEC | brute force, forged/expired cookies |
| Draw setup (name, spin, categories) | Host | Setup card | `updateSettings`; tournaments | `PATCH /tournament` | API, DRAW | invalid values, editing after start |
| Player lists + import | Host | Players card | `savePlayers`, `parseUpload`; players | `PUT /players`, `POST /players/import` | UNIT, API, SIT | duplicates, look-alike names, bad files |
| Start / draw / undo / finalize | Host | Controls | `draw.js` engine; drawevents | `POST /start /draw /undo /finalize`, `draw:*`, `category:finalized` | DRAW, RACE, DB | double draws, skipped teams, early reveal |
| Kids format (Icon Boy, Boy, 2 Girls) | Host / audience | switch / `?draw=kids` | `EVENTS`, `poolOf` | `/api/kids/*`, socket room `event:kids` | DRAW, API, RACE, SIT | pool sharing, isolation from main |
| Hidden-until-reveal + fairness seal | All | stage | `revealAt`, commitment/salt | `GET /state`, `draw:spinning`, `draw:revealed` | SEC, UNIT, SIT | leaks via state/history/export/sockets |
| Restart / reconnect recovery | All | — | `resumePendingReveals` | socket reconnect | DB, SIT, RACE | lost or duplicated reveals |
| Predictions + leaderboard + host switch | Audience / host | Predict card | `crowd.js`; guesses | `POST /guess`, `GET /leaderboard`, `PATCH predictions` | SIT, API, RACE, SEC | early scoring, spam, closed state |
| Reactions | Audience | reaction bar | `crowd.js` relay | socket `reaction` | SEC, RACE | spam, cross-event, injection |
| Viewer count | Audience | header | `server.js` per-event maps | socket `viewers` | SIT, legacy | inflation by tabs/host/projector |
| Ticker / now-bar / captain / team-complete | Audience | stage | `publicState.recent`, `shuffle` flags | `GET /state` | SIT | spoilers |
| Excel / PDF / gallery | Host | Controls | `excel.js`; `report.js`, `gallery.js` | `GET /export.xlsx` | DB, SEC, legacy (+ manual PDF) | wrong data, formula injection |
| Archive / new tournament | Host | Past tournaments | `listTournaments` | `GET/POST /tournaments` | DB, API | cross-event access |
| Health | Ops | — | mongoose state | `GET /api/health` | API, DB | false "healthy" |
| PWA / deploy config | All | manifest, SW, Vercel, Render | `vite.config.js`, `vercel.json`, `render.yaml` | — | SIT (config), production smoke | stale cached draw data |
| Sound / animation / switch UI | Audience | browser only | `sound.js`, `Stage.jsx`, `event.js` | — | static checks + manual (below) | device audio policies |

## 3. Requirement → test traceability (examples; full list in TEST_CASES.md)
| Requirement | Tests |
|---|---|
| Exactly the required players before a round's first draw (28 main; kids 4/4/8) | API-start-*, DRAW order/kids-girls, legacy "player validation" |
| A shuffles all 28 teams in one go wherever it sits; Icon Boy likewise | DRAW main A, DRAW order *, DRAW kids ICON, legacy "A is shuffled…" |
| One-by-one rounds fill Team 1→N; no skips, no duplicates | DRAW pick 1–28 per round (with invariants), RACE different-teams |
| Rounds only in order; finalize required; finalized immutable | DRAW finalize/undo-into-finalized, RACE finalize+draw |
| Stale / ahead / wrong-team / wrong-round requests rejected | DRAW stale/ahead at positions 1,2,14,27,28; API draw fuzz |
| Concurrent clicks / tabs never double-assign | RACE 2–25 tabs, rapid clicks, undo/draw, finalize/draw, both events |
| DB refuses duplicate team/player picks even if the app failed | DB constraint-* |
| Survives restart; mid-spin reveal resumes | DB restart-*, legacy restart test |
| Result hidden until reveal everywhere | SEC reveal-* (state, admin history, Excel, leaderboard, sockets) |
| Undo only latest, history kept | DRAW undo-*, RACE undo, DB voided-kept |
| Exports match saved data | DB export-*, legacy export, SEC formula-as-text |
| Fairness detects tampering; browser = server | UNIT fairness-* |
| Host-only actions protected | API auth matrix (110), SEC forged sockets |
| Predictions rules / switch / rate limit | SIT predict-*, RACE guesses |
| Viewer count rule | SIT viewers-*, legacy viewer test |
| Look-alike names can't duplicate | UNIT cleanName NFC/zero-width, API players dup-*, SIT import |

## 4. Manual test cases (need real devices / a person)
| ID | Steps | Expected |
|---|---|---|
| MAN-001 | iPhone (Safari), silent switch ON: open audience link, tap "Tap for sound", run a spin | Mechanical reel sound, bell + coins at reveal |
| MAN-002 | iPhone: switch to another app for 30 s during a draw, return | "Tap to resume sound" appears; one tap restores sound |
| MAN-003 | Android (Chrome): sound on, mute mid-spin | Silence immediately; no sounds later until unmuted |
| MAN-004 | Any phone: sound on, switch Main ↔ Kids | Sound stays on (no reload), kids spin audible |
| MAN-005 | 3 real phones + projector: run 3 spins | Same spin and result on all; count shows 3 watching |
| MAN-006 | One phone: Wi-Fi off during a spin, on after the reveal | Reconnects, shows the result, no replayed spin |
| MAN-007 | Older/slow phone: 5 consecutive spins | Smooth reel and ball, near-miss visible, no stutter |
| MAN-008 | Install as app (Add to Home Screen), reopen | Opens the audience page; live data after reconnect |
| MAN-009 | Host: Download PDF report (main and kids) and open it | Correct teams/columns per mode, readable layout |
| MAN-010 | Host: tap Sidh / Pinkesh numbers and WhatsApp pill on a phone | Dialler with +91 90671 27688 / +91 96536 72196; WhatsApp chat with Sidh and the prefilled message |
| MAN-011 | Projector `/screen` at 1920×1080, F11 | No scrolling; reel, picks list, QR fit |
| MAN-012 | Screen reader / keyboard: tab through host controls | Visible focus, all controls reachable |

## 5. How to run
```bash
cd server
npm test                          # all 1,009 automated scenarios (needs local MongoDB on 127.0.0.1:27017)
node --test test/qa/engine.test.js  # one category
node --expose-gc perf/load.mjs 120  # local load/stress/spike/soak (isolated picklepro_perf DB); arg = soak seconds
```
Regenerate `TEST_CASES.md`: run with `--test-reporter=tap` and convert (see `TEST_RESULTS.md` §7).
