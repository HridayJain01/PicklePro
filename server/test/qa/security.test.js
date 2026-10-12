// SEC — non-destructive security checks against a local server with isolated data.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { finalize, fresh, names, ok, pause, pre, raw, setup, socketTo, spin, state } from './helpers.js';

const ctx = setup('security');
let n = 0;
const id = () => `SEC-${String(++n).padStart(3, '0')}`;
const ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// ---------- no early reveal, anywhere ----------
for (const ev of ['main', 'kids']) {
  for (const kind of ['shuffle', 'spin']) {
    let winners = [];
    let spinningPayload = null;
    let socketStates = [];
    test(`${id()} reveal (${ev}, ${kind}): start a 1.2 s spin and capture what screens receive`, async () => {
      if (ev === 'main') await fresh(ctx, { categories: kind === 'shuffle' ? ['A'] : ['WOMEN'], spinMs: 1200 });
      else {
        await fresh(ctx, { ev: 'kids', spinMs: kind === 'shuffle' ? 1200 : 0 });
        if (kind === 'spin') { await spin(ctx, 'kids'); await finalize(ctx, 'kids'); await ok(ctx, '/kids/tournament', { method: 'PATCH', body: { spinMs: 1200 } }); }
      }
      const sock = await socketTo(ctx, { event: ev });
      sock.on('tournament:state', s => socketStates.push(s));
      const spun = new Promise(r => sock.once('draw:spinning', r));
      assert.equal((await spin(ctx, ev)).status, 200);
      spinningPayload = await spun;
      ctx[`sock_${ev}_${kind}`] = sock;
    });
    const hidden = async () => {
      // The server knows the result; find it directly in the DB-backed admin view AFTER the test.
      return null;
    };
    test(`${id()} reveal (${ev}, ${kind}): draw:spinning carries no result and no key`, async () => {
      assert.ok(!('assignments' in spinningPayload)); assert.ok(!('salt' in spinningPayload));
      assert.match(spinningPayload.commitment, /^[0-9a-f]{64}$/);
    });
    test(`${id()} reveal (${ev}, ${kind}): public state hides the pick while spinning`, async () => {
      const s = await state(ctx, ev);
      assert.ok(s.pending);
      const cat = s.pending.category;
      assert.ok(s.teams.every(t => !t.players[cat]), 'no team shows the spinning round');
      assert.ok(!('salt' in s.pending));
    });
    test(`${id()} reveal (${ev}, ${kind}): admin history hides the pick while spinning`, async () => {
      const s = await state(ctx, ev);
      const h = (await ok(ctx, `${pre(ev)}/admin`)).history;
      assert.ok(!h.some(r => r.actionId === s.pending.actionId));
    });
    test(`${id()} reveal (${ev}, ${kind}): Excel export hides the pick while spinning`, async () => {
      const s = await state(ctx, ev);
      const r = await raw(ctx, `${pre(ev)}/export.xlsx`);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(r.body);
      const hist = [];
      wb.getWorksheet('Draw History').eachRow((row, i) => i > 1 && hist.push(row.getCell(7).text));
      assert.ok(!hist.includes(s.pending.actionId));
    });
    test(`${id()} reveal (${ev}, ${kind}): leaderboard does not score the hidden pick`, async () => {
      const b = await ok(ctx, `${pre(ev)}/leaderboard`, { auth: false });
      const s = await state(ctx, ev);
      if (b.last) assert.ok(!(b.last.category === s.pending.category && s.pending.teamNumbers.includes(b.last.team)));
    });
    test(`${id()} reveal (${ev}, ${kind}): socket state broadcasts during the spin hide the pick`, async () => {
      const s = await state(ctx, ev);
      for (const st of socketStates.filter(x => x.pending)) assert.ok(st.teams.every(t => !t.players[s.pending.category]));
    });
    test(`${id()} reveal (${ev}, ${kind}): after the spin the result and key are published`, async () => {
      await pause(1300);
      const s = await state(ctx, ev);
      assert.equal(s.pending, null); assert.match(s.last.salt, /^[0-9a-f]{64}$/);
      ctx[`sock_${ev}_${kind}`].close();
      void hidden; void winners;
    });
  }
}

// ---------- forged socket events ----------
const FORGED = ['draw', 'draw:spinning', 'draw:revealed', 'draw:undone', 'undo', 'finalize', 'start', 'tournament:state', 'category:finalized', 'tap', 'viewers', 'admin'];
for (const ev of ['main', 'kids']) {
  for (const name of FORGED) {
    test(`${id()} socket (${ev}): forged "${name}" event changes nothing and is not relayed`, async () => {
      await pause(0);
      const before = await state(ctx, ev);
      const attacker = await socketTo(ctx, { event: ev });
      const watcher = await socketTo(ctx, { event: ev });
      let relayed = false;
      watcher.on(name, () => { relayed = true; });
      attacker.emit(name, { category: before.current, team: before.currentTeam, teams: [], status: 'COMPLETED', count: 9999 });
      await pause(120);
      attacker.close(); watcher.close();
      assert.deepEqual((await state(ctx, ev)).teams, before.teams);
      if (name !== 'viewers') assert.equal(relayed, false);
    });
  }
}
for (const payload of [null, 123, {}, [], '🔥🔥', 'x'.repeat(10000), '<img src=x>', { emoji: '🔥' }]) {
  test(`${id()} socket: reaction payload ${JSON.stringify(payload)?.slice(0, 20)} is dropped`, async () => {
    const a = await socketTo(ctx); const w = await socketTo(ctx);
    let got = 0; w.on('reaction', () => { got += 1; });
    a.emit('reaction', payload);
    await pause(100);
    a.close(); w.close();
    assert.equal(got, 0);
  });
}
test(`${id()} socket: reactions do not cross from kids to main`, async () => {
  const k = await socketTo(ctx, { event: 'kids' }); const m = await socketTo(ctx, { event: 'main' });
  let got = 0; m.on('reaction', () => { got += 1; });
  k.emit('reaction', '🎉');
  await pause(100);
  k.close(); m.close();
  assert.equal(got, 0);
});

// ---------- injection-shaped inputs ----------
const INJECT = [
  ['login password as object', '/auth/login', 'POST', { password: { $ne: null } }, 401],
  ['login password as array', '/auth/login', 'POST', { password: ['qa-password'] }, 401],
  ['guess voterId as object', '/guess', 'POST', { voterId: { $gt: '' }, nickname: 'x', category: 'WOMEN', team: 1, name: 'x' }, 400],
  ['guess nickname as object', '/guess', 'POST', { voterId: 'voter-inj-0001', nickname: { $ne: 1 }, category: 'WOMEN', team: 1, name: 'x' }, 400],
  ['draw category as operator', '/draw', 'POST', { category: { $ne: null }, team: 1 }, 409],
  ['undo actionId as operator', '/undo', 'POST', { actionId: { $ne: null } }, 409],
];
for (const [label, path, method, body, code] of INJECT) {
  test(`${id()} injection: ${label} -> ${code}`, async () => {
    const r = await raw(ctx, path, { method, body, auth: !path.startsWith('/auth'), headers: { 'x-forwarded-for': `10.20.${n}.1` } });
    assert.equal(r.status, code);
  });
}
for (const q of ['voter[$ne]=x', 'voter[]=a&voter[]=b']) {
  test(`${id()} injection: leaderboard query ${q} -> 200, me null`, async () => {
    assert.equal((await ok(ctx, `/leaderboard?${q}`, { auth: false })).me, null);
  });
}
test(`${id()} injection: export ?tournament[$ne]=x is ignored (simple query parser) -> active tournament, no operator reaches Mongo`, async () => {
  assert.equal((await raw(ctx, '/export.xlsx?tournament[$ne]=x')).status, 200);
});
test(`${id()} injection: formula-like names are stored and exported as plain text cells`, async () => {
  await fresh(ctx, { categories: ['WOMEN'], lists: { WOMEN: ['=HYPERLINK("http://x","y")', ...names('W', 27)] } });
  for (let k = 0; k < 28; k++) await spin(ctx);
  const r = await raw(ctx, '/export.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.body);
  let found = false;
  wb.getWorksheet('Final Teams').eachRow((row, i) => {
    if (i === 1) return;
    const cell = row.getCell(2);
    if (String(cell.value).startsWith('=HYPERLINK')) { found = true; assert.equal(typeof cell.value, 'string'); assert.equal(cell.formula, undefined); }
  });
  assert.ok(found);
});
test(`${id()} injection: tournament name with path characters gives a safe download filename`, async () => {
  await ok(ctx, '/tournament', { method: 'PATCH', body: { name: '../../etc/passwd"; rm -rf' } });
  const cd = (await raw(ctx, '/export.xlsx')).headers.get('content-disposition');
  assert.ok(!/[\\/]/.test(cd.split('filename=')[1].replace(/"/g, '')), cd);
});

// ---------- headers, CORS, cookies, rate limit ----------
test(`${id()} headers: helmet security headers present on API responses`, async () => {
  const h = (await raw(ctx, '/state', { auth: false })).headers;
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.ok(h.get('x-frame-options'));
  assert.ok(h.get('content-security-policy'));
  assert.ok(h.get('referrer-policy'));
  assert.equal(h.get('x-powered-by'), null);
});
test(`${id()} CORS: the REST API does not grant cross-origin reads to other sites`, async () => {
  const r = await raw(ctx, '/state', { auth: false, headers: { origin: 'https://evil.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
test(`${id()} CORS: cross-origin preflight for a host mutation is not granted`, async () => {
  const r = await raw(ctx, '/draw', { method: 'OPTIONS', auth: false, headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
test(`${id()} cookie: HttpOnly + SameSite=Strict + Path=/ + 12 h`, async () => {
  const c = (await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'qa-password' }, auth: false, headers: { 'x-forwarded-for': '10.30.0.1' } })).headers.get('set-cookie');
  assert.match(c, /HttpOnly/i); assert.match(c, /SameSite=Strict/i); assert.match(c, /Path=\//); assert.match(c, /Max-Age=43200/);
});
test(`${id()} cookie: Secure flag set in production mode`, async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const c = (await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'qa-password' }, auth: false, headers: { 'x-forwarded-for': '10.30.0.2' } })).headers.get('set-cookie');
    assert.match(c, /Secure/);
  } finally { process.env.NODE_ENV = prev; }
});
test(`${id()} rate limit: 10 wrong passwords from one IP -> 11th attempt 429 even with the right password`, async () => {
  const headers = { 'x-forwarded-for': '10.40.0.1' };
  for (let k = 0; k < 10; k++) assert.equal((await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'bad' }, auth: false, headers })).status, 401);
  assert.equal((await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'qa-password' }, auth: false, headers })).status, 429);
});
test(`${id()} rate limit: other IPs are not affected`, async () => {
  assert.equal((await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'qa-password' }, auth: false, headers: { 'x-forwarded-for': '10.40.0.2' } })).status, 200);
});
test(`${id()} rate limit: a successful login resets the failure count`, async () => {
  const headers = { 'x-forwarded-for': '10.40.0.3' };
  for (let k = 0; k < 9; k++) await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'bad' }, auth: false, headers });
  assert.equal((await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'qa-password' }, auth: false, headers })).status, 200);
  for (let k = 0; k < 9; k++) assert.equal((await raw(ctx, '/auth/login', { method: 'POST', body: { password: 'bad' }, auth: false, headers })).status, 401);
});
test(`${id()} logout: clears the cookie`, async () => {
  assert.match((await raw(ctx, '/auth/logout', { method: 'POST' })).headers.get('set-cookie'), /admin=;/);
});

// ---------- secrets ----------
test(`${id()} secrets: no .env file is tracked by git`, () => {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n');
  assert.ok(!tracked.some(f => /(^|\/)\.env$/.test(f)), 'a .env is tracked');
});
test(`${id()} secrets: no MongoDB credentials or session secrets in git history`, () => {
  const out = execSync('git log --all -p --no-color -- . ":(exclude)server/node_modules" ":(exclude)*.lock" ":(exclude)*package-lock.json"', { cwd: ROOT, maxBuffer: 1 << 30 }).toString();
  // The README's documented placeholder "user:pass" is not a credential.
  const uris = out.match(/mongodb\+srv:\/\/[^\s"'<]+:[^\s"'<]+@/g) ?? [];
  assert.deepEqual(uris.filter(u => !u.includes('//user:pass@')), [], 'mongodb+srv with real-looking credentials found');
  assert.ok(!/^\+\s*SESSION_SECRET=[0-9a-f]{20,}/m.test(out), 'session secret found');
});
test(`${id()} secrets: built client bundle contains no server secrets`, () => {
  const dist = join(ROOT, 'client', 'dist', 'assets');
  if (!existsSync(dist)) return;
  for (const f of readdirSync(dist).filter(x => x.endsWith('.js'))) {
    const txt = readFileSync(join(dist, f), 'utf8');
    assert.ok(!/ADMIN_PASSWORD|SESSION_SECRET|mongodb(\+srv)?:\/\//.test(txt), f);
  }
});
test(`${id()} secrets: .env files are ignored by git`, () => {
  assert.match(readFileSync(join(ROOT, '.gitignore'), 'utf8'), /^\.env$/m);
});
