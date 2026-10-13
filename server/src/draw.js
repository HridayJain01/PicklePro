import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { ALL_POOLS, DrawEvent, EVENTS, LABELS, Player, SHORT, SHUFFLE, Tournament, eventOf, poolOf } from './models.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// ponytail: in-process lock serialises every mutation (both events). Correct because we run one
// server instance; a multi-instance deploy would need Mongo transactions instead.
let queue = Promise.resolve();
function locked(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

// Screens join one Socket.IO room per event, so each event only hears its own draw.
let io = null;
export const setIo = server => { io = server; };
export const roomOf = ev => `event:${eventOf(ev)}`;
const emit = (ev, name, data) => io?.to(roomOf(ev)).emit(name, data);
// Read cache for the public state: GET /state is served from the last computed state for up to
// 1 s. Every mutation and every reveal broadcasts a fresh state, which also refreshes this cache,
// so readers never see an older state than the live screens — and never anything early (the
// cached copy can only be MORE hidden, never less). Protects the server from 1,000 phones.
const STATE_TTL = 1000;
const stateCache = new Map(); // ev -> { at, value }
const epoch = new Map(); // ev -> bumps on every change (also used by the leaderboard cache)
export const changeEpoch = ev => epoch.get(eventOf(ev)) ?? 0;
export async function cachedPublicState(ev = 'main') {
  const hit = stateCache.get(eventOf(ev));
  if (hit && Date.now() - hit.at < STATE_TTL) return hit.value;
  const value = await publicState(undefined, ev);
  stateCache.set(eventOf(ev), { at: Date.now(), value });
  return value;
}
async function broadcast(ev) {
  try {
    epoch.set(eventOf(ev), changeEpoch(ev) + 1);
    stateCache.delete(eventOf(ev));
    const value = await publicState(undefined, ev);
    stateCache.set(eventOf(ev), { at: Date.now(), value });
    emit(ev, 'tournament:state', value);
  } catch (err) {
    console.error('broadcast failed', err);
  }
}

// Canonical form of a player name. Unicode NFC (so "é" typed two different ways is one name) and
// invisible characters removed (zero-width spaces/joiners, soft hyphens, BOM, bidi controls, other
// control characters — often pasted from WhatsApp/Excel), so look-alike names can't bypass the
// one-name-per-tournament rule. Whitespace runs collapse to one space.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F­​-‍⁠﻿‪-‮⁦-⁩]/g;
export const cleanName = value => String(value ?? '').normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
const keyOf = name => name.toLowerCase();
const modeOf = category => (SHUFFLE.has(category) ? 'shuffle' : 'spin');
export const isShuffle = category => SHUFFLE.has(category);

// Fisher–Yates with a CSPRNG.
export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const eventQuery = ev => (eventOf(ev) === 'main' ? { $or: [{ event: 'main' }, { event: { $exists: false } }] } : { event: eventOf(ev) });
const defaultsFor = ev => {
  const e = EVENTS[eventOf(ev)];
  return { event: eventOf(ev), teamCount: e.teamCount, categories: e.defaults };
};

export async function activeTournament(ev = 'main') {
  const t = await Tournament.findOne(eventQuery(ev)).sort({ _id: -1 });
  // A fixed-format event not yet started always uses the current format (e.g. new kids round order).
  const e = EVENTS[eventOf(ev)];
  if (t && e.fixed && t.status === 'DRAFT' && t.categories.join() !== e.defaults.join()) {
    t.categories = e.defaults;
    await t.save();
  }
  return t ?? Tournament.create({ name: eventOf(ev) === 'kids' ? 'Kids Team Draw' : 'Team Draw', ...defaultsFor(ev) });
}

// `tournamentId` reads an archived tournament of this event; by default it's the active one.
async function findTournament(id, ev) {
  const t = mongoose.isValidObjectId(id) && await Tournament.findOne({ _id: id, ...eventQuery(ev) });
  return t || fail(404, 'Tournament not found');
}

// Every tournament of the event, newest first; the first one is active, the rest are the archive.
export async function listTournaments(ev = 'main') {
  const [all, counts] = await Promise.all([
    Tournament.find(eventQuery(ev)).sort({ _id: -1 }).lean(),
    DrawEvent.aggregate([{ $match: { voided: false } }, { $group: { _id: '$tournamentId', n: { $sum: 1 } } }]),
  ]);
  const drawn = new Map(counts.map(c => [String(c._id), c.n]));
  return all.map((t, i) => ({
    id: String(t._id),
    name: t.name,
    status: t.status,
    active: i === 0,
    createdAt: t.createdAt,
    categories: t.categories,
    teamCount: t.teamCount,
    draws: drawn.get(String(t._id)) ?? 0,
  }));
}

export async function snapshot(tournamentId, ev = 'main') {
  const t = tournamentId ? await findTournament(tournamentId, ev) : await activeTournament(ev);
  const [players, events] = await Promise.all([
    Player.find({ tournamentId: t._id }).sort({ _id: 1 }).lean(),
    DrawEvent.find({ tournamentId: t._id }).sort({ sequence: 1 }).lean(),
  ]);
  const now = Date.now();
  const active = events.filter(e => !e.voided);
  return {
    t, players, events, active, now,
    revealed: active.filter(e => +e.revealAt <= now),
    pending: active.filter(e => +e.revealAt > now),
    current: t.status === 'LIVE' ? t.categories[t.currentIndex] : null,
  };
}

// Pools used by this tournament's rounds, and how many players each needs (teams × rounds sharing it).
const poolsOf = t => [...new Set(t.categories.map(poolOf))];
const neededFor = (t, pool) => t.teamCount * t.categories.filter(c => poolOf(c) === pool).length;
const inPool = (players, pool) => players.filter(p => p.category === pool);

// The exact text that is hashed. Clients rebuild it to verify; keep in sync with client/src/fair.js.
export const proofText = ({ actionId, category, assignments, salt }) =>
  `PicklePro|v1|${actionId}|${category}|${assignments.map(a => `${a.teamNumber}=${a.name}`).join(';')}|${salt}`;
export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');

// Only ever built from revealed events, so including the salt is safe.
const actionSummary = events => ({
  actionId: events[0].actionId,
  category: events[0].category,
  mode: modeOf(events[0].category),
  assignments: events.map(e => ({ teamNumber: e.teamNumber, name: e.playerName })),
  commitment: events[0].commitment ?? null,
  salt: events[0].salt ?? null,
});

// What the audience (and admin board) may see: nothing that is still behind a running spin.
export async function publicState(s, ev = 'main') {
  s ??= await snapshot(undefined, ev);
  const { t, players, revealed, pending, current } = s;
  const teams = Array.from({ length: t.teamCount }, (_, i) => ({ number: i + 1, players: {} }));
  for (const e of revealed) if (teams[e.teamNumber - 1]) teams[e.teamNumber - 1].players[e.category] = e.playerName;
  const assigned = new Set(revealed.map(e => String(e.playerId)));
  const countOf = c => revealed.filter(e => e.category === c).length;
  const filled = current ? countOf(current) : 0;
  const last = revealed.at(-1);
  return {
    id: String(t._id),
    event: eventOf(t.event),
    name: t.name,
    status: t.status,
    teamCount: t.teamCount,
    spinMs: t.spinMs,
    categories: t.categories.map((key, i) => ({
      key,
      label: LABELS[key],
      short: SHORT[key],
      shuffle: SHUFFLE.has(key),
      state: t.status === 'COMPLETED' || i < t.currentIndex ? 'done' : key === current ? 'active' : 'upcoming',
      players: inPool(players, poolOf(key)).length,
      needed: neededFor(t, poolOf(key)),
      assigned: countOf(key),
      // Same rule the server enforces before a draw (Girl 2 is ready once Girl 1 has started).
      ready: isReady(s, key),
    })),
    current,
    mode: current && modeOf(current),
    currentTeam: pending.length ? pending[0].teamNumber : current && filled < t.teamCount ? filled + 1 : null,
    remaining: current ? inPool(players, poolOf(current)).filter(p => !assigned.has(String(p._id))).map(p => p.name) : [],
    teams,
    pending: pending.length
      ? { actionId: pending[0].actionId, category: pending[0].category, mode: modeOf(pending[0].category), teamNumbers: pending.map(e => e.teamNumber), commitment: pending[0].commitment ?? null }
      : null,
    last: last ? actionSummary(revealed.filter(e => e.actionId === last.actionId)) : null,
    predictions: t.predictions !== false,
    // Last few one-by-one picks, newest first, for the audience ticker (revealed only).
    recent: revealed.filter(e => !SHUFFLE.has(e.category)).slice(-5).reverse()
      .map(e => ({ category: e.category, label: LABELS[e.category], teamNumber: e.teamNumber, name: e.playerName })),
  };
}

// A player list can change until any round drawing from it has started; finalized never change.
function isEditable({ t, active }, pool) {
  if (t.status === 'DRAFT') return true;
  if (t.status !== 'LIVE') return false;
  const rounds = t.categories.filter(c => poolOf(c) === pool);
  if (rounds.some(c => t.categories.indexOf(c) < t.currentIndex)) return false;
  return !active.some(e => rounds.includes(e.category));
}

export async function adminState(ev = 'main') {
  const s = await snapshot(undefined, ev);
  const e = EVENTS[eventOf(ev)];
  const pools = [...new Set(e.available.map(poolOf))];
  return {
    event: eventOf(ev),
    fixed: e.fixed,
    available: e.available.map(key => ({ key, label: LABELS[key], shuffle: SHUFFLE.has(key) })),
    pools: pools.map(key => ({ key, label: LABELS[key], needed: s.t.categories.some(c => poolOf(c) === key) ? neededFor(s.t, key) : null })),
    lists: Object.fromEntries(pools.map(c => [c, inPool(s.players, c).map(p => p.name)])),
    // Host only: age / contact from the organisers' spreadsheet, for the PDF report.
    details: Object.fromEntries(s.players.filter(p => p.age || p.phone).map(p => [p.name, { age: p.age ?? '', phone: p.phone ?? '' }])),
    editable: Object.fromEntries(pools.map(c => [c, isEditable(s, c)])),
    history: historyRows(s),
  };
}

export const historyRows = s => s.events
  .filter(e => +e.revealAt <= s.now)
  .map(e => ({
    sequence: e.sequence,
    at: e.createdAt,
    category: LABELS[e.category],
    teamNumber: e.teamNumber,
    player: e.playerName,
    eventId: String(e._id),
    actionId: e.actionId,
    voided: e.voided,
    commitment: e.commitment ?? '',
    salt: e.salt ?? '',
  }));

// Before a round's first draw its list must hold exactly the players its rounds will place;
// once any round of that list has drawn (Girl 1), the next one (Girl 2) uses what is left.
function isReady({ t, players, active }, c) {
  const pool = poolOf(c);
  const rounds = t.categories.filter(x => poolOf(x) === pool);
  if (active.some(e => rounds.includes(e.category))) return true;
  return inPool(players, pool).length === neededFor(t, pool);
}
function requireReady(s, c) {
  if (isReady(s, c)) return;
  const pool = poolOf(c);
  fail(400, `${LABELS[pool]} needs exactly ${neededFor(s.t, pool)} players (has ${inPool(s.players, pool).length})`);
}

const requireIdle = ({ pending }) => pending.length && fail(409, 'Wait for the current draw to finish');

function requireName(value) {
  const name = cleanName(value);
  if (!name || name.length > 100) fail(400, 'Name must be 1–100 characters');
  return name;
}

function scheduleReveal(actionId, ms, ev) {
  setTimeout(async () => {
    try {
      const events = await DrawEvent.find({ actionId, voided: false }).sort({ sequence: 1 }).lean();
      if (events.length) emit(ev, 'draw:revealed', actionSummary(events));
      await broadcast(ev);
    } catch (err) {
      console.error('reveal failed', err);
    }
  }, Math.max(0, ms) + 25); // fire just after revealAt so the state we broadcast includes the result
}

// After a server restart, finish broadcasting any spin that was mid-animation (in either event).
export async function resumePendingReveals() {
  const now = Date.now();
  const pending = await DrawEvent.find({ voided: false, revealAt: { $gt: new Date(now) } }).lean();
  const byAction = new Map(pending.map(e => [e.actionId, e]));
  for (const [actionId, e] of byAction) {
    const t = await Tournament.findById(e.tournamentId).lean();
    scheduleReveal(actionId, +e.revealAt - now, eventOf(t?.event));
  }
}

export const updateSettings = (body, ev = 'main') => locked(async () => {
  const { t } = await snapshot(undefined, ev);
  if (body.name !== undefined) t.name = requireName(body.name);
  if (body.spinMs !== undefined) {
    if (!Number.isInteger(body.spinMs) || body.spinMs < 0 || body.spinMs > 30000) fail(400, 'spinMs must be 0–30000');
    t.spinMs = body.spinMs;
  }
  if (body.predictions !== undefined) {
    if (typeof body.predictions !== 'boolean') fail(400, 'predictions must be true or false');
    t.predictions = body.predictions;
  }
  if (body.categories !== undefined) {
    const e = EVENTS[eventOf(ev)];
    if (e.fixed) fail(409, 'This event has a fixed draw format');
    if (t.status !== 'DRAFT') fail(409, 'Categories are locked once the draw starts');
    const c = body.categories;
    const valid = Array.isArray(c) && c.length && new Set(c).size === c.length && c.every(x => e.available.includes(x));
    if (!valid) fail(400, `Categories must be a non-empty list of ${e.available.join(', ')}`);
    t.categories = c;
  }
  await t.save();
  await broadcast(ev);
});

export const savePlayers = ({ lists, details } = {}, ev = 'main') => locked(async () => {
  if (!lists || typeof lists !== 'object' || Array.isArray(lists)) fail(400, 'lists must be an object');
  const s = await snapshot(undefined, ev);
  const allowed = new Set(EVENTS[eventOf(ev)].available.map(poolOf));
  const cats = Object.keys(lists);
  const cleaned = {};
  for (const c of cats) {
    if (!ALL_POOLS.includes(c) || !allowed.has(c)) fail(400, `Unknown category ${c}`);
    if (!isEditable(s, c)) fail(409, `${LABELS[c]} has already been drawn and can't be edited`);
    if (!Array.isArray(lists[c]) || lists[c].length > 200) fail(400, `${LABELS[c]} must be a list of at most 200 names`);
    cleaned[c] = lists[c].map(cleanName).filter(Boolean);
    const long = cleaned[c].find(n => n.length > 60);
    if (long) fail(400, `Name too long (max 60): "${long}"`);
  }
  // Check uniqueness against the final state: untouched lists plus the new lists.
  const seen = new Map(s.players.filter(p => !cats.includes(p.category)).map(p => [keyOf(p.name), p.category]));
  const errors = [];
  for (const c of cats) {
    for (const name of cleaned[c]) {
      const other = seen.get(keyOf(name));
      if (!other) seen.set(keyOf(name), c);
      else errors.push(other === c ? `"${name}" is listed twice in ${LABELS[c]}` : `"${name}" is in both ${LABELS[other]} and ${LABELS[c]}`);
    }
  }
  if (errors.length) fail(400, errors.slice(0, 10).join('\n'));
  // Age / contact: from this save's details (by name), else kept from the previous save.
  const known = new Map(s.players.map(p => [p.nameKey, { age: p.age, phone: p.phone }]));
  const given = new Map(details && typeof details === 'object' && !Array.isArray(details)
    ? Object.entries(details).map(([n, v]) => [keyOf(cleanName(n)), v]) : []);
  const extra = name => {
    const v = given.get(keyOf(name)) ?? known.get(keyOf(name)) ?? {};
    const text = (x, max) => (x === undefined || x === null || x === '' ? undefined : String(x).trim().slice(0, max));
    return { age: text(v.age, 10), phone: text(v.phone, 20) };
  };
  await Player.deleteMany({ tournamentId: s.t._id, category: { $in: cats } });
  await Player.insertMany(cats.flatMap(c => cleaned[c].map(name => ({ tournamentId: s.t._id, category: c, name, nameKey: keyOf(name), ...extra(name) }))));
  await broadcast(ev);
});

// Host: correct ages / contact numbers at any time (even after drawing). Matches players by name;
// never changes lists or results. Returns how many players were updated.
export const updateDetails = ({ details } = {}, ev = 'main') => locked(async () => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) fail(400, 'details must be an object');
  const s = await snapshot(undefined, ev);
  const byKey = new Map(s.players.map(p => [p.nameKey, p]));
  const text = (x, max) => (x === undefined || x === null ? undefined : String(x).trim().slice(0, max));
  let updated = 0;
  for (const [name, v] of Object.entries(details).slice(0, 500)) {
    const p = byKey.get(keyOf(cleanName(name)));
    if (!p || !v || typeof v !== 'object') continue;
    const set = {};
    if (v.age !== undefined) set.age = text(v.age, 10);
    if (v.phone !== undefined) set.phone = text(v.phone, 20);
    if (!Object.keys(set).length) continue;
    await Player.updateOne({ _id: p._id }, { $set: set });
    updated++;
  }
  return { updated };
});

export const createTournament = ({ name } = {}, ev = 'main') => locked(async () => {
  const s = await snapshot(undefined, ev);
  requireIdle(s);
  await Tournament.create({ ...defaultsFor(ev), name: requireName(name), categories: EVENTS[eventOf(ev)].fixed ? EVENTS[eventOf(ev)].defaults : s.t.categories, spinMs: s.t.spinMs });
  await broadcast(ev);
});

export const startDraw = (body, ev = 'main') => locked(async () => {
  const s = await snapshot(undefined, ev);
  if (s.t.status !== 'DRAFT') fail(409, 'The draw has already started');
  requireReady(s, s.t.categories[0]);
  s.t.status = 'LIVE';
  s.t.currentIndex = 0;
  await s.t.save();
  await broadcast(ev);
});

// The one draw engine. Shuffle rounds (A, Icon Boy): random permutation of the list onto every
// team in one action. Other rounds: one secure random pick for the next team. `team` is the team
// the admin's screen says is next; it only guards against double clicks and stale tabs, the
// server decides everything else.
export const draw = ({ category, team } = {}, ev = 'main') => locked(async () => {
  const s = await snapshot(undefined, ev);
  const { t, players, active, events, current } = s;
  if (t.status !== 'LIVE') fail(409, 'The draw is not live');
  if (category !== current) fail(409, `${LABELS[current]} is the active category`);
  requireIdle(s);
  requireReady(s, current);
  const filled = active.filter(e => e.category === current).length;
  if (filled >= t.teamCount) fail(409, `All ${t.teamCount} teams are filled — finalize ${LABELS[current]}`);
  if (team !== filled + 1) fail(409, `Team ${filled + 1} is next — your screen was out of date`);

  const taken = new Set(active.map(e => String(e.playerId)));
  const pool = inPool(players, poolOf(current)).filter(p => !taken.has(String(p._id)));
  const open = t.teamCount - filled;
  if (pool.length < (SHUFFLE.has(current) ? open : 1)) fail(409, `Not enough ${LABELS[poolOf(current)]} players left`);
  const picks = SHUFFLE.has(current) ? shuffle(pool).slice(0, open) : [pool[randomInt(pool.length)]];
  const actionId = randomUUID();
  const revealAt = new Date(Date.now() + t.spinMs);
  const salt = randomBytes(32).toString('hex');
  const assignments = picks.map((p, i) => ({ teamNumber: filled + 1 + i, name: p.name }));
  const commitment = sha256(proofText({ actionId, category: current, assignments, salt }));
  await DrawEvent.insertMany(picks.map((p, i) => ({
    commitment,
    salt,
    tournamentId: t._id,
    actionId,
    sequence: events.length + i + 1,
    category: current,
    teamNumber: filled + 1 + i,
    playerId: p._id,
    playerName: p.name,
    revealAt,
  })));
  scheduleReveal(actionId, t.spinMs, ev);
  emit(ev, 'draw:spinning', {
    actionId,
    category: current,
    mode: modeOf(current),
    teamNumbers: picks.map((_, i) => filled + 1 + i),
    candidates: pool.map(p => p.name),
    commitment,
  });
  await broadcast(ev);
  return { actionId };
});

export const undo = ({ actionId } = {}, ev = 'main') => locked(async () => {
  const s = await snapshot(undefined, ev);
  requireIdle(s);
  const last = s.active.at(-1);
  if (s.t.status !== 'LIVE' || !last || last.category !== s.current) fail(409, 'Nothing to undo in the active category');
  if (last.actionId !== actionId) fail(409, 'That is no longer the latest draw — your screen was out of date');
  await DrawEvent.updateMany({ tournamentId: s.t._id, actionId }, { voided: true, voidedAt: new Date() });
  emit(ev, 'draw:undone', { actionId });
  await broadcast(ev);
});

export const finalize = ({ category } = {}, ev = 'main') => locked(async () => {
  const s = await snapshot(undefined, ev);
  const { t, current } = s;
  if (t.status !== 'LIVE' || category !== current) fail(409, `${LABELS[current] ?? 'No category'} is the active category`);
  requireIdle(s);
  const done = s.active.filter(e => e.category === current);
  const n = t.teamCount;
  const complete = done.length === n
    && new Set(done.map(e => e.teamNumber)).size === n
    && new Set(done.map(e => String(e.playerId))).size === n;
  if (!complete) fail(409, `Fill all ${n} teams before finalizing ${LABELS[current]}`);
  t.currentIndex += 1;
  if (t.currentIndex >= t.categories.length) t.status = 'COMPLETED';
  await t.save();
  emit(ev, 'category:finalized', { category: current });
  await broadcast(ev);
});
