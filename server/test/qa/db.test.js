// DB — real indexes and constraints, schema validation, restart recovery, database outage.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { DrawEvent, Guess, Player, Tournament } from '../../src/models.js';
import { assertInvariants, finalize, fresh, names, ok, pause, raw, restart, setup, socketTo, spin, state } from './helpers.js';

const ctx = setup('db');
let n = 0;
const id = () => `DB-${String(++n).padStart(3, '0')}`;
const keys = async model => (await model.collection.indexes()).map(i => ({ key: i.key, unique: !!i.unique, partial: i.partialFilterExpression ?? null }));
const has = (list, key, unique, partial) => list.some(i => JSON.stringify(i.key) === JSON.stringify(key) && i.unique === unique && JSON.stringify(i.partial) === JSON.stringify(partial ?? null));

test(`${id()} index: players unique (tournamentId, nameKey)`, async () => {
  assert.ok(has(await keys(Player), { tournamentId: 1, nameKey: 1 }, true));
});
test(`${id()} index: drawevents unique (tournamentId, sequence)`, async () => {
  assert.ok(has(await keys(DrawEvent), { tournamentId: 1, sequence: 1 }, true));
});
test(`${id()} index: drawevents unique team-per-round for live (non-voided) picks`, async () => {
  assert.ok(has(await keys(DrawEvent), { tournamentId: 1, category: 1, teamNumber: 1 }, true, { voided: false }));
});
test(`${id()} index: drawevents unique player for live (non-voided) picks`, async () => {
  assert.ok(has(await keys(DrawEvent), { playerId: 1 }, true, { voided: false }));
});
test(`${id()} index: guesses unique (tournament, round, team, voter)`, async () => {
  assert.ok(has(await keys(Guess), { tournamentId: 1, category: 1, teamNumber: 1, voterId: 1 }, true));
});

let t; let p1; let p2;
test(`${id()} setup: a raw tournament and two players`, async () => {
  t = await Tournament.create({ name: 'Raw' });
  [p1, p2] = await Player.insertMany([
    { tournamentId: t._id, category: 'WOMEN', name: 'X One', nameKey: 'x one' },
    { tournamentId: t._id, category: 'WOMEN', name: 'X Two', nameKey: 'x two' },
  ]);
});
const ev = (o = {}) => ({ tournamentId: t._id, actionId: 'a', sequence: 1, category: 'WOMEN', teamNumber: 1, playerId: p1._id, playerName: 'X One', revealAt: new Date(), ...o });
test(`${id()} constraint: same player name twice in a tournament rejected by the database`, async () => {
  await assert.rejects(Player.create({ tournamentId: t._id, category: 'B', name: 'X ONE', nameKey: 'x one' }), /E11000/);
});
test(`${id()} constraint: same name allowed in a different tournament`, async () => {
  const t2 = await Tournament.create({ name: 'Other' });
  await Player.create({ tournamentId: t2._id, category: 'WOMEN', name: 'X One', nameKey: 'x one' });
});
test(`${id()} constraint: first pick inserts`, async () => { await DrawEvent.create(ev()); });
test(`${id()} constraint: second live pick for the same team+round rejected`, async () => {
  await assert.rejects(DrawEvent.create(ev({ sequence: 2, playerId: p2._id, playerName: 'X Two' })), /E11000/);
});
test(`${id()} constraint: same player picked twice (live) rejected`, async () => {
  await assert.rejects(DrawEvent.create(ev({ sequence: 3, teamNumber: 2 })), /E11000/);
});
test(`${id()} constraint: duplicate sequence rejected`, async () => {
  await assert.rejects(DrawEvent.create(ev({ teamNumber: 3, playerId: p2._id, category: 'B' })), /E11000/);
});
test(`${id()} constraint: after voiding, the same team can be drawn again (undo semantics)`, async () => {
  await DrawEvent.updateOne({ sequence: 1, tournamentId: t._id }, { voided: true });
  await DrawEvent.create(ev({ sequence: 4, playerId: p2._id, playerName: 'X Two' }));
});
test(`${id()} constraint: voided rows are kept for the audit trail`, async () => {
  assert.equal(await DrawEvent.countDocuments({ tournamentId: t._id, voided: true }), 1);
});
const BAD_DOCS = [
  ['tournament without name', () => Tournament.create({})],
  ['tournament bad status', () => Tournament.create({ name: 'x', status: 'PAUSED' })],
  ['tournament bad event', () => Tournament.create({ name: 'x', event: 'adults' })],
  ['tournament unknown category', () => Tournament.create({ name: 'x', categories: ['Z'] })],
  ['tournament spinMs > 30000', () => Tournament.create({ name: 'x', spinMs: 40000 })],
  ['tournament name > 100', () => Tournament.create({ name: 'n'.repeat(101) })],
  ['player bad list', () => Player.create({ tournamentId: t._id, category: 'GIRL3', name: 'q', nameKey: 'q' })],
  ['player missing name', () => Player.create({ tournamentId: t._id, category: 'A', nameKey: 'q2' })],
  ['draw event missing revealAt', () => DrawEvent.create(ev({ sequence: 99, revealAt: undefined, teamNumber: 9 }))],
  ['draw event bad category', () => DrawEvent.create(ev({ sequence: 98, category: 'GIRL', teamNumber: 9 }))],
  ['guess missing voter', () => Guess.create({ tournamentId: t._id, category: 'WOMEN', teamNumber: 1, nickname: 'n', playerName: 'p' })],
];
for (const [label, fn] of BAD_DOCS) {
  test(`${id()} schema: ${label} -> rejected`, async () => { await assert.rejects(fn()); });
}
test(`${id()} defaults: new tournament = main event, DRAFT, 28 teams, M1/M2/M3/W1, 6 s, predictions on`, async () => {
  const d = await Tournament.create({ name: 'Defaults' });
  assert.equal(d.event, 'main'); assert.equal(d.status, 'DRAFT'); assert.equal(d.teamCount, 28);
  assert.deepEqual([...d.categories], ['A', 'B', 'C', 'WOMEN']); assert.equal(d.spinMs, 6000); assert.equal(d.predictions, true);
});
test(`${id()} legacy: a tournament document WITHOUT an event field is treated as the main event`, async () => {
  const legacy = await Tournament.collection.insertOne({ name: 'Legacy no event', status: 'DRAFT', teamCount: 28, categories: ['A', 'WOMEN', 'B', 'C'], currentIndex: 0, spinMs: 6000, createdAt: new Date(), updatedAt: new Date() });
  const s = await state(ctx);
  assert.equal(s.id, String(legacy.insertedId));
  assert.equal(s.event, 'main');
});
test(`${id()} legacy: the kids event never picks up a main/legacy tournament`, async () => {
  const k = await state(ctx, 'kids');
  assert.equal(k.event, 'kids'); assert.equal(k.teamCount, 4);
});

// ---------- restart recovery ----------
test(`${id()} restart: committed picks survive a server restart (main)`, async () => {
  await fresh(ctx, { categories: ['WOMEN'] });
  for (let k = 0; k < 5; k++) await spin(ctx);
  const before = await state(ctx);
  await restart(ctx);
  const after = await state(ctx);
  assert.deepEqual(after.teams, before.teams); assert.equal(after.currentTeam, 6);
});
test(`${id()} restart: a spin in progress is revealed after restart (main)`, async () => {
  await ok(ctx, '/tournament', { method: 'PATCH', body: { spinMs: 900 } });
  assert.equal((await spin(ctx)).status, 200);
  await restart(ctx);
  const sock = await socketTo(ctx);
  const revealed = await new Promise(r => sock.once('draw:revealed', r));
  sock.close();
  assert.equal(revealed.assignments[0].teamNumber, 6);
  const s = await state(ctx);
  assert.equal(s.currentTeam, 7); assertInvariants(s);
});
test(`${id()} restart: kids spin in progress is revealed after restart, only to kids screens`, async () => {
  await fresh(ctx, { ev: 'kids', spinMs: 900 });
  assert.equal((await spin(ctx, 'kids')).status, 200);
  await restart(ctx);
  const kids = await socketTo(ctx, { event: 'kids' });
  const main = await socketTo(ctx, { event: 'main' });
  let mainHeard = false;
  main.on('draw:revealed', () => { mainHeard = true; });
  const revealed = await new Promise(r => kids.once('draw:revealed', r));
  await pause(100);
  kids.close(); main.close();
  assert.equal(revealed.assignments.length, 4);
  assert.equal(mainHeard, false);
});
test(`${id()} restart: undo history survives restart`, async () => {
  await ok(ctx, '/tournament', { method: 'PATCH', body: { spinMs: 0 } });
  const s = await state(ctx);
  await ok(ctx, '/undo', { method: 'POST', body: { actionId: s.last.actionId } });
  await restart(ctx);
  assert.ok((await ok(ctx, '/admin')).history.some(h => h.voided));
});
test(`${id()} restart: login session cookie stays valid across restart (stateless HMAC)`, async () => {
  assert.equal((await raw(ctx, '/admin')).status, 200);
});
test(`${id()} restart: 3 restarts in a row keep the state identical`, async () => {
  const before = await state(ctx);
  for (let k = 0; k < 3; k++) await restart(ctx);
  assert.deepEqual((await state(ctx)).teams, before.teams);
});

// ---------- database outage ----------
test(`${id()} outage: health reports 503 while MongoDB is disconnected, 200 after reconnect`, async () => {
  await mongoose.disconnect();
  const down = await raw(ctx, '/health', { auth: false });
  assert.equal(down.status, 503); assert.deepEqual(down.body, { ok: false, db: 'down' });
  await mongoose.connect(ctx.uri);
  assert.equal((await raw(ctx, '/health', { auth: false })).status, 200);
});
test(`${id()} outage: a draw attempted during the outage fails cleanly and leaves no partial pick`, async () => {
  const before = await state(ctx);
  await mongoose.disconnect();
  const r = await raw(ctx, '/draw', { method: 'POST', body: { category: before.current, team: before.currentTeam } });
  assert.ok(r.status >= 500 || r.status === 409, `got ${r.status}`);
  assert.equal(typeof r.body.error, 'string');
  assert.ok(!/mongo|E11000|stack/i.test(r.body.error), 'no internal details leaked');
  await mongoose.connect(ctx.uri);
  const after = await state(ctx);
  assert.deepEqual(after.teams, before.teams); assert.equal(after.pending, null);
});
test(`${id()} outage: after reconnect the draw continues normally`, async () => {
  assert.equal((await spin(ctx)).status, 200);
  assertInvariants(await state(ctx));
});
test(`${id()} export: Excel matches the saved state exactly (teams + history)`, async () => {
  const s = await state(ctx);
  const r = await raw(ctx, '/export.xlsx');
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.body);
  const sheet = wb.getWorksheet('Final Teams');
  for (let i = 0; i < 28; i++) assert.equal(sheet.getRow(i + 2).getCell(2).text, s.teams[i].players.WOMEN ?? '');
  const hist = wb.getWorksheet('Draw History');
  assert.equal(hist.rowCount - 1, (await ok(ctx, '/admin')).history.length);
});
test(`${id()} export: before any draw, Excel still generates with empty teams`, async () => {
  await fresh(ctx, { categories: ['B'], start: false });
  const r = await raw(ctx, '/export.xlsx');
  assert.equal(r.status, 200);
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.body);
  assert.equal(wb.getWorksheet('Draw History').rowCount, 1);
});
test(`${id()} export: archived tournament of the OTHER event -> 404`, async () => {
  const list = await ok(ctx, '/kids/tournaments');
  assert.equal((await raw(ctx, `/export.xlsx?tournament=${list[0].id}`)).status, 404);
});
for (const bad of ['nope', '000000000000000000000000', '{}', '%00']) {
  test(`${id()} export: tournament id ${JSON.stringify(bad)} -> 404`, async () => {
    assert.equal((await raw(ctx, `/export.xlsx?tournament=${encodeURIComponent(bad)}`)).status, 404);
  });
}
test(`${id()} archive: tournaments list is per event, newest first, active flagged`, async () => {
  const main = await ok(ctx, '/tournaments');
  const kids = await ok(ctx, '/kids/tournaments');
  assert.ok(main.length > 1 && kids.length >= 1);
  assert.equal(main[0].active, true); assert.ok(main.slice(1).every(x => !x.active));
  assert.ok(!main.some(m => kids.some(k => k.id === m.id)));
});
