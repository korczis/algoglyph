// The page's side of a reader's own data (ADR 0010): a file is read in this tab, capped before
// it is read, and handed to src/core/data.ts; the tables a plate runs on are held here, in
// memory only, and written into the link by src/core/share.ts when they are small enough.
// Nothing here sends, stores or loads anything (test/data.test.ts checks the source).
import {
  decodeToken, encodeToken, matches, optionId, parseData, sniff, travels,
  type DataDecl, type DataError, type DataFormat, type DataMarker, type DataTable, type ParseResult,
} from './data';

/** Read a file the reader picked or dropped; a file over the cap is refused unread. */
export async function readFile(decl: DataDecl, file: Blob & { name?: string }): Promise<ParseResult> {
  if (file.size > decl.bytes) {
    return { ok: false, errors: [{ reason: `${file.size} bytes; at most ${decl.bytes} are read` }] };
  }
  const text = await file.text();
  const name = file.name ?? '';
  const format: DataFormat = /\.json$/i.test(name) ? 'json' : /\.(csv|tsv|txt)$/i.test(name) ? 'csv' : sniff(text);
  return parseData(decl, text, format);
}

/** What the page knows about one declared input. */
export interface Slot {
  decl: DataDecl;
  table: DataTable | null;
  /** Where the table came from, for the reader. */
  from: 'file' | 'paste' | 'link' | null;
  name: string;
  errors: DataError[];
  /** A link opened elsewhere named data it does not carry: its rows and digest. */
  marker: DataMarker | null;
  /** After a file is attached to a marker: whether it is the data the link was made with. */
  same: boolean | null;
}

/** The tables a plate runs on, by declared id. Lives as long as the page shows the plate. */
export class DataStore {
  private slots = new Map<string, Slot>();

  constructor(decls: DataDecl[]) {
    for (const decl of decls) {
      this.slots.set(decl.id, { decl, table: null, from: null, name: '', errors: [], marker: null, same: null });
    }
  }

  get(id: string): Slot | undefined { return this.slots.get(id); }
  all(): Slot[] { return [...this.slots.values()]; }

  /** The table a plate reads for a declared id: null until valid data is set. */
  table(id: string): DataTable | null { return this.slots.get(id)?.table ?? null; }

  /** Apply a parse result; a refused text leaves the previous table in place. */
  set(id: string, r: ParseResult, from: 'file' | 'paste' | 'link', name = ''): boolean {
    const s = this.slots.get(id);
    if (!s) return false;
    if (!r.ok) { s.errors = r.errors; return false; }
    s.errors = [];
    s.same = s.marker ? matches(s.marker, r.table) : null;
    s.table = r.table;
    s.from = from;
    s.name = name;
    return true;
  }

  clear(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    Object.assign(s, { table: null, from: null, name: '', errors: [], marker: null, same: null });
  }

  /** Read the tokens of a link (src/core/share.ts dataTokens) into the slots. */
  fromLink(tokens: Record<string, string>): void {
    for (const [id, token] of Object.entries(tokens)) {
      const s = this.slots.get(id);
      if (!s) continue;
      const r = decodeToken(s.decl, token);
      if (r.kind === 'table') {
        // the same table already held: nothing changes (a link rewritten by this page)
        if (s.table?.digest === r.table.digest) continue;
        s.table = r.table; s.from = 'link'; s.name = ''; s.errors = []; s.marker = null; s.same = null;
      } else if (r.kind === 'marker') {
        if (s.table && matches(r.marker, s.table)) continue;
        s.marker = r.marker; s.table = null; s.from = null; s.same = null;
      } else s.errors = r.errors;
    }
  }

  /** The tokens a link carries for the inputs the parameters select. */
  tokens(params: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const v of Object.values(params)) {
      const id = optionId(v);
      const s = id ? this.slots.get(id) : undefined;
      if (s?.table) out[s.decl.id] = encodeToken(s.decl, s.table);
      else if (s?.marker) out[s.decl.id] = `~${s.marker.rows}.${s.marker.digest}`;
    }
    return out;
  }

  /** True when the link of these parameters carries a table itself (the page then says so). */
  carries(params: Record<string, unknown>): boolean {
    return Object.values(params).some((v) => {
      const s = this.slots.get(optionId(v) ?? '');
      return !!s?.table && travels(s.decl, s.table);
    });
  }
}
