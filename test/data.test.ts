// A reader's own data (ADR 0010, rule project.user-data-stays-local): the parser refuses what is
// not a plain bounded number and says where, caps size before it reads, keeps units, round-trips
// through a link with the same validation, and never reaches the network.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodeToken, encodeToken, matches, MAX_ERRORS, optionId, optionValue, parseData, sha256Hex, sniff,
  travels, utf8Length, type DataDecl,
} from '../src/core/data';
import { dataTokens, parse, serialise } from '../src/core/share';

const decl: DataDecl = {
  id: 'points', title: 'Your points', kind: 'table', accepts: ['csv', 'json'],
  columns: [{ key: 'x', unit: 'm', min: -1000, max: 1000 }, { key: 'y', unit: 's' }],
  rows: { min: 3, max: 50 }, bytes: 4096, replaces: 'shape', url_bytes: 120,
};
const series: DataDecl = { ...decl, id: 'keys', kind: 'series', columns: [{ key: 'key', unit: '1' }] };

const ok = (text: string, d: DataDecl = decl) => {
  const r = parseData(d, text);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.table;
};
const errs = (text: string, d: DataDecl = decl) => {
  const r = parseData(d, text);
  if (r.ok) throw new Error('accepted');
  return r.errors;
};

describe('parsing', () => {
  it('reads CSV with or without a header, in any column order and any common separator', () => {
    const a = ok('x,y\n1,2\n3,4\n5,6');
    const b = ok('1,2\n3,4\n5,6');
    const c = ok('Y;X\r\n2;1\r\n4;3\r\n6;5\r\n');
    const d = ok('﻿# measured\nx\ty\n1\t2\n\n3\t4\n"5"\t"6"');
    for (const t of [a, b, c, d]) {
      expect([...t.values[0]]).toEqual([1, 3, 5]);
      expect([...t.values[1]]).toEqual([2, 4, 6]);
      expect(t.canonical).toBe('x,y\n1,2\n3,4\n5,6');
    }
    expect(a.digest).toBe(c.digest);
  });

  it('reads JSON rows, objects and columns, and a bare list for a series', () => {
    const want = 'x,y\n1,2\n3,4\n5,6';
    expect(ok('[[1,2],[3,4],[5,6]]').canonical).toBe(want);
    expect(ok('[{"x":1,"y":2},{"y":4,"x":3},{"x":5,"y":6}]').canonical).toBe(want);
    expect(ok('{"x":[1,3,5],"y":[2,4,6]}').canonical).toBe(want);
    expect(ok('[3, 1, 2]', series).canonical).toBe('key\n3\n1\n2');
    expect(sniff('  {"x": []}')).toBe('json');
    expect(sniff('x,y')).toBe('csv');
  });

  it('keeps every declared unit with the table', () => {
    const t = ok('1,2\n3,4\n5,6');
    expect(t.columns.map((c) => `${c.key} (${c.unit})`)).toEqual(['x (m)', 'y (s)']);
  });

  it('refuses what is not a plain finite number, naming the row and the column', () => {
    const cases: [string, string][] = [
      ['1,2\n3,NaN\n5,6', 'not a plain decimal'],
      ['1,2\n3,Infinity\n5,6', 'not a plain decimal'],
      ['1,2\n3,1e309\n5,6', 'beyond the range'],
      ['1,2\n3,=SUM(A1)\n5,6', 'not a plain decimal'],
      ['1,2\n3,0x10\n5,6', 'not a plain decimal'],
      ['1,2\n3, \n5,6', 'not a plain decimal'],
      ['1,2\n3,1,5\n5,6', '3 values; 2 expected'],
    ];
    for (const [text, reason] of cases) {
      const e = errs(text);
      expect(e[0].reason, text).toContain(reason);
      expect(e[0].row, text).toBe(2);
    }
    expect(errs('1,2\n3,NaN\n5,6')[0].col).toBe('y');
    expect(errs('[[1,2],[3,"4"],[5,6]]')[0]).toMatchObject({ row: 2, col: 'y' });
    expect(errs('[[1,2],[3,1e309],[5,6]]')[0].reason).toContain('beyond the range');
    expect(errs('[[1,2],[3,null],[5,6]]')[0].reason).toContain('expected a number');
    expect(errs('{"x":[1,2,3],"y":[1,2]}')[0].reason).toContain('differ in length');
    expect(errs('{"x":[1,2,3]}')[0]).toMatchObject({ col: 'y', reason: 'missing' });
    expect(errs('[{"x":1,"y":2,"z":3}]')[0].reason).toContain('unknown key');
    expect(errs('{"x": [1,2')[0].reason).toContain('not valid JSON');
    const scalar = parseData(decl, '"text"', 'json');
    expect(!scalar.ok && scalar.errors[0].reason).toContain('expected a list of rows');
  });

  it('refuses a header that does not name exactly the declared columns', () => {
    expect(errs('x,z\n1,2\n3,4\n5,6')[0].reason).toContain('unknown column');
    expect(errs('x,x\n1,2\n3,4\n5,6').some((e) => e.reason.includes('twice') || e.reason.includes('missing'))).toBe(true);
  });

  it('holds each column to its bounds, in its unit', () => {
    const e = errs('1,2\n3000,4\n5,6');
    expect(e[0]).toMatchObject({ row: 2, col: 'x' });
    expect(e[0].reason).toContain('1000 m');
  });

  it('holds the row count and the byte cap, the cap before any parsing', () => {
    expect(errs('1,2\n3,4')[0].reason).toContain('at least 3');
    const many = Array.from({ length: 51 }, (_, i) => `${i},${i}`).join('\n');
    expect(errs(many)[0].reason).toContain('at most 50');
    const huge = `1,2\n${'#'.repeat(5000)}\n3,4\n5,6`;
    expect(errs(huge)[0].reason).toContain('bytes; at most 4096');
    expect(utf8Length('aé€😀')).toBe(1 + 2 + 3 + 4);
  });

  it('lists a bounded number of errors and counts the rest', () => {
    const bad = Array.from({ length: 40 }, () => 'a,b').join('\n');
    const e = errs(`1,2\n${bad}`);
    expect(e.length).toBeLessThanOrEqual(MAX_ERRORS + 1);
  });

  it('refuses a format the plate does not accept', () => {
    const csvOnly = { ...decl, accepts: ['csv' as const] };
    expect(errs('[[1,2],[3,4],[5,6]]', csvOnly)[0].reason).toContain('JSON is not accepted');
  });

  it('survives random input without throwing', () => {
    let s = 12345;
    const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 2 ** 32; };
    const alphabet = '0123456789.,;\t\n\r-+eE"[]{}:xyz #﻿';
    for (let i = 0; i < 2000; i++) {
      const n = Math.floor(rnd() * 80);
      let t = '';
      for (let j = 0; j < n; j++) t += alphabet[Math.floor(rnd() * alphabet.length)];
      const r = parseData(decl, t);
      if (r.ok) for (const col of r.table.values) for (const v of col) expect(Number.isFinite(v)).toBe(true);
      else expect(r.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('digest', () => {
  it('is SHA-256, checked against node:crypto', () => {
    for (const text of ['', 'abc', 'x,y\n1,2', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'é'.repeat(300)]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });
});

describe('links', () => {
  it('carry a small table and read it back through the same validation', () => {
    const t = ok('1,2\n3,4\n5,6');
    expect(travels(decl, t)).toBe(true);
    const token = encodeToken(decl, t);
    const back = decodeToken(decl, token);
    expect(back.kind).toBe('table');
    if (back.kind === 'table') expect(back.table.canonical).toBe(t.canonical);
  });

  it('leave only the rows and a digest of a large table, which a re-attached file matches', () => {
    const big = Array.from({ length: 40 }, (_, i) => `${i},${i * 1.5}`).join('\n');
    const t = ok(big);
    expect(travels(decl, t)).toBe(false);
    const token = encodeToken(decl, t);
    expect(token).toMatch(/^~40\.[0-9a-f]{16}$/);
    expect(token).not.toContain('1.5');
    const back = decodeToken(decl, token);
    expect(back.kind).toBe('marker');
    if (back.kind === 'marker') {
      expect(matches(back.marker, t)).toBe(true);
      expect(matches(back.marker, ok('1,2\n3,4\n5,6'))).toBe(false);
    }
  });

  it('refuse a token that is not base64url, too long, or not valid data', () => {
    expect(decodeToken(decl, 'a+b/').kind).toBe('invalid');
    expect(decodeToken(decl, 'A'.repeat(6000)).kind).toBe('invalid');
    const bad = btoa('x,y\n1,2\n3,oops\n5,6').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const r = decodeToken(decl, bad);
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') expect(r.errors[0]).toMatchObject({ row: 3, col: 'y' });
  });

  it('round-trip in a plate URL next to the parameters and the seed', () => {
    const defs = [{ kind: 'select' as const, key: 'shape', label: 'Input', value: 'uniform',
      options: [{ value: 'uniform', label: 'Uniform' }, { value: optionValue('points'), label: 'Your points' }] }];
    const t = ok('1,2\n3,4\n5,6');
    const q = serialise(defs, { shape: optionValue('points') }, 5, {}, { [decl.id]: encodeToken(decl, t) });
    expect(q).toMatch(/^seed=5&shape=data%3Apoints&d\.points=/);
    expect(parse(defs, q)).toEqual({ seed: 5, params: { shape: 'data:points' } });
    const tokens = dataTokens(q);
    expect(Object.keys(tokens)).toEqual(['points']);
    const back = decodeToken(decl, tokens.points);
    expect(back.kind === 'table' && back.table.canonical).toBe(t.canonical);
    expect(optionId('data:points')).toBe('points');
    expect(optionId('uniform')).toBeUndefined();
    // keys that are not d.<id> are not data
    expect(dataTokens('d.=x&d.UP=y&dx=z&d.ok-1=w')).toEqual({ 'ok-1': 'w' });
  });
});

describe('network silence', () => {
  it('the data path names no network, storage or code-loading API', () => {
    const banned = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|localStorage|sessionStorage|indexedDB|importScripts|eval)\b|import\(/;
    for (const file of ['src/core/data.ts', 'src/core/upload.ts']) {
      const code = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code, file).not.toMatch(banned);
    }
  });
});
