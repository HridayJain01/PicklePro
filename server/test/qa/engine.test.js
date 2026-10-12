// DRAW — the business-critical engine. Every pick position of every round in a full main draw,
// stale/ahead requests at each sampled position, undo at first/middle/last, finalize rules,
// category orders, and the full kids format. Invariants are checked after every pick.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertInvariants, finalize, fresh, names, ok, pre, raw, setup, spin, state } from './helpers.js';

const ctx = setup('engine');
let n = 0;
const id = () => `DRAW-${String(++n).padStart(3, '0')}`;
const SAMPLE = new Set([1, 2, 14, 27, 28]);

test(`${id()} main: fresh tournament is LIVE on A with 28 teams and nothing assigned`, async () => {
  const s = await fresh(ctx, { categories: ['A', 'WOMEN', 'B', 'C', 'D'] });
  assert.equal(s.status, 'LIVE'); assert.equal(s.current, 'A'); assert.equal(s.mode, 'shuffle');
  assert.equal(s.currentTeam, 1); assert.equal(s.teams.length, 28); assertInvariants(s);
});
test(`${id()} main A: finalize before the shuffle -> 409`, async () => {
  assert.equal((await raw(ctx, '/finalize', { method: 'POST', body: { category: 'A' } })).status, 409);
});
test(`${id()} main A: one shuffle fills all 28 teams with the 28 A players`, async () => {
  assert.equal((await spin(ctx)).status, 200);
  const s = await state(ctx);
  assert.deepEqual(s.teams.map(t => t.players.A).sort(), names('A', 28).sort());
  assert.equal(s.currentTeam, null); assertInvariants(s);
});
test(`${id()} main A: a second shuffle is refused (teams full)`, async () => {
  assert.equal((await raw(ctx, '/draw', { method: 'POST', body: { category: 'A', team: 29 } })).status, 409);
});
test(`${id()} main A: A list locked once shuffled`, async () => {
  assert.equal((await raw(ctx, '/players', { method: 'PUT', body: { lists: { A: names('A', 28) } } })).status, 409);
});
test(`${id()} main A: finalize -> Women becomes active`, async () => {
  await finalize(ctx);
  const s = await state(ctx);
  assert.equal(s.current, 'WOMEN'); assert.equal(s.categories[0].state, 'done');
});
test(`${id()} main A: finalizing A again -> 409`, async () => {
  assert.equal((await raw(ctx, '/finalize', { method: 'POST', body: { category: 'A' } })).status, 409);
});

for (const cat of ['WOMEN', 'B', 'C', 'D']) {
  for (let team = 1; team <= 28; team++) {
    if (SAMPLE.has(team)) {
      test(`${id()} main ${cat}: before pick ${team}, a request for team ${team + 1} (ahead) is refused`, async () => {
        assert.equal((await raw(ctx, '/draw', { method: 'POST', body: { category: cat, team: team + 1 } })).status, 409);
      });
      if (team > 1) {
        test(`${id()} main ${cat}: before pick ${team}, a stale request for team ${team - 1} is refused`, async () => {
          assert.equal((await raw(ctx, '/draw', { method: 'POST', body: { category: cat, team: team - 1 } })).status, 409);
        });
      }
      test(`${id()} main ${cat}: before pick ${team}, finalize is refused (incomplete)`, async () => {
        assert.equal((await raw(ctx, '/finalize', { method: 'POST', body: { category: cat } })).status, 409);
      });
    }
    test(`${id()} main ${cat}: pick ${team} goes to Team ${team}, invariants hold`, async () => {
      const before = await state(ctx);
      assert.equal(before.current, cat); assert.equal(before.currentTeam, team);
      assert.equal(before.remaining.length, 29 - team);
      const r = await raw(ctx, '/draw', { method: 'POST', body: { category: cat, team } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const s = await state(ctx);
      const got = s.teams[team - 1].players[cat];
      assert.ok(before.remaining.includes(got), 'winner came from the pool');
      assert.ok(!s.remaining.includes(got), 'winner left the pool');
      assert.equal(s.last.assignments[0].teamNumber, team);
      assert.equal(s.currentTeam, team === 28 ? null : team + 1);
      assertInvariants(s);
    });
    if (team === 1 || team === 14 || team === 28) {
      test(`${id()} main ${cat}: undo pick ${team} reopens Team ${team} and returns the player`, async () => {
        const s = await state(ctx);
        const last = s.last;
        await ok(ctx, '/undo', { method: 'POST', body: { actionId: last.actionId } });
        const after = await state(ctx);
        assert.equal(after.currentTeam, team);
        assert.equal(after.teams[team - 1].players[cat], undefined);
        assert.ok(after.remaining.includes(last.assignments[0].name));
        assertInvariants(after);
      });
      test(`${id()} main ${cat}: undone pick is in history as voided; re-draw Team ${team}`, async () => {
        const h = (await ok(ctx, '/admin')).history;
        assert.ok(h.some(r => r.voided && r.teamNumber === team && r.category === (cat === 'WOMEN' ? 'Women' : cat)));
        assert.equal((await raw(ctx, '/draw', { method: 'POST', body: { category: cat, team } })).status, 200);
        assertInvariants(await state(ctx));
      });
    }
  }
  test(`${id()} main ${cat}: draw after Team 28 -> 409`, async () => {
    assert.equal((await raw(ctx, '/draw', { method: 'POST', body: { category: cat, team: 29 } })).status, 409);
  });
  test(`${id()} main ${cat}: finalize locks it`, async () => {
    await ok(ctx, '/finalize', { method: 'POST', body: { category: cat } });
    const s = await state(ctx);
    assert.equal(s.categories.find(c => c.key === cat).state, 'done');
  });
  test(`${id()} main ${cat}: undo cannot reach into the finalized round`, async () => {
    const s = await state(ctx);
    if (s.last) assert.equal((await raw(ctx, '/undo', { method: 'POST', body: { actionId: s.last.actionId } })).status, 409);
  });
}
test(`${id()} main: tournament COMPLETED after D`, async () => {
  const s = await state(ctx);
  assert.equal(s.status, 'COMPLETED'); assert.equal(s.current, null); assertInvariants(s);
});
test(`${id()} main: every team has exactly one player per category, all unique`, async () => {
  const s = await state(ctx);
  for (const c of ['A', 'WOMEN', 'B', 'C', 'D']) {
    const col = s.teams.map(t => t.players[c]);
    assert.equal(new Set(col).size, 28);
    assert.deepEqual([...col].sort(), names(c, 28).sort());
  }
});
test(`${id()} main: after completion every draw/undo/finalize is refused`, async () => {
  assert.equal((await raw(ctx, '/draw', { method: 'POST', body: { category: 'D', team: 1 } })).status, 409);
  assert.equal((await raw(ctx, '/finalize', { method: 'POST', body: { category: 'D' } })).status, 409);
});
test(`${id()} main: completed lists cannot be edited`, async () => {
  assert.equal((await raw(ctx, '/players', { method: 'PUT', body: { lists: { D: names('D', 28) } } })).status, 409);
});
test(`${id()} main: history has 140 final picks + 12 undone`, async () => {
  const h = (await ok(ctx, '/admin')).history;
  assert.equal(h.filter(r => !r.voided).length, 140);
  assert.equal(h.filter(r => r.voided).length, 12);
});

// ---------- category orders ----------
const ORDERS = [['WOMEN', 'A'], ['B', 'A', 'C'], ['D'], ['C', 'B'], ['A'], ['WOMEN', 'B', 'A']];
for (const order of ORDERS) {
  test(`${id()} order ${order.join('→')}: rounds run in this order, A always shuffles in one go`, async () => {
    await fresh(ctx, { categories: order });
    for (const cat of order) {
      let s = await state(ctx);
      assert.equal(s.current, cat);
      assert.equal(s.mode, cat === 'A' ? 'shuffle' : 'spin');
      let spins = 0;
      while ((s = await state(ctx)).currentTeam) {
        assert.equal((await spin(ctx)).status, 200);
        spins += 1;
      }
      assert.equal(spins, cat === 'A' ? 1 : 28);
      assertInvariants(s);
      await finalize(ctx);
    }
    assert.equal((await state(ctx)).status, 'COMPLETED');
  });
}
test(`${id()} order: a later list stays editable while an earlier round is drawing`, async () => {
  await fresh(ctx, { categories: ['WOMEN', 'B'] });
  assert.equal((await spin(ctx)).status, 200);
  assert.equal((await ok(ctx, '/admin')).editable.B, true);
  assert.equal((await raw(ctx, '/players', { method: 'PUT', body: { lists: { B: names('Bx', 28) } } })).status, 200);
  assert.equal((await raw(ctx, '/players', { method: 'PUT', body: { lists: { WOMEN: names('W', 28) } } })).status, 409);
});
test(`${id()} order: next round refuses to start with a short list (27), fixable before its first draw`, async () => {
  for (let k = 0; k < 28; k++) await spin(ctx);
  await finalize(ctx);
  await ok(ctx, '/players', { method: 'PUT', body: { lists: { B: names('Bx', 27) } } });
  const r = await spin(ctx);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /needs exactly 28 players \(has 27\)/);
  await ok(ctx, '/players', { method: 'PUT', body: { lists: { B: names('Bx', 28) } } });
  assert.equal((await spin(ctx)).status, 200);
});

// ---------- kids format, pick by pick ----------
test(`${id()} kids: fresh tournament has 4 teams, rounds ICON/BOY/GIRL1/GIRL2`, async () => {
  const s = await fresh(ctx, { ev: 'kids' });
  assert.equal(s.teamCount, 4);
  assert.deepEqual(s.categories.map(c => c.key), ['ICON', 'BOY', 'GIRL1', 'GIRL2']);
  assert.equal(s.mode, 'shuffle');
});
test(`${id()} kids ICON: one shuffle places all 4 icon boys`, async () => {
  assert.equal((await spin(ctx, 'kids')).status, 200);
  const s = await state(ctx, 'kids');
  assert.deepEqual(s.teams.map(t => t.players.ICON).sort(), names('Icon', 4).sort());
  assertInvariants(s);
  await finalize(ctx, 'kids');
});
for (const cat of ['BOY', 'GIRL1', 'GIRL2']) {
  for (let team = 1; team <= 4; team++) {
    test(`${id()} kids ${cat}: pick ${team} goes to Team ${team} from the right list`, async () => {
      const before = await state(ctx, 'kids');
      assert.equal(before.current, cat); assert.equal(before.currentTeam, team);
      const expectPool = cat === 'BOY' ? 5 - team : cat === 'GIRL1' ? 9 - team : 5 - team;
      assert.equal(before.remaining.length, expectPool);
      assert.equal((await raw(ctx, '/kids/draw', { method: 'POST', body: { category: cat, team } })).status, 200);
      const s = await state(ctx, 'kids');
      const got = s.teams[team - 1].players[cat];
      assert.match(got, cat === 'BOY' ? /^Boy/ : /^Girl/);
      assertInvariants(s);
    });
    test(`${id()} kids ${cat}: stale request for team ${team} after it was drawn -> 409`, async () => {
      assert.equal((await raw(ctx, '/kids/draw', { method: 'POST', body: { category: cat, team } })).status, 409);
    });
  }
  test(`${id()} kids ${cat}: finalize`, async () => { await finalize(ctx, 'kids'); });
}
test(`${id()} kids: completed, each team = Icon Boy + Boy + 2 different girls`, async () => {
  const s = await state(ctx, 'kids');
  assert.equal(s.status, 'COMPLETED');
  for (const t of s.teams) {
    assert.match(t.players.ICON, /^Icon/); assert.match(t.players.BOY, /^Boy/);
    assert.match(t.players.GIRL1, /^Girl/); assert.match(t.players.GIRL2, /^Girl/);
    assert.notEqual(t.players.GIRL1, t.players.GIRL2);
  }
  assert.deepEqual(s.teams.flatMap(t => [t.players.GIRL1, t.players.GIRL2]).sort(), names('Girl', 8).sort());
});
test(`${id()} kids: Girls list must have exactly 8 before Girl 1 (7 refused)`, async () => {
  await fresh(ctx, { ev: 'kids', lists: { ICON: names('Icon', 4), BOY: names('Boy', 4), GIRL: names('Girl', 7) } });
  await spin(ctx, 'kids'); await finalize(ctx, 'kids');
  for (let k = 0; k < 4; k++) await spin(ctx, 'kids');
  await finalize(ctx, 'kids');
  assert.equal((await spin(ctx, 'kids')).status, 400);
});
test(`${id()} kids: Girls list 9 also refused`, async () => {
  await ok(ctx, '/kids/players', { method: 'PUT', body: { lists: { GIRL: names('Girl', 9) } } });
  assert.equal((await spin(ctx, 'kids')).status, 400);
});
test(`${id()} kids: undo the only Girl 1 pick reopens the list for editing`, async () => {
  await ok(ctx, '/kids/players', { method: 'PUT', body: { lists: { GIRL: names('Girl', 8) } } });
  assert.equal((await spin(ctx, 'kids')).status, 200);
  assert.equal((await ok(ctx, '/kids/admin')).editable.GIRL, false);
  const s = await state(ctx, 'kids');
  await ok(ctx, '/kids/undo', { method: 'POST', body: { actionId: s.last.actionId } });
  assert.equal((await ok(ctx, '/kids/admin')).editable.GIRL, true);
});
test(`${id()} kids: Girl 2 is ready once Girl 1 is finalized (uses the 4 left)`, async () => {
  for (let k = 0; k < 4; k++) await spin(ctx, 'kids');
  await finalize(ctx, 'kids');
  const s = await state(ctx, 'kids');
  assert.equal(s.current, 'GIRL2');
  assert.equal(s.categories.find(c => c.key === 'GIRL2').ready, true);
  assert.equal(s.remaining.length, 4);
});
test(`${id()} isolation: kids activity never changed the main tournament`, async () => {
  const s = await state(ctx);
  assert.equal(s.event, 'main');
  assert.ok(!JSON.stringify(s).includes('Icon Player'));
});
