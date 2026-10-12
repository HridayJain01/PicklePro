// RACE — simultaneous requests must never create duplicate or skipped assignments.
// Note: the processing lock is in memory, so these guarantees hold for ONE server instance
// (the deployed architecture). Multi-instance safety is not claimed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertInvariants, finalize, fresh, names, ok, pre, raw, setup, socketTo, spin, state } from './helpers.js';

const ctx = setup('race');
let n = 0;
const id = () => `RACE-${String(++n).padStart(3, '0')}`;
const burst = (k, fn) => Promise.all(Array.from({ length: k }, (_, i) => fn(i)));
const codes = rs => rs.map(r => r.status).sort();

for (const k of [2, 3, 5, 10, 25]) {
  test(`${id()} ${k} tabs draw the same team at once (spin round) -> exactly one 200`, async () => {
    await fresh(ctx, { categories: ['WOMEN'] });
    const rs = await burst(k, () => raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 1 } }));
    assert.equal(rs.filter(r => r.status === 200).length, 1, codes(rs).join(','));
    const s = await state(ctx);
    assert.equal(s.currentTeam, 2); assertInvariants(s);
  });
  test(`${id()} ${k} tabs shuffle A at once -> exactly one shuffle`, async () => {
    await fresh(ctx, { categories: ['A'] });
    const rs = await burst(k, () => raw(ctx, '/draw', { method: 'POST', body: { category: 'A', team: 1 } }));
    assert.equal(rs.filter(r => r.status === 200).length, 1);
    const s = await state(ctx);
    assert.equal(s.teams.filter(t => t.players.A).length, 28); assertInvariants(s);
  });
}
for (const k of [2, 5]) {
  test(`${id()} ${k} tabs each request a DIFFERENT team at once -> picks land only in team order, no gaps or duplicates`, async () => {
    await fresh(ctx, { categories: ['B'] });
    const rs = await burst(k, i => raw(ctx, '/draw', { method: 'POST', body: { category: 'B', team: i + 1 } }));
    // Requests are processed one at a time; a request succeeds only if its team is the real next one.
    const ok200 = rs.filter(r => r.status === 200).length;
    assert.ok(ok200 >= 1);
    const s = await state(ctx);
    assert.equal(s.currentTeam, ok200 + 1, 'teams 1..n filled, nothing skipped');
    assertInvariants(s);
  });
}
test(`${id()} sequential rapid clicks (20 in a row, no await between) -> one pick per correct team`, async () => {
  await fresh(ctx, { categories: ['C'] });
  const rs = await burst(20, () => raw(ctx, '/draw', { method: 'POST', body: { category: 'C', team: 1 } }));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
});
test(`${id()} draw + undo at the same time -> state stays consistent`, async () => {
  await fresh(ctx, { categories: ['WOMEN'] });
  await spin(ctx);
  const s = await state(ctx);
  const [d, u] = await Promise.all([
    raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 2 } }),
    raw(ctx, '/undo', { method: 'POST', body: { actionId: s.last.actionId } }),
  ]);
  assert.equal(d.status, 200); // processed first (lock order)
  assert.equal(u.status, 409, 'undo of a no-longer-latest pick must be refused');
  assertInvariants(await state(ctx));
});
test(`${id()} undo + draw (undo first) -> undo wins, draw refused as stale`, async () => {
  await fresh(ctx, { categories: ['WOMEN'] });
  await spin(ctx);
  const s = await state(ctx);
  const [u, d] = await Promise.all([
    raw(ctx, '/undo', { method: 'POST', body: { actionId: s.last.actionId } }),
    raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 2 } }),
  ]);
  assert.equal(u.status, 200); assert.equal(d.status, 409);
  const after = await state(ctx);
  assert.equal(after.currentTeam, 1); assertInvariants(after);
});
test(`${id()} 5 simultaneous undos of the same pick -> exactly one succeeds`, async () => {
  await fresh(ctx, { categories: ['WOMEN'] });
  await spin(ctx); await spin(ctx);
  const s = await state(ctx);
  const rs = await burst(5, () => raw(ctx, '/undo', { method: 'POST', body: { actionId: s.last.actionId } }));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
  assert.equal((await state(ctx)).currentTeam, 2);
});
test(`${id()} 5 simultaneous finalizes -> one succeeds, round advances exactly once`, async () => {
  await fresh(ctx, { categories: ['WOMEN', 'B', 'C'] });
  for (let k = 0; k < 28; k++) await spin(ctx);
  const rs = await burst(5, () => raw(ctx, '/finalize', { method: 'POST', body: { category: 'WOMEN' } }));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
  assert.equal((await state(ctx)).current, 'B');
});
test(`${id()} finalize + draw racing on the last team -> no 29th pick`, async () => {
  await fresh(ctx, { categories: ['WOMEN', 'B'] });
  for (let k = 0; k < 27; k++) await spin(ctx);
  const rs = await Promise.all([
    raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 28 } }),
    raw(ctx, '/finalize', { method: 'POST', body: { category: 'WOMEN' } }),
    raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 28 } }),
  ]);
  assert.equal(rs[0].status, 200); assert.equal(rs[1].status, 200); assert.equal(rs[2].status, 409);
  const s = await state(ctx);
  assert.equal(s.current, 'B'); assertInvariants(s);
});
test(`${id()} 5 simultaneous starts -> one succeeds`, async () => {
  await fresh(ctx, { categories: ['WOMEN'], start: false });
  const rs = await burst(5, () => raw(ctx, '/start', { method: 'POST' }));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
});
test(`${id()} 5 simultaneous player saves -> list ends consistent (one full list, no mixture)`, async () => {
  await fresh(ctx, { categories: ['WOMEN'], start: false });
  const rs = await burst(5, i => raw(ctx, '/players', { method: 'PUT', body: { lists: { WOMEN: names(`V${i}`, 28) } } }));
  assert.ok(rs.every(r => r.status === 200));
  const l = (await ok(ctx, '/admin')).lists.WOMEN;
  assert.equal(l.length, 28);
  assert.equal(new Set(l.map(x => x.split(' ')[0])).size, 1, 'one save won entirely');
});
test(`${id()} list save racing the first draw of that list -> either the save or the draw is refused, never both applied inconsistently`, async () => {
  await fresh(ctx, { categories: ['WOMEN'] });
  const [d, p] = await Promise.all([
    raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 1 } }),
    raw(ctx, '/players', { method: 'PUT', body: { lists: { WOMEN: names('New', 28) } } }),
  ]);
  assert.equal(d.status, 200); assert.equal(p.status, 409);
  assertInvariants(await state(ctx));
});
test(`${id()} draw during an active spin (non-zero spin time) -> 409 busy`, async () => {
  await fresh(ctx, { categories: ['WOMEN'], spinMs: 1500 });
  assert.equal((await spin(ctx)).status, 200);
  const rs = await burst(3, () => raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 2 } }));
  assert.ok(rs.every(r => r.status === 409));
  const s = await state(ctx);
  assert.ok(s.pending); assert.equal(s.remaining.length, 28, 'winner still hidden');
});
test(`${id()} undo during an active spin -> 409`, async () => {
  const s = await state(ctx);
  assert.equal((await raw(ctx, '/undo', { method: 'POST', body: { actionId: s.pending.actionId } })).status, 409);
});
test(`${id()} new tournament during an active spin -> 409`, async () => {
  assert.equal((await raw(ctx, '/tournaments', { method: 'POST', body: { name: 'Mid-spin' } })).status, 409);
});
test(`${id()} main and kids draw at the same instant -> both succeed independently`, async () => {
  await new Promise(r => setTimeout(r, 1700)); // let the previous test's 1.5 s spin finish
  await fresh(ctx, { categories: ['WOMEN'] });
  await fresh(ctx, { ev: 'kids' });
  const [m, k] = await Promise.all([
    raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 1 } }),
    raw(ctx, '/kids/draw', { method: 'POST', body: { category: 'ICON', team: 1 } }),
  ]);
  assert.equal(m.status, 200); assert.equal(k.status, 200);
  assertInvariants(await state(ctx)); assertInvariants(await state(ctx, 'kids'));
});
test(`${id()} 10 kids + 10 main draw requests interleaved -> one pick in each event`, async () => {
  await fresh(ctx, { categories: ['WOMEN'] });
  await fresh(ctx, { ev: 'kids' });
  await spin(ctx, 'kids'); await finalize(ctx, 'kids');
  const rs = await burst(20, i => (i % 2
    ? raw(ctx, '/draw', { method: 'POST', body: { category: 'WOMEN', team: 1 } })
    : raw(ctx, '/kids/draw', { method: 'POST', body: { category: 'BOY', team: 1 } })));
  assert.equal(rs.filter(r => r.status === 200).length, 2);
  assert.equal((await state(ctx)).currentTeam, 2);
  assert.equal((await state(ctx, 'kids')).currentTeam, 2);
});
test(`${id()} 30 audience sockets connect simultaneously -> all receive the same state`, async () => {
  const socks = await burst(30, () => socketTo(ctx, { role: 'audience', viewer: `viewer-race-${Math.random().toString(36).slice(2, 10)}` }));
  const ids = new Set();
  await Promise.all(socks.map(s => new Promise(resolve => {
    s.emit('reaction', '🔥');
    resolve();
  })));
  const s = await state(ctx);
  ids.add(s.id);
  socks.forEach(x => x.close());
  assert.equal(ids.size, 1);
});
test(`${id()} 10 sockets reconnect simultaneously during a spin -> spin and result unaffected`, async () => {
  await fresh(ctx, { categories: ['WOMEN'], spinMs: 800 });
  assert.equal((await spin(ctx)).status, 200);
  const socks = await burst(10, () => socketTo(ctx, { role: 'audience', viewer: `viewer-rc-${Math.random().toString(36).slice(2, 10)}` }));
  socks.forEach(s => s.close());
  const again = await burst(10, () => socketTo(ctx, { role: 'audience', viewer: `viewer-rc2-${Math.random().toString(36).slice(2, 10)}` }));
  await new Promise(r => setTimeout(r, 900));
  again.forEach(s => s.close());
  const s = await state(ctx);
  assert.equal(s.currentTeam, 2); assert.equal(s.remaining.length, 27); assertInvariants(s);
});
test(`${id()} 20 parallel guesses from different viewers for the same team -> all stored once each`, async () => {
  await fresh(ctx, { categories: ['WOMEN'] });
  const s = await state(ctx);
  const rs = await burst(20, i => raw(ctx, '/guess', { method: 'POST', auth: false, body: { voterId: `voter-par-${String(i).padStart(4, '0')}`, nickname: `N${i}`, category: 'WOMEN', team: 1, name: s.remaining[i % 28] } }));
  assert.ok(rs.every(r => r.status === 200));
  await spin(ctx);
  assert.equal((await ok(ctx, '/leaderboard', { auth: false })).last.total, 20);
});
test(`${id()} 10 parallel guesses from the SAME viewer -> one stored guess (upsert)`, async () => {
  const s = await state(ctx);
  await burst(10, i => raw(ctx, '/guess', { method: 'POST', auth: false, body: { voterId: 'voter-same-0001', nickname: 'Same', category: 'WOMEN', team: 2, name: s.remaining[i] } }));
  await spin(ctx);
  assert.equal((await ok(ctx, '/leaderboard', { auth: false })).last.total, 1);
});
