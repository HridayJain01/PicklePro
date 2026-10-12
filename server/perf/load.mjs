// LOCAL load / stress / spike / soak test. Never point this at production.
// Runs the real server in-process against an isolated database (picklepro_perf), simulates N
// audience phones over Socket.IO, and measures connect time, broadcast latency of a real draw,
// HTTP latency/throughput, memory and leaks. Usage: node perf/load.mjs [soakSeconds]
import { performance } from 'node:perf_hooks';
import mongoose from 'mongoose';
import { io as connect } from 'socket.io-client';

process.env.ADMIN_PASSWORD = 'perf-password';
process.env.SESSION_SECRET = 'p'.repeat(40);
const URI = process.env.PERF_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/picklepro_perf';
if (/onrender|mongodb\+srv/.test(URI)) throw new Error('Refusing to load-test a remote/production database');
const SOAK_S = Number(process.argv[2] ?? 120);

const pct = (arr, p) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); return +a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))].toFixed(1); };
const mb = b => +(b / 1048576).toFixed(1);
const out = { environment: {}, stages: [], http: [], spike: null, soak: null };

await mongoose.connect(URI); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
const { start } = await import('../src/server.js');
const server = await start({ port: 0, mongoUri: URI });
const base = `http://127.0.0.1:${server.port}`;
out.environment = { node: process.version, platform: `${process.platform} ${process.arch}`, cpus: (await import('node:os')).cpus().length, db: 'local MongoDB (isolated picklepro_perf)', serverInProcess: true };

let cookie = '';
async function api(path, method = 'GET', body) {
  const r = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body && JSON.stringify(body) });
  const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
  return r.json().catch(() => null);
}
await api('/auth/login', 'POST', { password: 'perf-password' });
async function freshDraw() {
  await api('/tournaments', 'POST', { name: `Perf ${Date.now()}` });
  await api('/tournament', 'PATCH', { categories: ['WOMEN'], spinMs: 0 });
  await api('/players', 'PUT', { lists: { WOMEN: Array.from({ length: 28 }, (_, i) => `W ${i}`) } });
  await api('/start', 'POST');
}

async function connectMany(n, tag) {
  const times = []; const socks = []; let failed = 0;
  const batch = 50;
  for (let i = 0; i < n; i += batch) {
    await Promise.all(Array.from({ length: Math.min(batch, n - i) }, async (_, j) => {
      const t0 = performance.now();
      const s = connect(base, { transports: ['websocket'], reconnection: false, auth: { role: 'audience', viewer: `viewer-${tag}-${i + j}-perf` } });
      try {
        await new Promise((res, rej) => { s.once('tournament:state', res); s.once('connect_error', rej); setTimeout(() => rej(new Error('timeout')), 15000); });
        times.push(performance.now() - t0); socks.push(s);
      } catch { failed += 1; s.close(); }
    }));
  }
  return { socks, times, failed };
}

async function broadcastLatency(socks) {
  const st = await api('/state');
  const t0 = performance.now();
  const lat = []; let missing = 0;
  const waits = socks.map(s => new Promise(res => {
    const timer = setTimeout(() => { missing += 1; res(); }, 10000);
    s.once('draw:revealed', () => { clearTimeout(timer); lat.push(performance.now() - t0); res(); });
  }));
  const ack0 = performance.now();
  await api('/draw', 'POST', { category: st.current, team: st.currentTeam });
  const ack = performance.now() - ack0;
  await Promise.all(waits);
  return { ack, lat, missing };
}

async function httpLoad(concurrency, seconds, path = '/state') {
  const lat = []; let errors = 0; const end = performance.now() + seconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (performance.now() < end) {
      const t0 = performance.now();
      try { const r = await fetch(base + '/api' + path); await r.arrayBuffer(); if (!r.ok) errors += 1; } catch { errors += 1; }
      lat.push(performance.now() - t0);
    }
  }));
  return { concurrency, seconds, requests: lat.length, rps: +(lat.length / seconds).toFixed(0), p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), errors };
}

// ---------- A/B/C: baseline, load and stress stages ----------
for (const n of [10, 25, 50, 100, 250, 500, 1000]) {
  await freshDraw();
  const mem0 = process.memoryUsage().rss;
  const c = await connectMany(n, `s${n}`);
  const b = await broadcastLatency(c.socks);
  const st = await api('/state');
  const ok = st.teams[0].players.WOMEN && st.remaining.length === 27 && !st.pending;
  out.stages.push({
    viewers: n, connected: c.socks.length, connectFailed: c.failed,
    connectMs: { p50: pct(c.times, 50), p95: pct(c.times, 95), p99: pct(c.times, 99) },
    drawAckMs: +b.ack.toFixed(1),
    revealToAllMs: { p50: pct(b.lat, 50), p95: pct(b.lat, 95), p99: pct(b.lat, 99), max: pct(b.lat, 100) },
    missedReveal: b.missing, stateCorrect: !!ok, rssMb: mb(process.memoryUsage().rss), rssDeltaMb: mb(process.memoryUsage().rss - mem0),
  });
  console.log('stage', JSON.stringify(out.stages.at(-1)));
  c.socks.forEach(s => s.close());
  await new Promise(r => setTimeout(r, 500));
}

// ---------- HTTP baseline / load ----------
for (const conc of [1, 10, 50, 100]) { out.http.push(await httpLoad(conc, 8)); console.log('http', JSON.stringify(out.http.at(-1))); }
for (const conc of [10, 100]) { out.http.push({ ...(await httpLoad(conc, 6, '/leaderboard?voter=perf')), path: '/leaderboard' }); console.log('http', JSON.stringify(out.http.at(-1))); }
out.http.push({ ...(await httpLoad(20, 5, '/health')), path: '/health' });

// ---------- D: spike — 500 phones open the link within ~1 s, then a draw ----------
{
  await freshDraw();
  const t0 = performance.now();
  const c = await connectMany(500, 'spike');
  const window = performance.now() - t0;
  const b = await broadcastLatency(c.socks);
  out.spike = { phones: 500, connected: c.socks.length, failed: c.failed, allConnectedInMs: +window.toFixed(0), revealToAllP95: pct(b.lat, 95), missedReveal: b.missing };
  console.log('spike', JSON.stringify(out.spike));
  c.socks.forEach(s => s.close());
  await new Promise(r => setTimeout(r, 1000));
}

// ---------- E: soak — 100 steady phones + 20 churning (connect/disconnect) + a draw every 3 s ----------
{
  await freshDraw();
  global.gc?.();
  const rss0 = process.memoryUsage().rss; const heap0 = process.memoryUsage().heapUsed;
  const steady = (await connectMany(100, 'soak')).socks;
  const end = performance.now() + SOAK_S * 1000;
  let draws = 0; let churn = 0; let errors = 0;
  const heapSamples = [];
  while (performance.now() < end) {
    const c = await connectMany(20, `churn${churn}`); churn += 1;
    c.socks.forEach(s => s.close());
    let st = await api('/state');
    if (!st.currentTeam) { await api('/finalize', 'POST', { category: st.current }); await freshDraw(); st = await api('/state'); }
    const r = await api('/draw', 'POST', { category: st.current, team: st.currentTeam });
    if (!r?.actionId) errors += 1; else draws += 1;
    heapSamples.push(mb(process.memoryUsage().heapUsed));
    await new Promise(res => setTimeout(res, 3000));
  }
  steady.forEach(s => s.close());
  await new Promise(r => setTimeout(r, 2500));
  global.gc?.();
  const listeners = { draw: steady[0]?.listeners?.('draw:revealed')?.length ?? 0 };
  out.soak = {
    seconds: SOAK_S, steadyPhones: 100, churnConnections: churn * 20, draws, drawErrors: errors,
    rssStartMb: mb(rss0), rssEndMb: mb(process.memoryUsage().rss), heapStartMb: mb(heap0), heapEndMb: mb(process.memoryUsage().heapUsed),
    heapMinMb: Math.min(...heapSamples), heapMaxMb: Math.max(...heapSamples),
    engineClientsAfterAllClosed: (await import('../src/draw.js')).roomOf ? 'n/a' : 'n/a', listeners,
  };
  console.log('soak', JSON.stringify(out.soak));
}

console.log('RESULT ' + JSON.stringify(out));
await server.close();
process.exit(0);
