// API — every route in both events: auth, methods, unknown paths, malformed bodies, field
// validation, response shapes. Invalid requests must never change tournament state.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { fresh, ok, pre, raw, setup, state } from './helpers.js';

const ctx = setup('api');
let n = 0;
const id = () => `API-${String(++n).padStart(3, '0')}`;
const EVENTS = ['main', 'kids'];

const ADMIN_ROUTES = [
  ['GET', '/admin'], ['PATCH', '/tournament'], ['POST', '/tournaments'], ['GET', '/tournaments'],
  ['PUT', '/players'], ['POST', '/players/import'], ['POST', '/start'], ['POST', '/draw'],
  ['POST', '/undo'], ['POST', '/finalize'], ['GET', '/export.xlsx'],
];
const signed = (exp, secret) => `admin=${exp}.${createHmac('sha256', secret).update(String(exp)).digest('base64url')}`;
const BAD_AUTH = {
  'no cookie': () => '',
  'forged signature': () => `admin=${Date.now() + 1e6}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
  'signed with another secret': () => signed(Date.now() + 1e6, 'x'.repeat(40)),
  'expired session': () => signed(Date.now() - 1000, process.env.SESSION_SECRET),
  'malformed cookie value': () => 'admin=garbage',
};

// 2 events x 11 host routes x 5 bad-auth kinds = 110 scenarios.
for (const ev of EVENTS) {
  for (const [method, path] of ADMIN_ROUTES) {
    for (const [kind, cookie] of Object.entries(BAD_AUTH)) {
      test(`${id()} auth: ${ev} ${method} ${path} with ${kind} -> 401, no change`, async () => {
        const before = await state(ctx, ev);
        const r = await raw(ctx, `${pre(ev)}${path}`, { method, body: method === 'GET' ? undefined : {}, cookie: cookie() || '', auth: false });
        assert.equal(r.status, 401);
        assert.equal(typeof r.body.error, 'string');
        assert.deepEqual(await state(ctx, ev), before);
      });
    }
  }
}

// Valid cookie is accepted by every host GET in both events.
for (const ev of EVENTS) {
  for (const path of ['/admin', '/tournaments', '/export.xlsx']) {
    test(`${id()} auth: ${ev} GET ${path} with a valid session -> 200`, async () => {
      assert.equal((await raw(ctx, `${pre(ev)}${path}`)).status, 200);
    });
  }
}

// Wrong HTTP method on known paths -> 404 (no handler), never 500 or a state change.
const WRONG_METHODS = [
  ['DELETE', '/state'], ['POST', '/state'], ['PUT', '/leaderboard'], ['GET', '/guess'], ['GET', '/draw'],
  ['GET', '/undo'], ['GET', '/finalize'], ['GET', '/start'], ['DELETE', '/players'], ['POST', '/admin'],
  ['DELETE', '/tournament'], ['PUT', '/draw'],
];
for (const ev of EVENTS) {
  for (const [method, path] of WRONG_METHODS) {
    test(`${id()} method: ${ev} ${method} ${path} -> 404 JSON, no change`, async () => {
      const before = await state(ctx, ev);
      const r = await raw(ctx, `${pre(ev)}${path}`, { method, body: method === 'GET' ? undefined : {} });
      assert.equal(r.status, 404);
      assert.deepEqual(await state(ctx, ev), before);
    });
  }
}

// Unknown paths: 404 with or without a session (never 401 that hints a route exists).
const UNKNOWN = ['/nope', '/admin/x', '/kids/kids/state', '/state/extra', '/export.csv', '/auth/admin', '/state.json'];
for (const path of UNKNOWN) {
  for (const auth of [true, false]) {
    test(`${id()} unknown: GET ${path} (${auth ? 'logged in' : 'anonymous'}) -> 404`, async () => {
      const r = await raw(ctx, path, { auth });
      assert.equal(r.status, 404, JSON.stringify(r.body));
    });
  }
}
for (const auth of [true, false]) {
  test(`${id()} unknown: GET /kids/nope (${auth ? 'logged in' : 'anonymous'}) -> 404`, async () => {
    assert.equal((await raw(ctx, '/kids/nope', { auth })).status, 404);
  });
}

// Malformed JSON and wrong content types on every mutating route -> 4xx, no change.
const MUTATING = [['PATCH', '/tournament'], ['POST', '/tournaments'], ['PUT', '/players'], ['POST', '/players/import'], ['POST', '/start'], ['POST', '/draw'], ['POST', '/undo'], ['POST', '/finalize'], ['POST', '/guess']];
for (const ev of EVENTS) {
  for (const [method, path] of MUTATING) {
    test(`${id()} malformed JSON: ${ev} ${method} ${path} -> 400, no change`, async () => {
      const before = await state(ctx, ev);
      const r = await raw(ctx, `${pre(ev)}${path}`, { method, rawBody: '{"broken": ', headers: { 'content-type': 'application/json' } });
      assert.equal(r.status, 400);
      assert.deepEqual(await state(ctx, ev), before);
    });
    test(`${id()} text/plain body: ${ev} ${method} ${path} -> treated as empty (4xx or no-op 200), no change`, async () => {
      const before = await state(ctx, ev);
      const r = await raw(ctx, `${pre(ev)}${path}`, { method, rawBody: 'hello', headers: { 'content-type': 'text/plain' } });
      assert.ok(r.status < 500, `got ${r.status}`);
      assert.deepEqual(await state(ctx, ev), before);
    });
  }
}
test(`${id()} oversized body (> 6 MB) -> 413`, async () => {
  const r = await raw(ctx, '/players/import', { method: 'POST', rawBody: JSON.stringify({ filename: 'a.csv', data: 'x'.repeat(7 * 1024 * 1024) }), headers: { 'content-type': 'application/json' } });
  assert.equal(r.status, 413);
});
test(`${id()} body that is a JSON array -> 400 from players`, async () => {
  assert.equal((await raw(ctx, '/players', { method: 'PUT', body: [] })).status, 400);
});

// ---------- settings validation (DRAFT tournament) ----------
test(`${id()} setup: fresh DRAFT tournaments for validation`, async () => {
  await ok(ctx, '/tournaments', { method: 'POST', body: { name: 'Validation main' } });
  await ok(ctx, '/kids/tournaments', { method: 'POST', body: { name: 'Validation kids' } });
});
const SETTINGS = [
  ['name empty', { name: '' }, 400], ['name spaces only', { name: '   ' }, 400], ['name 1 char', { name: 'X' }, 200],
  ['name 100 chars', { name: 'N'.repeat(100) }, 200], ['name 101 chars', { name: 'N'.repeat(101) }, 400],
  ['name number', { name: 123 }, 200], ['name null', { name: null }, 400],
  ['spinMs -1', { spinMs: -1 }, 400], ['spinMs 0', { spinMs: 0 }, 200], ['spinMs 30000', { spinMs: 30000 }, 200],
  ['spinMs 30001', { spinMs: 30001 }, 400], ['spinMs 1.5', { spinMs: 1.5 }, 400], ['spinMs "5000"', { spinMs: '5000' }, 400],
  ['spinMs null', { spinMs: null }, 400], ['predictions false', { predictions: false }, 200], ['predictions true', { predictions: true }, 200],
  ['predictions "yes"', { predictions: 'yes' }, 400], ['predictions 1', { predictions: 1 }, 400],
  ['unknown field ignored', { hacker: true }, 200], ['status cannot be set', { status: 'COMPLETED' }, 200],
];
for (const ev of EVENTS) {
  for (const [label, body, code] of SETTINGS) {
    test(`${id()} settings: ${ev} ${label} -> ${code}`, async () => {
      const r = await raw(ctx, `${pre(ev)}/tournament`, { method: 'PATCH', body });
      assert.equal(r.status, code, JSON.stringify(r.body));
      const s = await state(ctx, ev);
      assert.equal(s.status, 'DRAFT', 'status is never settable');
    });
  }
}
const MAIN_CATS = [
  ['empty list', [], 400], ['not an array', 'A', 400], ['duplicate', ['A', 'A'], 400], ['unknown key', ['A', 'X'], 400],
  ['kids key in main', ['A', 'ICON'], 400], ['lowercase key', ['a'], 400], ['single A', ['A'], 200], ['all five', ['A', 'WOMEN', 'B', 'C', 'D'], 200],
  ['D first', ['D', 'A'], 200], ['default order', ['A', 'WOMEN', 'B', 'C'], 200],
];
for (const [label, categories, code] of MAIN_CATS) {
  test(`${id()} categories (main): ${label} -> ${code}`, async () => {
    assert.equal((await raw(ctx, '/tournament', { method: 'PATCH', body: { categories } })).status, code);
  });
}
for (const [label, categories] of [['valid-looking', ['ICON', 'BOY', 'GIRL1', 'GIRL2']], ['reordered', ['BOY', 'ICON', 'GIRL1', 'GIRL2']], ['main keys', ['A']]]) {
  test(`${id()} categories (kids): ${label} -> 409 fixed format`, async () => {
    assert.equal((await raw(ctx, '/kids/tournament', { method: 'PATCH', body: { categories } })).status, 409);
  });
}

// ---------- player list validation ----------
const n28 = (p, k = 28) => Array.from({ length: k }, (_, i) => `${p} ${i + 1}`);
const LISTS = [
  ['lists missing', {}, 400], ['lists null', { lists: null }, 400], ['lists array', { lists: [] }, 400],
  ['unknown category', { lists: { Z: ['a'] } }, 400], ['kids list in main', { lists: { GIRL: ['a'] } }, 400],
  ['list not an array', { lists: { A: 'x' } }, 400], ['201 names', { lists: { A: n28('P', 201) } }, 400],
  ['200 names ok', { lists: { A: n28('P', 200) } }, 200], ['name 61 chars', { lists: { A: ['x'.repeat(61)] } }, 400],
  ['name 60 chars', { lists: { A: ['y'.repeat(60)] } }, 200], ['duplicate in list', { lists: { A: ['Rahul', 'Rahul'] } }, 400],
  ['duplicate case-insensitive', { lists: { A: ['Rahul', 'RAHUL'] } }, 400], ['duplicate whitespace', { lists: { A: ['Rahul Shah', ' Rahul  Shah '] } }, 400],
  ['duplicate via zero-width space', { lists: { A: ['Rahul', 'Ra​hul'] } }, 400], ['duplicate via decomposed accent', { lists: { A: ['José', 'José'] } }, 400],
  ['duplicate across lists', { lists: { A: ['Rahul'], B: ['rahul'] } }, 400], ['blank names dropped', { lists: { A: ['', '  ', 'Ok'] } }, 200],
  ['numbers become strings', { lists: { A: [1, 2, 3] } }, 200], ['empty list allowed while DRAFT', { lists: { A: [] } }, 200],
  ['28 names', { lists: { A: n28('A') } }, 200],
];
for (const [label, body, code] of LISTS) {
  test(`${id()} players (main DRAFT): ${label} -> ${code}`, async () => {
    const r = await raw(ctx, '/players', { method: 'PUT', body });
    assert.equal(r.status, code, JSON.stringify(r.body));
    if (code !== 200) assert.equal(typeof r.body.error, 'string');
  });
}
test(`${id()} players: a rejected save leaves the previous list intact`, async () => {
  await ok(ctx, '/players', { method: 'PUT', body: { lists: { WOMEN: n28('W') } } });
  assert.equal((await raw(ctx, '/players', { method: 'PUT', body: { lists: { WOMEN: ['dup', 'dup'] } } })).status, 400);
  assert.equal((await ok(ctx, '/admin')).lists.WOMEN.length, 28);
});
const KIDS_LISTS = [
  ['main list in kids', { lists: { A: ['x'] } }, 400], ['round key instead of list', { lists: { GIRL1: ['x'] } }, 400],
  ['icon 4', { lists: { ICON: n28('I', 4) } }, 200], ['boy 4', { lists: { BOY: n28('B', 4) } }, 200], ['girls 8', { lists: { GIRL: n28('G', 8) } }, 200],
  ['girl duplicates a boy', { lists: { GIRL: ['B 1'] } }, 400],
];
for (const [label, body, code] of KIDS_LISTS) {
  test(`${id()} players (kids DRAFT): ${label} -> ${code}`, async () => {
    assert.equal((await raw(ctx, '/kids/players', { method: 'PUT', body })).status, code);
  });
}

// ---------- start readiness ----------
const START = [['main: first list has 28', 'main', 200], ['kids: icon list has 4', 'kids', 200]];
test(`${id()} start: main refuses with 27 players in the first category`, async () => {
  await ok(ctx, '/tournament', { method: 'PATCH', body: { categories: ['A', 'WOMEN'] } });
  await ok(ctx, '/players', { method: 'PUT', body: { lists: { A: n28('A', 27) } } });
  const r = await raw(ctx, '/start', { method: 'POST' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /exactly 28 players \(has 27\)/);
});
test(`${id()} start: main refuses with 29 players`, async () => {
  await ok(ctx, '/players', { method: 'PUT', body: { lists: { A: n28('A', 29) } } });
  assert.equal((await raw(ctx, '/start', { method: 'POST' })).status, 400);
});
test(`${id()} start: kids refuses with 3 icon boys`, async () => {
  await ok(ctx, '/kids/players', { method: 'PUT', body: { lists: { ICON: n28('I', 3) } } });
  assert.equal((await raw(ctx, '/kids/start', { method: 'POST' })).status, 400);
});
for (const [label, ev] of START) {
  test(`${id()} start: ${label} -> 200 then a second start -> 409`, async () => {
    if (ev === 'main') await ok(ctx, '/players', { method: 'PUT', body: { lists: { A: n28('A'), WOMEN: n28('W') } } });
    else await ok(ctx, '/kids/players', { method: 'PUT', body: { lists: { ICON: n28('I', 4) } } });
    assert.equal((await raw(ctx, `${pre(ev)}/start`, { method: 'POST' })).status, 200);
    assert.equal((await raw(ctx, `${pre(ev)}/start`, { method: 'POST' })).status, 409);
    assert.equal((await state(ctx, ev)).status, 'LIVE');
  });
}

// ---------- draw request fuzz (LIVE, first round) ----------
const BAD_DRAW = [
  ['no body', undefined], ['empty object', {}], ['category null', { category: null, team: 1 }], ['category number', { category: 1, team: 1 }],
  ['category object', { category: {}, team: 1 }], ['category array', { category: ['A'], team: 1 }], ['category wrong case', { category: 'a', team: 1 }],
  ['team string', { category: 'A', team: '1' }], ['team 0', { category: 'A', team: 0 }], ['team -1', { category: 'A', team: -1 }],
  ['team 2 (stale/ahead)', { category: 'A', team: 2 }], ['team 29', { category: 'A', team: 29 }], ['team float', { category: 'A', team: 1.5 }],
  ['team null', { category: 'A', team: null }], ['next round category', { category: 'WOMEN', team: 1 }], ['kids category in main', { category: 'ICON', team: 1 }],
];
for (const [label, body] of BAD_DRAW) {
  test(`${id()} draw fuzz (main): ${label} -> 409/400, nothing drawn`, async () => {
    const before = await state(ctx);
    const r = await raw(ctx, '/draw', { method: 'POST', body });
    assert.ok([400, 409].includes(r.status), `got ${r.status}`);
    const after = await state(ctx);
    assert.deepEqual(after.teams, before.teams);
    assert.equal(after.pending, null);
  });
}
const BAD_KIDS_DRAW = [['main category', { category: 'A', team: 1 }], ['boy before icon', { category: 'BOY', team: 1 }], ['team 5', { category: 'ICON', team: 5 }], ['team string', { category: 'ICON', team: '1' }]];
for (const [label, body] of BAD_KIDS_DRAW) {
  test(`${id()} draw fuzz (kids): ${label} -> 409, nothing drawn`, async () => {
    const before = await state(ctx, 'kids');
    assert.equal((await raw(ctx, '/kids/draw', { method: 'POST', body })).status, 409);
    assert.deepEqual((await state(ctx, 'kids')).teams, before.teams);
  });
}
const BAD_UNDO = [['no actionId', {}], ['wrong actionId', { actionId: 'nope' }], ['actionId number', { actionId: 5 }], ['actionId object', { actionId: {} }]];
for (const ev of EVENTS) {
  for (const [label, body] of BAD_UNDO) {
    test(`${id()} undo fuzz (${ev}): ${label} with nothing drawn -> 409`, async () => {
      assert.equal((await raw(ctx, `${pre(ev)}/undo`, { method: 'POST', body })).status, 409);
    });
  }
  for (const [label, body] of [['no category', {}], ['wrong category', { category: 'B' }], ['current but incomplete', null]]) {
    test(`${id()} finalize fuzz (${ev}): ${label} -> 409`, async () => {
      const s = await state(ctx, ev);
      assert.equal((await raw(ctx, `${pre(ev)}/finalize`, { method: 'POST', body: body ?? { category: s.current } })).status, 409);
    });
  }
}

// ---------- response shapes ----------
for (const ev of EVENTS) {
  test(`${id()} shape: ${ev} public state has the documented fields`, async () => {
    const s = await state(ctx, ev);
    for (const k of ['id', 'event', 'name', 'status', 'teamCount', 'spinMs', 'categories', 'current', 'mode', 'currentTeam', 'remaining', 'teams', 'pending', 'last', 'predictions', 'recent']) assert.ok(k in s, k);
    assert.equal(s.event, ev);
    assert.equal(s.teams.length, s.teamCount);
    for (const c of s.categories) for (const k of ['key', 'label', 'short', 'shuffle', 'state', 'players', 'needed', 'assigned', 'ready']) assert.ok(k in c, `${c.key}.${k}`);
  });
  test(`${id()} shape: ${ev} admin state has lists/pools/available/editable/history`, async () => {
    const a = await ok(ctx, `${pre(ev)}/admin`);
    for (const k of ['event', 'fixed', 'available', 'pools', 'lists', 'editable', 'history']) assert.ok(k in a, k);
  });
  test(`${id()} shape: ${ev} public state never contains salts or player ids`, async () => {
    const txt = JSON.stringify(await state(ctx, ev));
    assert.ok(!/"playerId"|"_id"|"nameKey"/.test(txt));
  });
  test(`${id()} shape: ${ev} leaderboard without voter`, async () => {
    const b = await ok(ctx, `${pre(ev)}/leaderboard`, { auth: false });
    assert.deepEqual(Object.keys(b).sort(), ['last', 'me', 'players', 'top']);
  });
  for (const voter of ['', 'x', 'a'.repeat(500), '<script>', '%00']) {
    test(`${id()} leaderboard (${ev}): odd voter ${JSON.stringify(voter).slice(0, 20)} -> 200, me null`, async () => {
      const b = await ok(ctx, `${pre(ev)}/leaderboard?voter=${encodeURIComponent(voter)}`, { auth: false });
      assert.equal(b.me, null);
    });
  }
}
test(`${id()} health: 200 with db up`, async () => {
  assert.deepEqual((await raw(ctx, '/health', { auth: false })).body, { ok: true, db: 'up' });
});
test(`${id()} health: also reachable at /api/kids/health? -> 404 (not a kids route)`, async () => {
  assert.equal((await raw(ctx, '/kids/health', { auth: false })).status, 404);
});
for (const pw of [undefined, null, 1, true, {}, [], '', ' qa-password', 'QA-PASSWORD', 'qa-password ']) {
  test(`${id()} login: password ${JSON.stringify(pw)} -> 401`, async () => {
    const r = await raw(ctx, '/auth/login', { method: 'POST', body: { password: pw }, auth: false, headers: { 'x-forwarded-for': `10.9.${n}.1` } });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('set-cookie'), null);
  });
}
test(`${id()} auth/me: anonymous -> admin false; logged in -> true`, async () => {
  assert.equal((await raw(ctx, '/auth/me', { auth: false })).body.admin, false);
  assert.equal((await raw(ctx, '/auth/me')).body.admin, true);
});
test(`${id()} errors: 4xx responses are JSON { error } without stack traces`, async () => {
  const r = await raw(ctx, '/draw', { method: 'POST', body: { category: 'zzz', team: 1 } });
  assert.equal(typeof r.body.error, 'string');
  assert.ok(!/at .*\.js:\d+/.test(JSON.stringify(r.body)));
});
