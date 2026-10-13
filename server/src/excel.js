import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { HttpError, cleanName, historyRows, snapshot } from './draw.js';
import { CODES, GROUPS, LABELS } from './models.js';

const bold = sheet => { sheet.getRow(1).font = { bold: true }; };

export async function exportWorkbook(tournamentId, ev = 'main') {
  const s = await snapshot(tournamentId, ev);
  const wb = new ExcelJS.Workbook();

  const teams = wb.addWorksheet('Final Teams');
  teams.columns = [
    { header: 'Team', key: 'team', width: 8 },
    ...s.t.categories.map(c => ({ header: LABELS[c], key: c, width: 24 })),
  ];
  const rows = Array.from({ length: s.t.teamCount }, (_, i) => ({ team: i + 1 }));
  for (const e of s.revealed) rows[e.teamNumber - 1][e.category] = e.playerName;
  teams.addRows(rows);
  bold(teams);

  // Same layout as the organisers' player lists, plus the team each player was drawn to.
  const team = new Map(s.revealed.map(e => [`${e.category}:${e.playerName}`, e.teamNumber]));
  const players = wb.addWorksheet('Players');
  players.columns = [
    { header: 'Category', key: 'code', width: 10 },
    { header: '', key: 'group', width: 10 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'AGE', key: 'age', width: 8 },
    { header: 'CONTACT NUMBER', key: 'phone', width: 18 },
    { header: 'TEAM', key: 'team', width: 8 },
  ];
  for (const c of s.t.categories) {
    for (const p of s.players.filter(x => x.category === c)) {
      players.addRow({ code: CODES[c], group: GROUPS[c], name: p.name, age: p.age ?? '', phone: p.phone ?? '', team: team.get(`${c}:${p.name}`) ?? '' });
    }
  }
  bold(players);

  const history = wb.addWorksheet('Draw History');
  history.columns = [
    { header: 'Timestamp', key: 'at', width: 22, style: { numFmt: 'yyyy-mm-dd hh:mm:ss' } },
    { header: 'Category', key: 'category', width: 10 },
    { header: 'Draw sequence', key: 'sequence', width: 14 },
    { header: 'Player', key: 'player', width: 24 },
    { header: 'Team', key: 'teamNumber', width: 8 },
    { header: 'Event ID', key: 'eventId', width: 26 },
    { header: 'Action ID', key: 'actionId', width: 38 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Fairness commitment (SHA-256)', key: 'commitment', width: 66 },
    { header: 'Fairness key (revealed)', key: 'salt', width: 66 },
  ];
  history.addRows(historyRows(s).map(r => ({ ...r, status: r.voided ? 'UNDONE' : 'Final' })));
  bold(history);

  return { buffer: await wb.xlsx.writeBuffer(), name: s.t.name };
}

// Header cell -> category. Letters A B C D (per event), or group names M1 M2 M3 W1 / B1 G1 B2 G2.
// Older headers still work: "Category B", "Women", "Ladies", "Boy Cat 1", "Icon Boy", ...
const HEADER_CODES = { m1: 'A', m2: 'B', m3: 'C', m4: 'D', w1: 'WOMEN', b1: 'ICON', g1: 'GIRL1', b2: 'BOY', g2: 'GIRL2' };
const LETTERS = {
  main: { a: 'A', b: 'B', c: 'C', d: 'WOMEN', e: 'D' },
  kids: { a: 'ICON', b: 'GIRL1', c: 'BOY', d: 'GIRL2' },
};
export function headerCategory(text, ev = 'main') {
  const letter = String(text).toLowerCase().replace(/[^a-z0-9]/g, '').match(/^(?:category|cat|group)?([a-e])(?:players?|category|cat|group)?$/)?.[1];
  if (letter) return LETTERS[ev === 'kids' ? 'kids' : 'main'][letter] ?? null;
  const h = String(text).toLowerCase().replace(/[^a-z]/g, '');
  const k = String(text).toLowerCase().replace(/[^a-z0-9]/g, '');
  const code = k.replace(/(players?|list|category|cat)$/, '');
  if (HEADER_CODES[code]) return HEADER_CODES[code];
  if (/^icon/.test(h) || /^boys?(cat|category)?(1|one)/.test(k)) return 'ICON';
  if (/^girls?(cat|category)?(1|one)/.test(k)) return 'GIRL1';
  if (/^girls?(cat|category)?(2|two)/.test(k)) return 'GIRL2';
  if (/^boys?(cat|category)?(2|two)?(players?)?$/.test(k)) return 'BOY';
  if (/^girls?(players?)?$/.test(h)) return 'GIRL';
  if (/^(wom[ae]n|ladies|w$)/.test(h)) return 'WOMEN';
  return null;
}

// The organisers' auction format: a header row with "Category" and "Name" (then "AGE", "CONTACT
// NUMBER"), one player per row, the category code in the Category column (A, B, C, W1 / B1, G1, B2,
// G2, or D for women). Several such blocks may sit side by side on one sheet.
const ROW_CODES = {
  main: { a: 'A', m1: 'A', b: 'B', m2: 'B', c: 'C', m3: 'C', d: 'WOMEN', w: 'WOMEN', w1: 'WOMEN', women: 'WOMEN' },
  kids: { a: 'ICON', b1: 'ICON', b: 'GIRL1', g1: 'GIRL1', c: 'BOY', b2: 'BOY', d: 'GIRL2', g2: 'GIRL2' },
};
function parseRowFormat(rows, ev) {
  const head = (rows[0] ?? []).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const blocks = [];
  head.forEach((h, i) => {
    if (h !== 'category') return;
    const name = head.findIndex((x, j) => j > i && x === 'name');
    if (name < 0) return;
    const near = re => { const j = head.findIndex((x, k) => k > name && k <= name + 3 && re.test(x)); return j < 0 ? null : j; };
    blocks.push({ code: i, name, age: near(/^age/), phone: near(/contact|phone|mobile|number/) });
  });
  if (!blocks.length) return null;
  const codes = ROW_CODES[ev === 'kids' ? 'kids' : 'main'];
  const lists = {};
  const details = {};
  for (const r of rows.slice(1)) {
    for (const b of blocks) {
      const name = r[b.name];
      const key = codes[(r[b.code] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')];
      if (!name || !key) continue;
      (lists[key] ??= []).push(name);
      details[name] = { age: b.age === null ? '' : r[b.age], phone: b.phone === null ? '' : r[b.phone] };
    }
  }
  return Object.keys(lists).length ? { lists, details } : null;
}

// Upload = first sheet (or CSV): the organisers' row format above, or a header row naming the
// categories with one name per cell below.
export async function parseUpload({ filename, data } = {}, ev = 'main') {
  if (typeof filename !== 'string' || typeof data !== 'string') throw new HttpError(400, 'Send { filename, data (base64) }');
  const buffer = Buffer.from(data, 'base64');
  const wb = new ExcelJS.Workbook();
  let sheet;
  try {
    if (/\.csv$/i.test(filename)) {
      const text = buffer.toString('utf8').replace(/^﻿/, '');
      const firstLine = text.split(/\r?\n/, 1)[0];
      const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      sheet = await wb.csv.read(Readable.from([text]), { parserOptions: { delimiter }, map: value => value });
    } else if (/\.xlsx$/i.test(filename)) {
      await wb.xlsx.load(buffer);
      sheet = wb.worksheets[0];
    } else {
      throw new HttpError(400, 'Upload a .xlsx or .csv file');
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Couldn't read that file — save it as .xlsx or .csv");
  }
  const rows = [];
  sheet?.eachRow({ includeEmpty: true }, row => {
    rows.push(Array.from({ length: sheet.columnCount }, (_, i) => cleanName(row.getCell(i + 1).text)));
  });
  const rowFormat = parseRowFormat(rows, ev);
  if (rowFormat) return rowFormat;
  const columns = (rows[0] ?? []).map(h => headerCategory(h, ev));
  if (!columns.some(Boolean)) throw new HttpError(400, 'First row must name the categories: A, B, C, D (or M1, M2, M3, W1 / kids B1, G1, B2, G2)');
  const lists = {};
  columns.forEach((c, i) => {
    if (c) lists[c] = rows.slice(1).map(r => r[i]).filter(Boolean);
  });
  return { lists };
}
