// Shared helpers for the QA suite. Every test file gets its OWN isolated MongoDB database
// (picklepro_qa_<name>) that is dropped at the start; production is never touched.
import assert from 'node:assert/strict';
import { after, before } from 'node:test';
import mongoose from 'mongoose';
import { io as connect } from 'socket.io-client';

process.env.ADMIN_PASSWORD = 'qa-password';
process.env.SESSION_SECRET = 's'.repeat(40);
process.env.TRUST_PROXY = '1';

const BASE_URI = process.env.TEST_MONGODB_BASE ?? 'mongodb://127.0.0.1:27017';
export const pause = ms => new Promise(r => setTimeout(r, ms));

export function setup(name) {
  const ctx = { server: null, cookie: '', uri: `${BASE_URI}/picklepro_qa_${name}` };
  before(async () => {
    await mongoose.connect(ctx.uri);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    const { start } = await import('../../src/server.js');
    ctx.start = start;
    ctx.server = await start({ port: 0, mongoUri: ctx.uri });
    const r = await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'qa-password' }, auth: false });
    ctx.cookie = r.headers.get('set-cookie').split(';')[0];
  });
  after(() => ctx.server?.close());
  return ctx;
}

export async function restart(ctx) {
  await ctx.server.close();
  ctx.server = await ctx.start({ port: 0, mongoUri: ctx.uri });
}

// Low-level request: returns { status, headers, body } and never throws on HTTP errors.
export async function raw(ctx, path, { method = 'GET', body, auth = true, cookie, headers = {}, rawBody } = {}) {
  const res = await fetch(`http://127.0.0.1:${ctx.server.port}/api${path}`, {
    method,
    headers: {
      ...(rawBody === undefined ? { 'content-type': 'application/json' } : {}),
      ...((cookie ?? (auth ? ctx.cookie : '')) ? { cookie: cookie ?? ctx.cookie } : {}),
      ...headers,
    },
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get('content-type') ?? '';
  const out = type.includes('json') ? await res.json().catch(() => null) : Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, body: out };
}

export const pre = ev => (ev === 'kids' ? '/kids' : '');
export async function ok(ctx, path, opts) {
  const r = await raw(ctx, path, opts);
  assert.equal(r.status, 200, `${opts?.method ?? 'GET'} ${path} -> ${r.status} ${JSON.stringify(r.body)?.slice(0, 200)}`);
  return r.body;
}
export const state = (ctx, ev = 'main') => ok(ctx, `${pre(ev)}/state`, { auth: false });

export const names = (p, n) => Array.from({ length: n }, (_, i) => `${p} Player ${i + 1}`);
const MAIN_POOLS = ['A', 'WOMEN', 'B', 'C', 'D'];

// A fresh tournament in the given event, lists filled, started. spinMs 0 = instant reveals.
export async function fresh(ctx, { ev = 'main', categories, spinMs = 0, start = true, lists } = {}) {
  const p = pre(ev);
  await ok(ctx, `${p}/tournaments`, { method: 'POST', body: { name: `QA ${ev} ${Date.now()}` } });
  if (ev === 'main') {
    await ok(ctx, '/tournament', { method: 'PATCH', body: { categories: categories ?? ['A', 'WOMEN', 'B', 'C'], spinMs } });
    const cats = categories ?? ['A', 'WOMEN', 'B', 'C'];
    await ok(ctx, '/players', { method: 'PUT', body: { lists: lists ?? Object.fromEntries(cats.filter(c => MAIN_POOLS.includes(c)).map(c => [c, names(c, 28)])) } });
  } else {
    await ok(ctx, '/kids/tournament', { method: 'PATCH', body: { spinMs } });
    await ok(ctx, '/kids/players', { method: 'PUT', body: { lists: lists ?? { ICON: names('Icon', 4), GIRL1: names('Girl', 4), BOY: names('Boy', 4), GIRL2: names('Girlb', 4) } } });
  }
  if (start) await ok(ctx, `${p}/start`, { method: 'POST' });
  return state(ctx, ev);
}

export async function spin(ctx, ev = 'main') {
  const s = await state(ctx, ev);
  return raw(ctx, `${pre(ev)}/draw`, { method: 'POST', body: { category: s.current, team: s.currentTeam } });
}
export async function finalize(ctx, ev = 'main') {
  const s = await state(ctx, ev);
  return ok(ctx, `${pre(ev)}/finalize`, { method: 'POST', body: { category: s.current } });
}

export async function socketTo(ctx, auth = {}) {
  const s = connect(`http://127.0.0.1:${ctx.server.port}`, { transports: ['websocket'], auth, reconnection: false });
  await new Promise((resolve, reject) => {
    s.once('tournament:state', resolve);
    s.once('connect_error', reject);
  });
  return s;
}

// Business invariants that must hold for ANY state of a tournament.
export function assertInvariants(s) {
  const seen = new Set();
  for (const t of s.teams) {
    for (const [cat, name] of Object.entries(t.players)) {
      assert.ok(s.categories.some(c => c.key === cat), `unknown category ${cat}`);
      assert.ok(!seen.has(name), `player ${name} on two teams`);
      seen.add(name);
    }
  }
  for (const c of s.categories) {
    const filled = s.teams.filter(t => t.players[c.key]).length;
    assert.equal(filled, c.assigned, `${c.key} assigned count`);
    // One-by-one rounds always fill a prefix of teams (1..n), never skip one.
    if (!c.shuffle) s.teams.slice(0, filled).forEach(t => assert.ok(t.players[c.key], `${c.key} gap at team ${t.number}`));
  }
  assert.ok(!s.remaining.some(n => seen.has(n)), 'a placed player is still in the pool');
}
