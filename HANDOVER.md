# PicklePro — Handover

Live team-draw ("auction") app for the **ICC Pickleball** tournaments, built & developed by **SP Tech**. The host runs the draw on one device; everyone else watches the same spin live on their phones (and optionally a projector). One app runs **two auction modes**:

| Mode | Teams | Rounds (in order) | Each team gets |
|---|---|---|---|
| **Main draw** | 28 | A (shuffled in one go) → Women → B → C (D optional; any order) | one player per category |
| **Kids draw** | 4 | Icon Boy (shuffled in one go) → Boy → Girl 1 → Girl 2 | 1 Icon Boy + 1 Boy + 2 Girls |

> Keep this file current. Every change to the app gets an entry in the [Change log](#change-log) at the bottom.

---

## 1. Links

| Who | Link | Notes |
|---|---|---|
| **Everyone (phones)** | https://pickle-pro-peach.vercel.app | Watch live. **Main draw / Kids draw** switch at the top. |
| **Host / admin** | https://pickle-pro-peach.vercel.app/admin | Log in, set up, Shuffle / Spin / Finalize, PDF / Excel / gallery. Same switch at the top. |
| Projector / TV (optional) | https://pickle-pro-peach.vercel.app/screen | Big-screen view with QR code; follows the same mode (`?draw=kids`). |
| Backup (full app) | https://picklepro-api.onrender.com (+ `/admin`) | Use if Vercel is down. |
| Health check | https://picklepro-api.onrender.com/api/health | `{"ok":true,"db":"up"}` = server + database fine. |
| Repository | https://github.com/sidhjain31/PicklePro | Push to `main` deploys everything. |

- The switch changes mode **in place, without reloading** (so sound stays on) and adds `?draw=kids` to the URL — a refresh or a shared link opens the same mode. Older links `/kids`, `/kids/admin`, `/kids/screen` still work.
- **Host password:** the `ADMIN_PASSWORD` environment variable in Render (dashboard → `picklepro-api` → Environment). One login works for both modes. Local development uses `server/.env`.
- **Contacts shown in the app** (top strip + footer, from one list in `client/src/Brand.jsx`): Sidh Jain 90671 27688, Pinkesh Valdria 96536 72196; WhatsApp enquiries → Sidh (`wa.me/919067127688`, prefilled "Hi SP Tech, I would like to enquire about your website and application development services.").

---

## 2. How the draw works (both modes)

- **Server-authoritative.** Every random pick is made on the server with Node's `crypto.randomInt` (Fisher–Yates for shuffle rounds) — the operating system's cryptographically secure generator with unbiased ranges. Browsers only animate the result.
- **Shuffle rounds** (A in the main draw, Icon Boy for kids) place the whole list onto every team in one action. The players of the first shuffle round are shown as each team's **🏓 Captain**.
- **Every other round** draws **one player per spin** for the next team: Team 1, Team 2, … in order.
- A round must be **Finalized** (every team filled) before the next starts. Finalized rounds never change.
- **Undo** removes only the latest spin in the current round; it stays in the history as *Undone*.
- **Each pick is saved before it is shown**, hidden from every screen (and from `/api/state`) until the spin ends, and survives refresh / reconnect / server restart (pending reveals are rescheduled on boot).
- **No double draws:** one action at a time on the server, stale/double clicks rejected (the client must name the team it thinks is next), and unique database indexes as the last guard.
- **Lists:** no name may appear twice anywhere in a tournament (case/spaces ignored). A list must hold exactly the players its rounds will place before its first draw (main: 28 per category; kids: Icon Boy 4, Boy 4, **Girls 8** — Girl 1 and Girl 2 both draw from the one Girls list; Girl 2 uses the 4 left after Girl 1). A list can be edited until its first round starts.
- **Provably fair (commit–reveal):** when a spin starts the server publishes `commitment = SHA-256("PicklePro|v1|actionId|category|team=name;…|key")` with a fresh 256-bit secret key, revealed only after the spin. The **host page** recomputes it and shows ✅ Verified fair (audience and projector don't show the seal — owner's choice). Commitment + key for every pick are in the Excel *Draw History*.
- **Separate events.** The main and kids draws have separate tournaments, player lists, predictions, leaderboards, viewer counts and live (Socket.IO) rooms. Both can run at the same time; neither can see or affect the other.

### What the audience sees during a draw
1. **Round walk-out**: "NEXT ROUND · Girl 1 · One spin per team" card + that round's jingle.
2. **Countdown** 3 → 2 → 1 → GO! while the remaining names fly by (skipped if spin length < 4 s or the screen joined mid-spin).
3. **Slot machine**: two pickleball paddles, a rally ball in its own strip above the reel (smooth parabola on GPU transforms), names scrolling at 13 per second.
4. **Slow-down + near-miss** on every one-by-one spin: the reel either stalls one name short then slides on, or slips just past then settles back (chosen from the draw id so every screen matches). It always ends on the server's pick.
5. **Winner card** ("SMASH!", confetti, bell). Shuffle rounds deal one card per team instead.
6. **Captain** line, and on the last round a **Team complete** card with the whole team.
7. **Trophy moment** on Finalize ("Girl 1 locked in! 🏆").
8. The team board updates; a cell still landing on that phone shows `???` (no spoilers anywhere: board, ticker, now-bar, follow card).

### Sound (all synthesized in `client/src/sound.js`, no audio files)
- **Pure mechanical slot machine:** lever spring + gear catch → motor hum and reel mechanism whirr that slows into distinct clacks → mechanical near-miss shudder → heavy thunk, ringing bell, coin cascade. Plus a soft paddle "pock" only when the ball reaches a paddle, a quiet crowd murmur, a drumroll for the last ≤ 3 names, round jingles, whistle + trophy on Finalize.
- **Tap for sound** (browser rule). Audio is unlocked inside the tap (incl. iPhone silent-switch handling). All sound goes through one master volume: **mute stops everything instantly**, including scheduled notes.
- **Resume:** after a refresh or coming back from another app, if the phone paused audio a **"🔈 Tap to resume sound"** button appears (bottom of the screen); one tap restores it. Switching Main/Kids does **not** pause sound (no reload).

### Audience page (top to bottom)
1. Header: big ICC logo, tournament name, LIVE, and "👀 N watching" under LIVE.
2. Slim SP Tech strip: tap-to-call **Sidh** and **Pinkesh**, "By SP Tech", compact green **WhatsApp us** pill.
3. **Main draw | Kids draw** switch (LIVE / Done badges).
4. Round steps → stage (team, captain, reel, result) → **latest picks ticker** (last 5).
5. **⭐ Know your team** — type your name; your team appears as a chain of seats (filled = player, 🎰 = being drawn now, 🔔 = arriving soon) with the **Team alert** message: everyone following that team gets a buzz + pop-up the moment a new teammate is drawn ("New teammate: X joined Team 7!"); "🎉 You're in Team N!" when you're drawn.
6. **🔮 Predict the pick** — pick who goes to the next team from the **Pending in <round>** list (search, tap to pick, change until the reel stops; saved only after the server confirms). Below it an always-visible **🏆 Leaderboard** box: top 3, "You: #N", **See full leaderboard (N players)**. Hidden if the host closes predictions.
7. **All teams** with **🔍 Find a player's team** (matches glow, jump buttons) and the ⭐ tag on your team.
8. Footer: "Built & developed by SP Tech", "Turning Ideas into Experiences", Sidh + Pinkesh call cards, WhatsApp pill.
- Floating: **reaction bar** 🔥 😂 👏 🎉 😱 ❤️ (everyone's reactions float on every phone of the same draw), sticky **"Now drawing"** bar when the stage scrolls off screen, screen kept awake during a live draw, buzz on every reveal (Android; iPhones don't allow web vibration).

### Viewer count rule ("👀 N watching")
Distinct **audience browsers** with a live connection, per draw. Each browser sends a random id (localStorage) with its connection; refreshes, reconnects and extra tabs in the same browser count once; host (`/admin`) and projector (`/screen`) are excluded; dead phones drop out within ~20 s. It counts browsers, not people. Hidden when ≤ 1.

### Host page (`/admin`)
- **Switch** Main draw / Kids draw at the top (one login for both).
- **Setup** (before start): name, spin length; main draw = choose categories + order; kids draw = **fixed format card**. Player lists per list (paste one per line or **Import .xlsx / .csv**), readiness (e.g. Icon Boy 4/4, Boy 4/4, Girls 8/8), **Start draw**.
- **Draw**: big button *Shuffle … → Finalize … → Spin for Team N → Finalize …*; **Undo last draw**; **Export Excel**; **PDF report**; **Audience predictions open/closed** switch; links to Audience view and Big screen (in the current mode).
- **When complete**: Download PDF report, Teams gallery image, Export Excel.
- Below: edit lists not yet drawn, Draw history, **Past tournaments** (export any earlier one, per mode), **Start a new tournament** (per mode).

### Spreadsheet import
First sheet of an `.xlsx`, or a `.csv`. Row 1 = list names, names underneath, one per cell.
- Main: `A`, `Women` (or `Ladies`), `B`, `C`, `D` (also `A Player`, `Category B` …). Sample: [`samples/sample-players.xlsx`](samples/sample-players.xlsx).
- Kids: `Icon Boy` (or `Icon`), `Boy` / `Boys`, `Girl` / `Girls`.

### Exports (follow the selected mode)
- **PDF report** (built in the browser, revealed picks only): A4 landscape, ICC header; page 1 = all teams × rounds (kids: Team | Icon Boy | Boy | Girl 1 | Girl 2); page 2 = every player A–Z with round and team; fairness note in the footer.
- **Excel**: *Final Teams* + *Draw History* (timestamp, round, sequence, player, team, event/action ids, Final/UNDONE, fairness commitment + key). Main: `/api/export.xlsx`, kids: `/api/kids/export.xlsx` (host cookie).
- **Teams gallery image**: one 1920×1080 PNG of all teams in the ICC theme (kids: 4 large cards). Download only — no share buttons by request.

---

## 3. Architecture

| Part | Tech | Hosted on |
|---|---|---|
| `client/` | React 19 + Vite 8 PWA (`vite-plugin-pwa`), `socket.io-client`, `qrcode`, `jspdf` + `jspdf-autotable` | Vercel project `pickle-pro` (team `sp-tech3`), root dir `client` |
| `server/` | Node 22.12+ / Express 5 / Socket.IO 4 / Mongoose 9 / ExcelJS / Helmet | Render free web service `picklepro-api` (`render.yaml`) |
| Database | MongoDB | Atlas M0 (production), local MongoDB 9.0 service (development) |

- Vercel rewrites `/api/*` (incl. `/api/kids/*`) to Render (`client/vercel.json`). Socket.IO connects straight to Render (`VITE_SOCKET_URL`).
- Render also builds and serves the client, so its URL is a full backup site.
- **Events:** each tournament has `event` = `main` (default; older documents without the field are main) or `kids`. Routes are mounted twice: `/api/kids/*` (kids) before `/api/*` (main). Sockets send `auth: { role, viewer, event }` and join room `event:<name>`; state, spins, reactions and viewer counts go only to that room.
- Socket.IO clients can only send emoji `reaction`s (whitelisted, rate limited, relayed to their own draw). Nothing a client sends can start, choose or change a draw.

### Key files
| File | What it does |
|---|---|
| `server/src/models.js` | Schemas + indexes; `LABELS`, `SHORT` codes, `SHUFFLE` rounds, `poolOf` (Girl 1/2 → Girls list), `EVENTS` (main/kids formats) |
| `server/src/draw.js` | The draw engine (every function takes the event): snapshot, public/admin state (`needed`, `ready`, `recent`…), rules, lock, reveal scheduling, archive |
| `server/src/server.js` | `eventApi(ev)` routes, auth routes, health, static client, Socket.IO rooms + per-event viewer counts |
| `server/src/crowd.js` | Reactions relay, `submitGuess`, `leaderboard` (per event) |
| `server/src/auth.js` | Password login, signed HttpOnly cookie, failed-login rate limit |
| `server/src/excel.js` | Excel export (any tournament) and spreadsheet import (main + kids headers) |
| `server/test/draw.test.js`, `server/test/qa/*.test.js` | 1,009 automated scenarios (unit, API, draw engine, race, DB, security, SIT) — see `TEST_PLAN.md`, `TEST_CASES.md`, `TEST_RESULTS.md` |
| `server/perf/load.mjs` | Local load / stress / spike / soak script (isolated DB only) |
| `client/src/event.js` | Current mode (`getEvent`, `setEvent`, `useEvent`), API base, per-mode storage keys, URLs |
| `client/src/main.jsx` | Picks the page (`/admin`, `/screen`, audience) and remounts it when the mode switches |
| `client/src/DrawSwitch.jsx` | Main draw / Kids draw tabs with LIVE / Done badges |
| `client/src/useLive.js` | Live connection, cached state, spin phases, announcements, viewer count |
| `client/src/Stage.jsx` | Reel (frame loop, near-miss), rally ball, paddles, countdown, winner/team cards, sound toggle, resume-sound prompt |
| `client/src/sound.js` | All audio (mechanical slot, effects, unlock/mute/resume logic); `fx.js` = confetti + re-export |
| `client/src/Audience.jsx` | Reactions, predictions + leaderboard box, announcements |
| `client/src/Follow.jsx` | Know your team (seat chain + alerts), team search, wake lock |
| `client/src/NowBar.jsx` | Latest picks ticker + sticky now-drawing bar |
| `client/src/Brand.jsx` | SP Tech strip + footer, contacts, WhatsApp link |
| `client/src/Admin.jsx` | Login, setup (event-aware), controls, prediction switch, history, archive |
| `client/src/Board.jsx`, `Live.jsx`, `Screen.jsx` | Team board; audience page; projector |
| `client/src/report.js`, `gallery.js`, `fair.js` | PDF report; gallery PNG; browser-side fairness check |
| `client/src/styles.css`, `audience.css` | Styling (palette from the ICC logo) |

### Database collections
- **tournaments** — event, name, status (`DRAFT`/`LIVE`/`COMPLETED`), teamCount (28 / 4), categories (round order), currentIndex, spinMs, predictions (on/off). The newest document **per event** is that event's active tournament; older ones are its archive.
- **players** — tournamentId, category (= list: A, WOMEN, B, C, D, ICON, BOY, GIRL), name, nameKey. Unique on (tournamentId, nameKey).
- **drawevents** — the source of truth: actionId, sequence, category (round), teamNumber, playerId, playerName, revealAt, voided, commitment, salt. Unique on sequence and (non-voided) on team-per-round and on player.
- **guesses** — tournamentId, category, teamNumber, voterId, nickname, playerName. Unique per (tournament, round, team, voter).

### API (main at `/api`, kids at `/api/kids` — same routes)
Public: `GET /state`, `POST /guess`, `GET /leaderboard[?voter=]` — plus shared `GET /api/health`, `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/logout`.
Host cookie: `GET /admin`, `PATCH /tournament`, `POST /tournaments`, `GET /tournaments`, `PUT /players`, `POST /players/import`, `POST /start`, `POST /draw`, `POST /undo`, `POST /finalize`, `GET /export.xlsx[?tournament=]`.
Socket events (server → clients, per draw room): `viewers`, `tournament:state`, `draw:spinning`, `draw:revealed`, `draw:undone`, `category:finalized`, `reaction`. Client → server: `reaction`.

---

## 4. Running locally (Windows)

Prerequisites (set up on the dev laptop): Node 22.12+ (v24), MongoDB Community 9.0 as the `MongoDB` Windows service, `server/.env` with `MONGODB_URI`, `ADMIN_PASSWORD`, `SESSION_SECRET` (32+ chars).

```bash
npm run setup:dev     # first time: install server + client dependencies
npm run dev           # server :4000 + client :5173 together
npm test              # 1,009 server tests (isolated picklepro_qa_* / picklepro_test DBs)
npm run build         # client production build
```
- http://localhost:5173 (audience) · http://localhost:5173/admin (host) · add `?draw=kids` for the kids draw (or use the switch).
- Note: the repo lives in OneDrive; OneDrive syncing can make the server's `--watch` restart repeatedly or start slowly — just wait or restart it.

### Environment variables
| Variable | Where | Notes |
|---|---|---|
| `MONGODB_URI` | server | Required |
| `ADMIN_PASSWORD` | server | Required — the host login |
| `SESSION_SECRET` | server | Required, ≥ 32 chars (Render generates it) |
| `PORT` | server | Default 4000 |
| `TRUST_PROXY` | server | Default 1 (Render) |
| `NODE_ENV` | server | `production` → Secure cookies |
| `VITE_SOCKET_URL` | client build (Vercel) | `https://picklepro-api.onrender.com` |
| `TEST_MONGODB_URI` | tests | Optional |

---

## 5. Deploying

- **Normal path:** commit and push to `main` → Vercel (client) and Render (server) redeploy automatically (~2–5 min) and GitHub Actions CI runs the tests (`.github/workflows/test.yml`). Server changes only go live through a push.
- **Preview first (optional):** work on a branch, then from the repo root `vercel deploy --yes --scope sp-tech3 --build-env VITE_SOCKET_URL=https://picklepro-api.onrender.com` → preview link (Vercel login as SP TECH required; it uses the **production** server and data). Publish = merge the branch into `main` and push.
- Delete the `.env.local` that `vercel deploy` creates in the repo root (holds a Vercel token; git-ignored).
- Don't pass `--test-timeout` to the whole test run (in Node 22 it also limits the whole file, which takes ~40 s).

---

## 6. Event-day checklist

**Before (one-time)**
- [ ] Know the `ADMIN_PASSWORD` (Render → Environment).
- [ ] **UptimeRobot** (free): New monitor → HTTP(s) → `https://picklepro-api.onrender.com/api/health`, every 5 min, email alerts. Reduces cold starts but can't guarantee the free Render service never sleeps — open the site 15 min before.
- [ ] Atlas: database user has **readWrite on `picklepro` only**; strong password.

**Rehearsal (1–2 days before), for each draw you'll run**
- [ ] `/admin` → choose Main or Kids → import the lists (main: `samples/sample-players.xlsx`; kids: Icon Boy 4, Boy 4, Girls 8) → Save → Start → run the full draw.
- [ ] Audience link on 2–3 phones: all show the same spin; tap for sound; switch modes and back — sound stays on.
- [ ] Wi-Fi off/on on one phone → reconnects and catches up. Refresh host mid-spin → resumes.
- [ ] Export PDF and Excel; check them.
- [ ] **Start a new tournament** (in that mode) with the real name — the rehearsal moves to Past tournaments.

**On the day**
- [ ] 15 min before: open `/api/health` and `/admin` (wakes the server), log in, pick the mode, load the real lists → all counts green.
- [ ] Share **one** link: https://pickle-pro-peach.vercel.app (people use the switch).
- [ ] Run the draw. **Export Excel after each round** (Atlas M0 has no automatic backups). PDF + gallery at the end.

**If something goes wrong**
- *Connection lost* on host: draws pause until it reconnects; nothing is lost.
- Vercel down: use `https://picklepro-api.onrender.com` (+ `/admin`).
- Wrong pick: **Undo last draw** (current round only).
- No sound on a phone: tap **Tap for sound / Tap to resume sound**; check the phone's volume (and media volume on Android).
- Host login locked after many wrong passwords on Vercel (all Vercel visitors share one IP): log in on the Render URL.

---

## 7. Current state

**As of 2026-10-12**
- GitHub `main` = `3636a9b` — pushed; CI green; Render and Vercel serve it.
- Live: both auction modes (main 28 teams, kids 4 teams) behind one link with the reload-free switch; mechanical slot sound; resume-sound prompt; Know your team; leaderboard box; viewer count under LIVE; accurate viewer counting; compact SP Tech branding; prediction switch; PDF/Excel/gallery per mode.
- Tests: **23/23** pass locally and in CI; production build clean.
- Production data: main tournament untouched (the main event keeps its existing tournaments); a kids tournament is created automatically the first time the kids draw is opened (DRAFT, "Kids Team Draw").
- **Still needs a physical-device check:** the new mechanical sound on a real iPhone and Android phone (synthesized audio couldn't be listened to during development), and the viewer count with several real phones.
- **Not done:** UptimeRobot monitor (needs the owner's account — steps above).

### Known limits
- Single server instance only (processing lock and login limiter are in memory).
- Render free tier sleeps after 15 idle minutes and has a monthly hours limit.
- Atlas M0: no automatic backups — export Excel.
- Team counts are fixed per mode (28 main, 4 kids — `EVENTS` in `server/src/models.js`); kids format is fixed (1 Icon Boy, 1 Boy, 2 Girls per team).
- Saving a list replaces it non-transactionally (validated first, so failures are unlikely).
- Web vibration doesn't work on iPhones; the screen wake lock can be blocked by low-power mode.

### Ideas not built yet
Host "ready check" panel (server awake, test sound), real recorded slot sound files (would need licensed audio), big-screen winner spotlight, accessibility pass (larger text, screen-reader announcements), "You missed: …" catch-up after reconnecting, commentator voice, configurable team counts.

---

## Change log

Newest first. Add an entry for every change.

### 2026-10-12 — Category names M1/M2/M3/W1 and B1/G1/B2/G2, no captain, PDF fix
- Display names everywhere (chips, cards, stage, PDF, Excel, errors): main A=M1, B=M2, C=M3, WOMEN=W1 (D=M4); kids ICON=B1, GIRL1=G1, BOY=B2, GIRL2=G2. Database keys unchanged. New main tournaments default to M1, M2, M3, W1 order (host can still reorder in Setup).
- Excel import accepts M1 M2 M3 W1 / B1 G1 B2 G2 headers (old headers still work).
- Captain line removed from the stage and big screen.
- PDF: a tab opened before a redeploy asked for removed file names; Vercel answered with the page, so the PDF silently failed. Now /assets/* 404s, the app reloads itself once on such errors, and the PDF button shows a refresh message if it still fails.

### 2026-10-12 — Free-tier hardening for ~800 phones
- New socket connections get the cached public state (no DB read per phone joining).
- Reactions relayed at most 4 per 500 ms per event (taps x phones no longer floods the server).
- Phones connect over WebSocket first (polling only as fallback), halving connection work.

### 2026-10-12 — Instant prediction picks, brighter credit with Contact chip
- Predict: tapping a name locks it in on screen immediately; the save runs in the background and is rolled back with a message only if the server refuses (was a 1–3 s spinner on the free server).
- Top credit at full brightness on a subtle band; a "Contact" chip opens the Sidh / Pinkesh tap-to-call buttons; WhatsApp icon beside it.

### 2026-10-12 — Kids split categories, real slot sound, quieter branding
- Kids draw now has four separate lists drawn in this order: Boy Cat 1 (Icon, shuffled) → Girl Cat 1 → Boy Cat 2 → Girl Cat 2, 4 names each (was one shared Girls list of 8). Keys stay ICON / GIRL1 / BOY / GIRL2; a kids tournament still in DRAFT is switched to the new order automatically. Import headers: "Boy Cat 1", "Girl Cat 1", "Boy Cat 2", "Girl Cat 2" (old "Icon Boy" / "Boy" still work). Card codes B1 G1 B2 G2.
- Slot sound: the reel no longer uses filtered noise (the "shh" hiss). Each symbol box passing the window is a pitched mechanical knock (max 16/s), lever is a ratchet, softer motor hum; bells and coins unchanged.
- Branding: top strip is one quiet line "Powered by SP Tech" + small WhatsApp icon (tap the credit to show the call buttons); footer is a compact two-line credit. ICC logo bigger (88 / 112 / 72 px).

### 2026-10-12 — QA: 1,009 automated scenarios, fixes, load testing (branch `qa-suite`)
- New suites in `server/test/qa/` (unit 139, API 346, draw engine 259, race 30, DB 45, security 89, SIT 78) + original 23 = 1,009, all passing; `npm test` now runs only `test/**/*.test.js`. Docs: `TEST_PLAN.md`, `TEST_CASES.md` (generated from the real run), `TEST_RESULTS.md`.
- Fixes: Unicode-NFC + invisible-character stripping in `cleanName` (look-alike duplicate names), per-route host auth (unknown API paths now 404), text-only prediction nicknames/names, cached `GET /state` (≈5.5× throughput) and per-change leaderboard cache, client badge polling 60 s when visible + leaderboard fetch jitter.
- Local performance: 1,000 simultaneous viewers, reveal to all in < 200 ms p95, 0 missed; spike 500 phones in 1.8 s; soak flat. Not yet deployed.

### 2026-10-12 — HANDOVER rewritten
- Sections 1–7 rewritten to describe the app as it is now (two auction modes behind one link, mechanical sound, Know your team, leaderboard box, viewer rule, per-mode exports, event-aware architecture, API, checklist, current state). Change log kept below.

### 2026-10-12 — One link for both draws
- `client/src/DrawSwitch.jsx`: Main draw / Kids draw tabs (with LIVE / Done badges from each draw's status) on the audience and host pages. Switching swaps the page **in place without a reload** (`setEvent` in `client/src/event.js`; `App` remounts the page keyed by the mode, opening a new live connection for that draw), so sound that is on stays on in either mode; URL gets `?draw=kids` (refresh/back button keep the mode).
- Verified locally: sound stays on across a switch and the kids spin plays the slot sound start→finish; host Spin button works in kids mode; PDF (Team | Icon Boy | Boy | Girl 1 | Girl 2), gallery and Excel (`/api/kids/export.xlsx`) use the kids data; main draw untouched. Resume-sound prompt moved to the bottom (above the reaction bar).

### 2026-10-12 — Kids event, mechanical slot sound, Know your team, leaderboard box, resume sound
- **Kids event** (`EVENTS` in `server/src/models.js`): tournaments carry `event` ('main' default, so existing data is main); every engine function takes the event; routes mounted twice (`/api/kids`, `/api`); sockets join `event:<name>` rooms (state, spins, reactions, viewer counts per event). Kids format fixed: 4 teams, rounds ICON (shuffle) / BOY / GIRL1 / GIRL2; GIRL1+GIRL2 share the GIRL list (`poolOf`), which must hold 8 before Girl 1 and is locked once Girl 1 starts; Girl 2 uses what is left. Generalised: shuffle rounds (`SHUFFLE` = A, ICON), per-round `needed`, `ready`, `short` codes (IB, B, G1, G2). Excel import headers "Icon Boy", "Boy(s)", "Girl(s)"; export uses labels. Client: `client/src/event.js` (EVENT/BASE/API, per-event storage keys); host page reads categories/lists from the server; fixed-format card for kids. New test: full kids draw + isolation from the main event (23/23).
- **Sound**: arcade melody and beeping lever removed → pure mechanical slot (lever spring + gear catch, motor hum, reel mechanism whirr that slows into clacks, mechanical near-miss shudder, thunk + bell + coins).
- **Resume sound**: on returning to the app, audio resume is attempted; if the browser needs a tap, a floating "🔈 Tap to resume sound" appears (audience, projector, host).
- **Know your team** (renamed): team shown as a chain of seats (filled = player initials, empty = 🔔 "Arriving soon", current = 🎰 "Being drawn now"), plus a "Team alert is on" message: everyone following that team gets a buzz + pop-up when a new teammate is drawn. Board tag "⭐ Know your team".
- **Leaderboard** in Predict: always-visible box, top 3 shown, "You: #N", "See full leaderboard (N players)"; empty state explains scoring.
- **Header**: "👀 N watching" now sits under LIVE (no longer collides with the title).

### 2026-10-12 — Feedback fixes (branch `feedback-fixes`, preview first)
- **Sound** rebuilt (`client/src/sound.js`; `fx.js` now = confetti + re-export): one master gain + compressor; mute cancels every scheduled timer and long-running sound instantly; unlock inside the tap (silent buffer + `resume()`), `navigator.audioSession.type = 'playback'` so the iPhone silent switch doesn't mute it; honest toggle states (`on` / `off` / `locked` = "Tap to resume sound" after a refresh, resumed by the next tap anywhere); listens to context state changes. Diagnostics: `activeSounds()`.
- **Draw audio**: removed the per-name "tik" and the 1.4 s pock loop. New primary **casino slot-machine** sound modelled on the owner's reference (classic slot SFX), all original synthesis: **lever pull** (ratchet + clunk) → fast square-wave "bleep-bloop" arpeggio melody (look-ahead scheduled on the audio clock) over a soft mechanical reel rattle, both slowing with the reel; reel positions "clack" in the crawl → **near-miss** two-note slide → heavy reel **thunk**, ringing two-tone **jackpot bells** and a **coin cascade**. Paddle "pock" only on real paddle hits (`animationiteration`), soft, throttled. Crowd murmur and drumroll quieter.
- **Reel**: 13 rows/s; longer ease-out (3–5.2 s) ending in a deliberate near-miss on **every** one-by-one spin (`stall` one name short then slide on, or `overshoot` just past then settle back; chosen from the draw id so all screens match). Always ends on the server's winner (verified in the browser on 6 spins).
- **Viewer count** fixed (see counting rule above); new test covers 3 people, second tab, host/projector excluded, leave, refresh, close-one-tab, reconnect.
- **Branding**: ICC logo 68 px (84 px ≥ 760 px wide); slim top strip with tap-to-call Sidh/Pinkesh + compact WhatsApp pill (two rows on phones, one on desktop); footer keeps credit, tagline, contact cards, compact WhatsApp pill; one shared contact list.
- Tests 22/22, build OK, no console errors. Server part (viewer count) goes live only when merged to `main`.

### 2026-10-11 — CI fix (`8f5c151`)
- CI failed on `92d41c3` (all tests pass locally on Node 22 and 24); the timing-sensitive viewer-count test was made relative to the starting count and waits for updates instead of fixed sleeps. CI green again. (Note: don't pass `--test-timeout` to the whole run — in Node 22 it also limits the whole test file, which takes ~30 s.)

### 2026-10-11 — Audience polish: branding layout, smooth rally, tap game removed, prediction switch, faster taps
- **Branding**: tagline + WhatsApp moved into the top strip next to the SP Tech credit; developer credit + contact cards moved to the very bottom under all teams; contacts no longer duplicated; WhatsApp message updated; aria-labels, hover/pressed/focus states.
- **Smooth animation** (root causes fixed): the rally ball was one 5-stop keyframe path with per-segment easing (it decelerated at every corner) → now nested horizontal glide + vertical arc (parabola) on GPU transforms in its own strip above the reel; the reel re-rendered React every frame and blurred the names → now a frame loop writing `translate3d` and row text directly (no React renders while spinning), no blur; paddle swings (2.8 s) and pock sound (1.4 s) synced to the ball; removed paddle drop-shadow filter during the swing. Measured locally: median frame 16.7 ms, p95 16.8 ms, ball ≤ 7 px/frame, never over the names.
- **Removed** the tap battle / crowd spin entirely (UI, admin settings, socket `tap`, `TapScore`, `/api/tappers`, CSS, tests).
- **Prediction switch** on `/admin` (server-enforced, persisted, live-synced, records kept) + new test.
- **Join / pick lag**: nickname state moved inside the prediction card (Join no longer re-renders stage + 28 team cards; 28 ms locally), `Board` and `Stage` memoised, stable search Set, per-name "saving" spinner on the next frame, double-tap guard, "✓ Locked in" only after server confirmation, instant pressed states, `touch-action: manipulation`.
- Tests 22/22. Browser-verified locally (phone + desktop).

### 2026-10-11 — Viewer count, latest-picks ticker, sticky now-drawing bar
- Server: `recent` (last 5 non-A revealed picks) in public state; `viewers` count broadcast. New test (ticker order/exclusion, viewer count up and down) — 22/22.
- Client: `NowBar.jsx` (Ticker + NowBar), header viewer pill. Browser-verified locally on a phone viewport.

### 2026-10-09 — Follow your team, team search, keep awake, reveal buzz
- New `client/src/Follow.jsx`: follow-your-team card + toasts, team search, `useWakeLock`; `Board` takes `mine` / `matches`; reveal vibration in `Stage`.
- Browser-verified locally (phone viewport): follow by lowercase name, ⭐ tag on board, teammate-joined toast only after the reel landed, both vibrations, search highlight + jump, no console errors.

### 2026-10-09 — SP Tech card moved up, wording, name fix, seal hidden from audience
- SP Tech card now sits right below the games (above "All teams") with the WhatsApp button first: "For IT projects, reach us on WhatsApp" (prefilled IT-project message to Sidh).
- Name corrected to **Pinkesh Valdria**.
- "🔒 sealed / ✅ Verified fair" removed from audience phones and `/screen`; still on `/admin` (`Stage showSeal`). Fairness data still in Excel.

### 2026-10-09 — Professional audience page, tap battle, pending-player predictions
- Audience page redesigned: SP Tech credit strip + footer (`Brand.jsx`) with tap-to-call contacts and WhatsApp → Sidh (wa.me/919067127688); play-along cards (`panel-card`), "All teams" section; shared nickname (`useIdentity`).
- Tap battle: removed the 15-taps-per-round cap; taps now carry the player's nickname; round top-3 live (`crowd:taps.top`), tournament **Top tappers** leaderboard (`/api/tappers`, `TapScore`); human-speed limit 12/sec. Fixed: the final tally was lost when the spin fired.
- Predictions: dropdown replaced by a **Predict Team N** button opening the **Pending in <category>** list of tap-to-pick buttons with search.
- Tests 21/21 (crowd test rewritten for the tap game: one player can fill the meter, named vs anonymous taps, round leader, tournament leaderboard + rank, rate limit). Browser-verified locally on a phone viewport.

### 2026-10-09 — Audience round: reactions, predictions, crowd spin, stadium sounds
- **Sounds** (`fx.js`, all synthesized): crowd swell during the spin, cheer on reveal, rally that speeds up into a smash on the slow-down, per-category walk-out jingle, drumroll when ≤ 3 names remain, crowd "OHHH" on near-miss, referee whistle + trophy fanfare on Finalize, soft pop per reaction.
- **Live reactions** relayed to every phone and the projector (`server/src/crowd.js`, `Audience.jsx`).
- **Predict the pick** + leaderboard (`POST /api/guess`, `GET /api/leaderboard`, `Guess` model); guesses saved on the phone so they survive re-renders/refresh.
- **Crowd spin** host switch + target; taps start the next draw via the guarded `draw()`.
- **Near-miss tease** (deterministic per draw), **name fly-by** in the countdown, **Captain** line, **Team complete** card, **round / trophy announcements**, **teams gallery PNG** (download only, no WhatsApp).
- Fixed during testing: guesses vanished when the spin started (component remount) → persisted per tournament; guess rate limit was per IP (would block a whole venue on one Wi-Fi) → per viewer + global cap; leaderboard wording when nobody has scored.
- Tests 21/21 (new: reaction whitelist + rate limit, crowd spin off-by-default / exactly one draw / per-phone cap, predictions open/closed rules + scoring only after reveal + private voter ids). Browser-verified locally: walk-out, countdown + fly-by, trophy, deal, reactions from a second phone floating on this phone, crowd taps starting a spin, prediction ✅/❌, captain, team-complete card, gallery image; no console errors.
- Pushed as `78a062a`; CI green; live on Render + Vercel.

### 2026-10-09 — Pushed to GitHub (`c4cf8ec`)
- Committed all work since `8a1e840` and pushed together with the CI commit `3e9fc01`. Old saved GitHub token (no `workflow` scope) was cleared and the owner signed in again via browser.
- Render redeploy brings the provably-fair sealing live; Vercel rebuilt from GitHub (replaces the CLI-promoted build with identical code).

### 2026-10-09 — Provably fair draw, PDF report, real paddles
- **Provably fair:** server seals each draw with SHA-256 over the result + a fresh 256-bit key before the spin (`commitment` sent with `draw:spinning`/pending state), reveals the key afterwards; browsers verify and show ✅ Verified fair with details. Commitment/key stored on `DrawEvent`, shown in admin history data and Excel. New test proves sealing, no early key leak, verification and tamper detection. *(Server part goes live on next git push.)*
- **PDF report** for organizers (`client/src/report.js`, jsPDF): teams page + A–Z player index; buttons on host page.
- Machine paddles redrawn as **real pickleball paddles** (SVG), smaller swing, clipped to the stage.
- Tests 18/18. Promoted to production via Vercel CLI.

### 2026-10-09 — Countdown, big screen mode, sample file, handover
- 3-2-1-GO countdown with beeps before every spin/shuffle (client only; uses existing spin time).
- `/screen` projector view: giant machine, live 28-team picks list (1–14 | 15–28), category steps, QR code + join URL, auto-hiding cursor; **Big screen** link in host header; stage button renamed **⛶ Full screen**.
- Added `samples/sample-players.xlsx` and this `HANDOVER.md`.
- Promoted to production via Vercel CLI.

### 2026-10-09 — ICC theme and new slot machine
- ICC Pickleball logo → header, login, waiting/complete screens, favicon, PWA icons; palette from the logo.
- Paddle-framed reel, rally ball, tick/pock/fanfare sounds (synthesized), winner card with SMASH! stamp, confetti with pickleballs, A-category card deal, sound toggle, fullscreen.
- Default categories back to **A, Women, B, C** (D optional); test proving A shuffles in one go in any position.
- Promoted to production via Vercel CLI.

### 2026-10-09 — Cold-start messaging
- Host and audience pages show "Connecting… the server is waking up (up to a minute)" instead of a bare "Loading…"; login button shows "Logging in…".

### 2026-10-09 — Production hardening (commit `8a1e840`, pushed)
- `/api/health` reports MongoDB (503 when down).
- Past tournaments archive: list + per-tournament Excel export.
- Login rate limit counts only failed attempts.
- Cross-platform `npm run dev` (`scripts/dev.mjs`).
- Tests added: route auth sweep, cookie flags/logout, category locking + finalize order, audience socket can't mutate, upload validation, rate limit, archive, health.
- CI workflow `.github/workflows/test.yml` (commit `3e9fc01`, **not pushed** — token lacks `workflow` scope).
- Production verified: Render + Atlas + Vercel rewrite + Socket.IO origin + PWA.

### 2026-10-09 — Takeover and local setup
- Inspected the repository; installed MongoDB 9.0 locally; generated local `SESSION_SECRET`; baseline tests 7/7 passing.

### Before 2026-10-09 — Original build (Hriday)
- `5601948` first commit, `5570bcc` live draw client, deploy config and docs: complete draw engine, host/audience pages, Excel import/export, PWA, Render/Vercel config.
