// UNIT — pure functions: name cleaning, shuffle, spreadsheet headers/parsing, fairness hashing,
// event/round configuration. No database needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { cleanName, proofText, sha256, shuffle, isShuffle } from '../../src/draw.js';
import { headerCategory, parseUpload } from '../../src/excel.js';
import { ALL_CATEGORIES, ALL_POOLS, EVENTS, LABELS, SHORT, SHUFFLE, eventOf, poolOf } from '../../src/models.js';
import * as clientFair from '../../../client/src/fair.js';

// ---------- cleanName ----------
const CLEAN = [
  ['plain', 'Rahul Shah', 'Rahul Shah'],
  ['trim both ends', '  Rahul  ', 'Rahul'],
  ['collapse inner spaces', 'Rahul    Shah', 'Rahul Shah'],
  ['tabs', 'Rahul\tShah', 'Rahul Shah'],
  ['newlines', 'Rahul\nShah', 'Rahul Shah'],
  ['carriage return', 'Rahul\r\nShah', 'Rahul Shah'],
  ['non-breaking space', 'Rahul Shah', 'Rahul Shah'],
  ['null', null, ''],
  ['undefined', undefined, ''],
  ['number', 42, '42'],
  ['empty', '', ''],
  ['spaces only', '     ', ''],
  ['unicode letters kept', 'Zoë Ångström', 'Zoë Ångström'],
  ['devanagari kept', 'राहुल शाह', 'राहुल शाह'],
  ['apostrophe kept', "D'Souza", "D'Souza"],
  ['hyphen kept', 'Anne-Marie', 'Anne-Marie'],
  ['dot kept', 'R. K. Shah', 'R. K. Shah'],
  ['emoji kept', 'Ace 🏓', 'Ace 🏓'],
  ['formula-like kept as text', '=SUM(A1)', '=SUM(A1)'],
  ['html-like kept as text', '<b>x</b>', '<b>x</b>'],
  ['zero-width space removed', 'Ra​hul', 'Rahul'],
  ['zero-width joiner removed', 'Ra‍hul', 'Rahul'],
  ['byte-order mark removed', '﻿Rahul', 'Rahul'],
  ['soft hyphen removed', 'Ra­hul', 'Rahul'],
  ['control chars removed', 'Ra\u0000h\u0007ul', 'Rahul'],
  ['NFC: decomposed é equals composed', 'José', 'José'],
  ['NFC: decomposed ö', 'Zöe', 'Zöe'],
  ['bidi override removed', '‮Rahul', 'Rahul'],
  ['ideographic space', 'Rahul　Shah', 'Rahul Shah'],
  ['line separator', 'Rahul Shah', 'Rahul Shah'],
];
for (const [i, [label, input, expected]] of CLEAN.entries()) {
  test(`UNIT-${String(i + 1).padStart(3, '0')} cleanName: ${label}`, () => {
    assert.equal(cleanName(input), expected);
  });
}

// ---------- shuffle ----------
const SIZES = [0, 1, 2, 3, 4, 5, 8, 16, 27, 28, 29, 50, 100, 200];
for (const [i, n] of SIZES.entries()) {
  test(`UNIT-${String(31 + i).padStart(3, '0')} shuffle: size ${n} returns a permutation and leaves the input untouched`, () => {
    const input = Array.from({ length: n }, (_, k) => k);
    const copy = [...input];
    const out = shuffle(input);
    assert.deepEqual(input, copy, 'input not mutated');
    assert.equal(out.length, n);
    assert.deepEqual([...out].sort((a, b) => a - b), input);
  });
}
test('UNIT-045 shuffle: works on objects and keeps identity', () => {
  const a = { n: 1 }; const b = { n: 2 }; const c = { n: 3 };
  const out = shuffle([a, b, c]);
  assert.equal(new Set(out).size, 3);
  assert.ok(out.includes(a) && out.includes(b) && out.includes(c));
});
test('UNIT-046 shuffle: repeated calls are not all identical (randomness present)', () => {
  const base = Array.from({ length: 28 }, (_, k) => k);
  const seen = new Set(Array.from({ length: 20 }, () => shuffle(base).join(',')));
  assert.ok(seen.size > 15);
});
test('UNIT-047 shuffle: statistical uniformity of first position (n=4, 40k samples, chi-square < 25)', () => {
  // Documented statistical check, separate from the invariant tests; not proof of security.
  const counts = [0, 0, 0, 0];
  const N = 40000;
  for (let k = 0; k < N; k++) counts[shuffle([0, 1, 2, 3])[0]] += 1;
  const exp = N / 4;
  const chi = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  assert.ok(chi < 25, `chi-square ${chi.toFixed(2)} counts ${counts}`);
});
test('UNIT-048 shuffle: every position reachable for each item (n=5, 5k samples)', () => {
  const hit = Array.from({ length: 5 }, () => new Set());
  for (let k = 0; k < 5000; k++) shuffle([0, 1, 2, 3, 4]).forEach((v, pos) => hit[v].add(pos));
  hit.forEach((s, v) => assert.equal(s.size, 5, `item ${v}`));
});

// ---------- headerCategory ----------
const HEADERS = [
  ['A', 'A'], ['a', 'A'], ['A Player', 'A'], ['A Players', 'A'], ['Category A', 'A'], ['Cat B', 'B'], ['Group C', 'C'],
  ['  d  ', 'WOMEN'], ['B-Players', 'B'], ['C_player', 'C'], ['Women', 'WOMEN'], ['WOMEN', 'WOMEN'], ['woman', 'WOMEN'],
  ['Ladies', 'WOMEN'], ['W', 'WOMEN'], ['Icon Boy', 'ICON'], ['icon', 'ICON'], ['ICON BOYS', 'ICON'], ['Boy', 'BOY'],
  ['Boys', 'BOY'], ['boy players', 'BOY'], ['Girl', 'GIRL'], ['Girls', 'GIRL'], ['girl player', 'GIRL'], ['Girl Cat 1', 'GIRL1'], ['Girl Cat 2', 'GIRL2'], ['Boy Cat 1', 'ICON'], ['Boy Cat 2', 'BOY'], ['M1', 'A'], ['M2', 'B'], ['m3', 'C'], ['W1', 'WOMEN'], ['B1', 'ICON'], ['G1', 'GIRL1'], ['B2', 'BOY'], ['G2', 'GIRL2'], ['M1 Players', 'A'],
  ['E', 'D'], ['F', null], ['Notes', null], ['', null], ['Team', null], ['Category', null], ['Player', null], ['AB', null],
  ['Men', null], ['123', null], ['Boyfriend', null], ['Girlfriend', null], ['Women Team', 'WOMEN'],
];
for (const [i, [header, expected]] of HEADERS.entries()) {
  test(`UNIT-${String(49 + i).padStart(3, '0')} headerCategory: ${JSON.stringify(header)} -> ${expected}`, () => {
    assert.equal(headerCategory(header), expected);
  });
}

// ---------- parseUpload ----------
const b64 = s => Buffer.from(s).toString('base64');
const csvCases = [
  ['comma CSV', 'A,Women\nX,Y\n', { A: ['X'], WOMEN: ['Y'] }],
  ['semicolon CSV', 'A;Women\nX;Y\n', { A: ['X'], WOMEN: ['Y'] }],
  ['quoted comma in name', 'A\n"Shah, Raj"\n', { A: ['Shah, Raj'] }],
  ['BOM at start', '﻿A,B\nX,Y\n', { A: ['X'], B: ['Y'] }],
  ['blank rows ignored', 'A\nX\n\n\nY\n', { A: ['X', 'Y'] }],
  ['blank cells ignored', 'A,B\nX,\n,Y\n', { A: ['X'], B: ['Y'] }],
  ['extra unknown columns ignored', 'Notes,A\nhi,X\n', { A: ['X'] }],
  ['names trimmed and collapsed', 'A\n  Rahul   Shah  \n', { A: ['Rahul Shah'] }],
  ['CRLF line endings', 'A,B\r\nX,Y\r\n', { A: ['X'], B: ['Y'] }],
  ['kids headers', 'Icon Boy,Boy,Girls\nI1,B1,G1\n,,G2\n', { ICON: ['I1'], BOY: ['B1'], GIRL: ['G1', 'G2'] }],
  ['accented names kept', 'A\nJosé Núñez\n', { A: ['José Núñez'] }],
  ['formula-like value kept as plain text', 'A\n=1+1\n', { A: ['=1+1'] }],
  ['header only, no names', 'A,B\n', { A: [], B: [] }],
  ['duplicate names passed through (save validates)', 'A\nX\nX\n', { A: ['X', 'X'] }],
];
for (const [i, [label, csv, expected]] of csvCases.entries()) {
  test(`UNIT-${String(85 + i).padStart(3, '0')} parseUpload CSV: ${label}`, async () => {
    assert.deepEqual((await parseUpload({ filename: 'x.csv', data: b64(csv) })).lists, expected);
  });
}
const badUploads = [
  ['missing body', undefined, /filename/],
  ['filename not a string', { filename: 5, data: 'x' }, /filename/],
  ['data not a string', { filename: 'a.csv', data: 5 }, /filename/],
  ['unsupported .xls', { filename: 'a.xls', data: b64('A\nX') }, /xlsx or \.csv/],
  ['unsupported .txt', { filename: 'a.txt', data: b64('A\nX') }, /xlsx or \.csv/],
  ['no extension', { filename: 'players', data: b64('A\nX') }, /xlsx or \.csv/],
  ['corrupt xlsx bytes', { filename: 'a.xlsx', data: b64('not a zip file') }, /Couldn't read/],
  ['empty xlsx', { filename: 'a.xlsx', data: '' }, /Couldn't read|First row/],
  ['CSV with no category header', { filename: 'a.csv', data: b64('foo,bar\n1,2') }, /First row/],
  ['empty CSV', { filename: 'a.csv', data: '' }, /First row/],
];
for (const [i, [label, body, err]] of badUploads.entries()) {
  test(`UNIT-${String(99 + i).padStart(3, '0')} parseUpload rejects: ${label}`, async () => {
    await assert.rejects(parseUpload(body), err);
  });
}
test('UNIT-109 parseUpload XLSX: first sheet only, numbers and blanks handled', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('one');
  ws.addRows([['A', 'B'], ['X', 7], [null, 'Y']]);
  wb.addWorksheet('two').addRows([['C'], ['IGNORED']]);
  const data = Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
  assert.deepEqual((await parseUpload({ filename: 'p.XLSX', data })).lists, { A: ['X'], B: ['7', 'Y'] });
});
test('UNIT-110 parseUpload XLSX: 200 names in one column', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('x');
  ws.addRow(['Women']);
  for (let k = 0; k < 200; k++) ws.addRow([`W ${k}`]);
  const data = Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
  assert.equal((await parseUpload({ filename: 'p.xlsx', data })).lists.WOMEN.length, 200);
});

// ---------- fairness hashing ----------
const SAMPLE = { actionId: '11111111-2222-3333-4444-555555555555', category: 'WOMEN', assignments: [{ teamNumber: 3, name: 'Riya Desai' }], salt: 'ab'.repeat(32) };
const tamper = [
  ['different actionId', { ...SAMPLE, actionId: 'x' }],
  ['different category', { ...SAMPLE, category: 'B' }],
  ['different team', { ...SAMPLE, assignments: [{ teamNumber: 4, name: 'Riya Desai' }] }],
  ['different name', { ...SAMPLE, assignments: [{ teamNumber: 3, name: 'Riya Desai ' }] }],
  ['different salt', { ...SAMPLE, salt: 'ac'.repeat(32) }],
  ['extra assignment', { ...SAMPLE, assignments: [...SAMPLE.assignments, { teamNumber: 4, name: 'X' }] }],
  ['no assignment', { ...SAMPLE, assignments: [] }],
];
test('UNIT-111 sha256: known vector', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('UNIT-112 proofText: stable format', () => {
  assert.equal(proofText(SAMPLE), `PicklePro|v1|${SAMPLE.actionId}|WOMEN|3=Riya Desai|${SAMPLE.salt}`);
});
for (const [i, [label, changed]] of tamper.entries()) {
  test(`UNIT-${113 + i} fairness: ${label} changes the fingerprint`, () => {
    assert.notEqual(sha256(proofText(changed)), sha256(proofText(SAMPLE)));
  });
}
test('UNIT-120 fairness: shuffle order matters (team swap detected)', () => {
  const a = { ...SAMPLE, assignments: [{ teamNumber: 1, name: 'X' }, { teamNumber: 2, name: 'Y' }] };
  const b = { ...SAMPLE, assignments: [{ teamNumber: 1, name: 'Y' }, { teamNumber: 2, name: 'X' }] };
  assert.notEqual(sha256(proofText(a)), sha256(proofText(b)));
});
test('UNIT-121 fairness: browser proofText equals server proofText', () => {
  assert.equal(clientFair.proofText(SAMPLE), proofText(SAMPLE));
});
test('UNIT-122 fairness: browser verify() accepts an honest reveal', async () => {
  assert.equal(await clientFair.verify({ ...SAMPLE, commitment: sha256(proofText(SAMPLE)) }), true);
});
test('UNIT-123 fairness: browser verify() rejects a tampered name', async () => {
  const commitment = sha256(proofText(SAMPLE));
  assert.equal(await clientFair.verify({ ...SAMPLE, assignments: [{ teamNumber: 3, name: 'Someone' }], commitment }), false);
});
test('UNIT-124 fairness: browser verify() returns null without a key', async () => {
  assert.equal(await clientFair.verify({ ...SAMPLE, salt: null, commitment: 'x' }), null);
});
test('UNIT-125 fairness: browser sha256 matches server for unicode', async () => {
  assert.equal(await clientFair.sha256('Zoë 🏓 राहुल'), sha256('Zoë 🏓 राहुल'));
});

// ---------- configuration ----------
test('UNIT-126 config: every round has a label and short code', () => {
  for (const c of ALL_CATEGORIES) { assert.ok(LABELS[c]); assert.ok(SHORT[c]); }
});
test('UNIT-127 config: every round draws from a known list', () => {
  for (const c of ALL_CATEGORIES) assert.ok(ALL_POOLS.includes(poolOf(c)), c);
});
test('UNIT-128 config: Girl 1 and Girl 2 share the Girls list, others use their own', () => {
  for (const c of ['A', 'WOMEN', 'B', 'C', 'D', 'ICON', 'BOY', 'GIRL1', 'GIRL2']) assert.equal(poolOf(c), c);
});
test('UNIT-129 config: shuffle rounds are exactly A and Icon Boy', () => {
  assert.deepEqual([...SHUFFLE].sort(), ['A', 'ICON']);
  assert.equal(isShuffle('A'), true); assert.equal(isShuffle('WOMEN'), false);
});
test('UNIT-130 config: main event = 28 teams, default M1/M2/M3/W1', () => {
  assert.equal(EVENTS.main.teamCount, 28);
  assert.deepEqual(EVENTS.main.available, ['A', 'B', 'C', 'WOMEN', 'D']);
  assert.deepEqual(EVENTS.main.defaults, ['A', 'B', 'C', 'WOMEN']);
});
test('UNIT-131 config: kids event = 4 teams, fixed Icon Boy/Boy/Girl 1/Girl 2', () => {
  assert.equal(EVENTS.kids.teamCount, 4);
  assert.deepEqual(EVENTS.kids.defaults, ['ICON', 'GIRL1', 'BOY', 'GIRL2']);
  assert.equal(EVENTS.kids.fixed, true);
});
test('UNIT-132 config: kids team = 2 boys + 2 girls', () => {
  const rounds = EVENTS.kids.defaults;
  assert.equal(rounds.filter(c => ['ICON', 'BOY'].includes(c)).length, 2);
  assert.equal(new Set(rounds.map(poolOf)).size, 4);
});
const EVENT_VALUES = [['kids', 'kids'], ['main', 'main'], [undefined, 'main'], ['', 'main'], ['KIDS', 'main'], [{}, 'main'], ['../kids', 'main']];
for (const [i, [v, e]] of EVENT_VALUES.entries()) {
  test(`UNIT-${133 + i} eventOf(${JSON.stringify(v)}) -> ${e}`, () => assert.equal(eventOf(v), e));
}
