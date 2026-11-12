// A reader's own data for a plate (ADR 0010). A catalogue entry declares what a plate accepts
// (`data` in catalogue/schema/entry.yaml): the columns with their units and bounds, the rows, a
// byte cap, the select it adds an option to and how much of it may ride in a link. This module
// reads that data, in the browser only, and validates it with nothing trusted:
//   - text is capped in bytes before anything is parsed;
//   - a number is a plain decimal (the DECIMAL of src/core/share.ts), finite, inside its column's
//     bounds; anything else is an error that names its row and column;
//   - JSON is parsed without a reviver and only arrays, objects and numbers are accepted.
// Nothing here touches the network, storage or the DOM (test/data.test.ts checks the source),
// and a value from a link goes through the same parser as a file.
//
// A table is kept in one canonical form, a CSV with a header of the declared keys and numbers
// written as JavaScript's shortest round-trip text. The link carries that text, base64url-encoded,
// when it fits the declared `url_bytes`; otherwise only its row count and a digest (SHA-256 of
// the canonical text), so a reader who re-attaches the file learns whether it is the same data.

import type { ParamDef } from './plate';

/** What a table holds: rows of named numeric columns. A series is a table of one column. */
export type DataKind = 'table' | 'series';
export type DataFormat = 'csv' | 'json';

export interface DataColumn {
  key: string;
  /** The unit the column is in, as a reader writes it; '1' for a pure number. */
  unit: string;
  min?: number;
  max?: number;
}

/** One declared input of a plate, as the catalogue entry states it. */
export interface DataDecl {
  id: string;
  title: string;
  kind: DataKind;
  accepts: DataFormat[];
  columns: DataColumn[];
  rows: { min: number; max: number };
  /** Hard cap on the text read, in UTF-8 bytes. */
  bytes: number;
  /** The key of the plate's select that gains the option `data:<id>`. */
  replaces: string;
  /** The longest encoded table a link carries; longer ones leave a digest. */
  url_bytes: number;
  note?: string;
}

export interface DataTable {
  id: string;
  columns: DataColumn[];
  /** One array per declared column, in declared order, each `rows` long. */
  values: Float64Array[];
  rows: number;
  /** The canonical CSV: header of keys, then one line per row. */
  canonical: string;
  /** SHA-256 of the canonical text, hex. */
  digest: string;
}

export interface DataError {
  /** The line of the text (CSV) or the item of the array (JSON), counted from 1. */
  row?: number;
  col?: string;
  reason: string;
}

export type ParseResult = { ok: true; table: DataTable } | { ok: false; errors: DataError[] };

/** A link's token for a table too large to carry: its rows and the first 16 hex of its digest. */
export interface DataMarker { rows: number; digest: string }

export type TokenResult =
  | { kind: 'table'; table: DataTable }
  | { kind: 'marker'; marker: DataMarker }
  | { kind: 'invalid'; errors: DataError[] };

/** The select value that picks a declared input. */
export const optionValue = (id: string): string => `data:${id}`;
/** The declared id a select value picks, or undefined for an ordinary option. */
export const optionId = (value: unknown): string | undefined =>
  typeof value === 'string' && value.startsWith('data:') ? value.slice(5) : undefined;
/** The query key a link uses for a declared input. */
export const queryKey = (id: string): string => `d.${id}`;

/**
 * A plate's controls with each declared input added as the last option of the select it names
 * (the registry joins code and entry with this). A declaration whose select does not exist adds
 * nothing; test/registry.test.ts refuses it.
 */
export function withDataOptions(defs: ParamDef[], decls: DataDecl[]): ParamDef[] {
  if (!decls.length) return defs;
  return defs.map((d) => {
    if (d.kind !== 'select') return d;
    const mine = decls.filter((x) => x.replaces === d.key);
    if (!mine.length) return d;
    return { ...d, options: [...d.options, ...mine.map((x) => ({ value: optionValue(x.id), label: x.title }))] };
  });
}

const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const B64URL = /^[A-Za-z0-9_-]*$/;
const MARKER = /^~(\d{1,9})\.([0-9a-f]{16})$/;
/** Errors listed in full; past this many, the rest are counted in one line. */
export const MAX_ERRORS = 12;

/** UTF-8 length of a string, without allocating it. */
export function utf8Length(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) { n += 4; i++; } else n += 3;
  }
  return n;
}

function capped(errors: DataError[]): DataError[] {
  if (errors.length <= MAX_ERRORS) return errors;
  return [...errors.slice(0, MAX_ERRORS), { reason: `and ${errors.length - MAX_ERRORS} more` }];
}

const show = (s: string) => JSON.stringify(s.length > 24 ? `${s.slice(0, 24)}…` : s);

/** A cell as a number, or the reason it is not one. */
function number(cell: string, col: DataColumn): number | string {
  if (!DECIMAL.test(cell)) return `not a plain decimal number: ${show(cell)}`;
  const v = Number(cell);
  if (!Number.isFinite(v)) return `${show(cell)} is beyond the range of a number`;
  return bounded(v, col);
}

function bounded(v: number, col: DataColumn): number | string {
  if (col.min !== undefined && v < col.min) return `${v} is below the column's minimum ${col.min} ${col.unit}`;
  if (col.max !== undefined && v > col.max) return `${v} is above the column's maximum ${col.max} ${col.unit}`;
  return v;
}

function delimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

function cells(line: string, sep: string): string[] {
  return line.split(sep).map((c) => {
    const t = c.trim();
    return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).trim() : t;
  });
}

/** Rows as numbers by declared column, checked for count; the caller has the per-cell errors. */
function finish(decl: DataDecl, rows: number[][], errors: DataError[]): ParseResult {
  if (!errors.length) {
    if (rows.length < decl.rows.min) errors.push({ reason: `${rows.length} rows; at least ${decl.rows.min} are needed` });
    if (rows.length > decl.rows.max) errors.push({ reason: `${rows.length} rows; at most ${decl.rows.max} are accepted` });
  }
  if (errors.length) return { ok: false, errors: capped(errors) };
  return { ok: true, table: tableOf(decl, rows) };
}

/** A table from validated rows (each in declared column order). */
export function tableOf(decl: DataDecl, rows: number[][]): DataTable {
  const k = decl.columns.length;
  const values = Array.from({ length: k }, () => new Float64Array(rows.length));
  rows.forEach((r, i) => { for (let j = 0; j < k; j++) values[j][i] = r[j]; });
  const lines = [decl.columns.map((c) => c.key).join(','), ...rows.map((r) => r.map((v) => String(v)).join(','))];
  const canonical = lines.join('\n');
  return { id: decl.id, columns: decl.columns, values, rows: rows.length, canonical, digest: sha256Hex(canonical) };
}

function parseCsv(decl: DataDecl, text: string): ParseResult {
  const errors: DataError[] = [];
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const k = decl.columns.length;
  let order: number[] | null = null;
  let sep = '';
  const rows: number[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    if (!sep) sep = delimiter(line);
    const cs = cells(line, sep);
    const row = i + 1;
    if (order === null) {
      order = decl.columns.map((_, j) => j);
      if (cs.some((c) => !DECIMAL.test(c))) {
        // a header: every declared key once, in any order, and nothing else
        const keys = cs.map((c) => c.toLowerCase());
        const unknown = cs.filter((c) => !decl.columns.some((col) => col.key.toLowerCase() === c.toLowerCase()));
        for (const u of unknown) errors.push({ row, reason: `unknown column ${show(u)}; expected ${decl.columns.map((c) => c.key).join(', ')}` });
        const at = decl.columns.map((col) => keys.indexOf(col.key.toLowerCase()));
        for (const [j, a] of at.entries()) if (a < 0) errors.push({ row, col: decl.columns[j].key, reason: 'missing from the header' });
        if (new Set(keys).size !== keys.length) errors.push({ row, reason: 'a column is named twice' });
        if (errors.length) return { ok: false, errors: capped(errors) };
        order = at;
        continue;
      }
    }
    // a header names exactly the declared columns, so every row has k cells either way
    if (cs.length !== k) {
      errors.push({ row, reason: `${cs.length} values; ${k} expected` });
      if (errors.length > MAX_ERRORS) break;
      continue;
    }
    const values: number[] = [];
    decl.columns.forEach((col, j) => {
      const v = number(cs[order![j]], col);
      if (typeof v === 'string') errors.push({ row, col: col.key, reason: v });
      else values.push(v);
    });
    if (values.length === k) rows.push(values);
    if (errors.length > MAX_ERRORS) break;
  }
  return finish(decl, rows, errors);
}

const kind = (v: unknown) => (Array.isArray(v) ? 'a list' : v === null ? 'null' : typeof v === 'object' ? 'an object' : `a ${typeof v}`);

function jsonNumber(v: unknown, col: DataColumn): number | string {
  if (typeof v !== 'number') return `expected a number, got ${kind(v)}`;
  if (!Number.isFinite(v)) return 'beyond the range of a number';
  return bounded(v, col);
}

function parseJson(decl: DataDecl, text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    return { ok: false, errors: [{ reason: `not valid JSON: ${(e as Error).message.split('\n')[0]}` }] };
  }
  const cols = decl.columns;
  const errors: DataError[] = [];
  const rows: number[][] = [];
  const keysOf = (o: object) => Object.keys(o);
  const sameKeys = (o: object, row?: number) => {
    const ks = keysOf(o);
    for (const k of ks) if (!cols.some((c) => c.key === k)) errors.push({ row, reason: `unknown key ${show(k)}` });
    for (const c of cols) if (!ks.includes(c.key)) errors.push({ row, col: c.key, reason: 'missing' });
  };
  const push = (vals: unknown[], row: number) => {
    const out: number[] = [];
    cols.forEach((c, j) => {
      const v = jsonNumber(vals[j], c);
      if (typeof v === 'string') errors.push({ row, col: c.key, reason: v });
      else out.push(v);
    });
    if (out.length === cols.length) rows.push(out);
  };
  if (Array.isArray(doc)) {
    doc.forEach((item, i) => {
      if (errors.length > MAX_ERRORS) return;
      const row = i + 1;
      if (Array.isArray(item)) {
        if (item.length !== cols.length) errors.push({ row, reason: `${item.length} values; ${cols.length} expected` });
        else push(item, row);
      } else if (item !== null && typeof item === 'object') {
        const before = errors.length;
        sameKeys(item, row);
        if (errors.length === before) push(cols.map((c) => (item as Record<string, unknown>)[c.key]), row);
      } else if (cols.length === 1) push([item], row);
      else errors.push({ row, reason: `expected a list or an object, got ${kind(item)}` });
    });
  } else if (doc !== null && typeof doc === 'object') {
    // columns: { x: [...], y: [...] }
    sameKeys(doc);
    const o = doc as Record<string, unknown>;
    if (!errors.length) {
      const arrays = cols.map((c) => o[c.key]);
      arrays.forEach((a, j) => { if (!Array.isArray(a)) errors.push({ col: cols[j].key, reason: `expected a list, got ${kind(a)}` }); });
      if (!errors.length) {
        const n = (arrays[0] as unknown[]).length;
        if (arrays.some((a) => (a as unknown[]).length !== n)) errors.push({ reason: 'the columns differ in length' });
        else for (let i = 0; i < n && errors.length <= MAX_ERRORS; i++) push(arrays.map((a) => (a as unknown[])[i]), i + 1);
      }
    }
  } else errors.push({ reason: `expected a list of rows or an object of columns, got ${kind(doc)}` });
  return finish(decl, rows, errors);
}

/** The format a text is in: JSON when it opens with [ or {, else CSV. */
export function sniff(text: string): DataFormat {
  const t = text.replace(/^﻿/, '').trimStart();
  return t.startsWith('[') || t.startsWith('{') ? 'json' : 'csv';
}

/** Read a text against a declaration. Nothing outside this call sees the text before it passes. */
export function parseData(decl: DataDecl, text: string, format: DataFormat = sniff(text)): ParseResult {
  const size = utf8Length(text);
  if (size > decl.bytes) return { ok: false, errors: [{ reason: `${size} bytes; at most ${decl.bytes} are read` }] };
  if (!decl.accepts.includes(format)) return { ok: false, errors: [{ reason: `${format.toUpperCase()} is not accepted here; use ${decl.accepts.map((f) => f.toUpperCase()).join(' or ')}` }] };
  return format === 'json' ? parseJson(decl, text) : parseCsv(decl, text);
}

// ---- links ----------------------------------------------------------------------------------

function toBase64url(ascii: string): string {
  return btoa(ascii).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(token: string): string | null {
  if (!B64URL.test(token) || token.length % 4 === 1) return null;
  try {
    return atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (token.length % 4)) % 4));
  } catch {
    return null;
  }
}

/** True when a link carries the table itself, not only its digest. */
export function travels(decl: DataDecl, table: DataTable): boolean {
  return toBase64url(table.canonical).length <= decl.url_bytes;
}

/** The token a link carries for a table: the table itself when it fits, else its marker. */
export function encodeToken(decl: DataDecl, table: DataTable): string {
  const b64 = toBase64url(table.canonical);
  return b64.length <= decl.url_bytes ? b64 : `~${table.rows}.${table.digest.slice(0, 16)}`;
}

/** A link's token, read with the same validation as a file. */
export function decodeToken(decl: DataDecl, token: string): TokenResult {
  const m = MARKER.exec(token);
  if (m) return { kind: 'marker', marker: { rows: Number(m[1]), digest: m[2] } };
  // a token longer than the byte cap could hold is refused before it is decoded
  if (token.length > Math.ceil((decl.bytes * 4) / 3) + 4) return { kind: 'invalid', errors: [{ reason: 'the link\'s data is longer than this plate accepts' }] };
  const text = fromBase64url(token);
  if (text === null) return { kind: 'invalid', errors: [{ reason: 'the link\'s data is not valid base64url' }] };
  const r = parseData(decl, text, 'csv');
  return r.ok ? { kind: 'table', table: r.table } : { kind: 'invalid', errors: r.errors };
}

/** Whether a table is the one a marker was made from. */
export const matches = (marker: DataMarker, table: DataTable): boolean =>
  table.rows === marker.rows && table.digest.startsWith(marker.digest);

// ---- SHA-256 (FIPS 180-4), synchronous so a link can be written in the same tick ----------
// Checked against node:crypto in test/data.test.ts. Input is the canonical text, which is ASCII.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of a string's UTF-8 bytes, as lowercase hex. */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const blocks = Math.ceil((len + 9) / 64);
  const buf = new Uint8Array(blocks * 64);
  buf.set(bytes);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(buf.length - 8, Math.floor(len / 0x20000000));
  view.setUint32(buf.length - 4, (len << 3) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let b = 0; b < blocks; b++) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(b * 64 + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return [...h].map((x) => x.toString(16).padStart(8, '0')).join('');
}
