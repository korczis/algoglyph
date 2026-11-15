// The persisted graph and its one validator (RFC §4, §7). A document is plain data; whether it
// is runnable is decided here and nowhere else: unknown node types and ports, a second edge into
// one input, a unit that does not unify, and every cycle are refused with a sentence that names
// what is wrong. The order nodes run in is Kahn's, ties broken by node id, so it depends on the
// graph and never on the order the document happens to list it in.
import { snap } from '../core/share';
import type { ParamDef, ParamValue, Params } from '../core/plate';
import type { Registry } from './node';
import { concrete, substitute, unify, type Bindings, type PortType } from './types';

export const SCHEMA = 'algoglyph.graph/v1';

/** Hard limits on an untrusted document (an import or a link), checked before anything else. */
export const LIMITS = { bytes: 64 * 1024, nodes: 48, edges: 96, depth: 8 } as const;

export interface PortRef { node: string; port: string }
export interface Edge { from: PortRef; to: PortRef }

export interface NodeInstance {
  id: string;
  type: string;
  params: Params;
  state?: unknown;
  /** Where the editor draws it; presentation only, never part of what is computed. */
  at: [number, number];
}

export interface GraphDoc {
  schema: typeof SCHEMA;
  seed: number;
  nodes: NodeInstance[];
  edges: Edge[];
}

export type DiagCode = 'unknown-type' | 'unknown-port' | 'duplicate' | 'input-taken' | 'type' | 'cycle';

export interface Diag {
  code: DiagCode;
  message: string;
  node?: string;
  edge?: Edge;
}

export interface Checked {
  ok: boolean;
  errors: Diag[];
  /** Topological order of every node; empty when the graph has a cycle. */
  order: string[];
  /** Resolved type of every output port, by node and port. */
  types: Map<string, Record<string, PortType>>;
}

export const edgeKey = (e: Edge) => `${e.from.node}.${e.from.port}>${e.to.node}.${e.to.port}`;

/** Kahn's algorithm, ready nodes taken in id order: the same graph always runs in one order. */
export function topoOrder(ids: string[], edges: Edge[]): { order: string[]; rest: string[] } {
  const indeg = new Map(ids.map((id) => [id, 0]));
  const next = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (!indeg.has(e.from.node) || !indeg.has(e.to.node)) continue;
    indeg.set(e.to.node, (indeg.get(e.to.node) ?? 0) + 1);
    next.get(e.from.node)?.push(e.to.node);
  }
  const ready = ids.filter((id) => indeg.get(id) === 0).sort();
  const order: string[] = [];
  while (ready.length) {
    const id = ready.shift() as string;
    order.push(id);
    for (const t of next.get(id) ?? []) {
      const d = (indeg.get(t) ?? 0) - 1;
      indeg.set(t, d);
      if (d === 0) {
        let i = 0;
        while (i < ready.length && ready[i] < t) i++;
        ready.splice(i, 0, t);
      }
    }
  }
  const done = new Set(order);
  return { order, rest: ids.filter((id) => !done.has(id)).sort() };
}

/** One cycle among `rest` (nodes Kahn could not order), as a path that returns to its start. */
function cycleIn(rest: string[], edges: Edge[]): string[] {
  const inRest = new Set(rest);
  const next = new Map<string, string[]>();
  for (const e of edges) {
    if (inRest.has(e.from.node) && inRest.has(e.to.node)) {
      next.set(e.from.node, [...(next.get(e.from.node) ?? []), e.to.node].sort());
    }
  }
  // every node left by Kahn reaches a cycle; walk forward until a node repeats
  const path: string[] = [];
  const seen = new Map<string, number>();
  let at = rest[0];
  while (!seen.has(at)) {
    seen.set(at, path.length);
    path.push(at);
    at = (next.get(at) ?? [])[0];
    if (at === undefined) return rest;
  }
  return [...path.slice(seen.get(at)), at];
}

/** Validate a document against a registry. Pure: the same document gives the same answer. */
export function check(doc: GraphDoc, reg: Registry): Checked {
  const errors: Diag[] = [];
  const byId = new Map<string, NodeInstance>();
  for (const n of doc.nodes) {
    if (byId.has(n.id)) errors.push({ code: 'duplicate', node: n.id, message: `two nodes are called ${n.id}` });
    byId.set(n.id, n);
    if (!reg.has(n.type)) errors.push({ code: 'unknown-type', node: n.id, message: `${n.id}: no node type ${n.type}` });
  }
  const taken = new Map<string, Edge>();
  const seenEdge = new Set<string>();
  const edges: Edge[] = [];
  for (const e of doc.edges) {
    const k = edgeKey(e);
    if (seenEdge.has(k)) { errors.push({ code: 'duplicate', edge: e, message: `the edge ${k} is listed twice` }); continue; }
    seenEdge.add(k);
    const src = byId.get(e.from.node);
    const dst = byId.get(e.to.node);
    const sd = src && reg.get(src.type);
    const dd = dst && reg.get(dst.type);
    if (!src || !dst) { errors.push({ code: 'unknown-port', edge: e, message: `${k}: names a node that does not exist` }); continue; }
    if (!sd || !dd) continue;
    if (!sd.outputs.some((p) => p.id === e.from.port)) {
      errors.push({ code: 'unknown-port', edge: e, message: `${sd.title} has no output ${e.from.port}` });
      continue;
    }
    if (!dd.inputs.some((p) => p.id === e.to.port)) {
      errors.push({ code: 'unknown-port', edge: e, message: `${dd.title} has no input ${e.to.port}` });
      continue;
    }
    const slot = `${e.to.node}.${e.to.port}`;
    if (taken.has(slot)) {
      errors.push({ code: 'input-taken', edge: e, message: `${dd.title}: input ${e.to.port} already has a connection` });
      continue;
    }
    taken.set(slot, e);
    edges.push(e);
  }

  const ids = doc.nodes.map((n) => n.id);
  const { order, rest } = topoOrder(ids, edges);
  const types = new Map<string, Record<string, PortType>>();
  if (rest.length) {
    const cyc = cycleIn(rest, edges);
    const names = cyc.map((id) => {
      const n = byId.get(id);
      return (n && reg.get(n.type)?.title) ?? id;
    });
    errors.push({
      code: 'cycle', node: cyc[0],
      message: `a cycle ${names.join(' → ')}: a computation cannot depend on its own result; `
        + 'interaction goes through intents, never back along an edge',
    });
    return { ok: false, errors, order: [], types };
  }

  // types, in topological order: each edge binds or checks the target node's unit variables
  for (const id of order) {
    const n = byId.get(id) as NodeInstance;
    const d = reg.get(n.type);
    if (!d) continue;
    let b: Bindings = {};
    const inTypes: Record<string, PortType | undefined> = {};
    for (const p of d.inputs) {
      const e = taken.get(`${id}.${p.id}`);
      if (!e) continue;
      const from = types.get(e.from.node)?.[e.from.port];
      if (!from) continue;
      const u = unify(from, p.type, b);
      if (!u.ok) {
        errors.push({ code: 'type', edge: e, node: id, message: `${d.title}, input ${p.label}: ${u.reason}` });
        continue;
      }
      b = u.bindings;
      inTypes[p.id] = from;
    }
    const out: Record<string, PortType> = {};
    for (const p of d.outputs) out[p.id] = substitute(p.type, b);
    if (d.infer) {
      const state = n.state ?? d.state?.initial(n.params);
      const r = d.infer({ params: n.params, state, inputs: inTypes });
      if (typeof r === 'string') errors.push({ code: 'type', node: id, message: `${d.title}: ${r}` });
      else Object.assign(out, r);
    }
    types.set(id, out);
  }
  return { ok: errors.length === 0, errors, order, types };
}

/** Would adding `e` keep the graph valid? The editor's preview and its refusal both ask this. */
export function canConnect(doc: GraphDoc, e: Edge, reg: Registry): { ok: true } | { ok: false; reason: string } {
  if (e.from.node === e.to.node) return { ok: false, reason: 'a node cannot feed itself' };
  const before = new Set(check(doc, reg).errors.map((d) => d.message));
  const after = check({ ...doc, edges: [...doc.edges, e] }, reg);
  const fresh = after.errors.find((d) => !before.has(d.message));
  return fresh ? { ok: false, reason: fresh.message } : { ok: true };
}

/** True when every unit on a node's resolved outputs is known. */
export const resolved = (types: Record<string, PortType>) => Object.values(types).every(concrete);

// ---- untrusted documents: an import or a link --------------------------------------------------

const ID = /^[a-z][a-z0-9-]{0,31}$/;

function depth(v: unknown, d = 0): number {
  if (d > LIMITS.depth) return d;
  if (Array.isArray(v)) return Math.max(d, ...v.map((x) => depth(x, d + 1)));
  if (v && typeof v === 'object') return Math.max(d, ...Object.values(v).map((x) => depth(x, d + 1)));
  return d;
}

/** A parameter value from an untrusted document: valid as given, or the reason it is not. */
export function paramValue(def: ParamDef, raw: unknown): { value: ParamValue } | { error: string } {
  switch (def.kind) {
    case 'range':
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { error: `${def.key} must be a number` };
      if (raw < def.min || raw > def.max) return { error: `${def.key} = ${raw} is outside ${def.min} … ${def.max}` };
      return { value: snap(def, raw) };
    case 'select':
      return typeof raw === 'string' && def.options.some((o) => o.value === raw)
        ? { value: raw } : { error: `${def.key} = ${String(raw)} is not one of its options` };
    case 'toggle':
      return typeof raw === 'boolean' ? { value: raw } : { error: `${def.key} must be true or false` };
  }
}

type Parsed = { ok: true; doc: GraphDoc } | { ok: false; errors: string[] };

/** Migrations by schema id; each returns the next version's raw shape. v1 is the first. */
const MIGRATIONS: Record<string, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

/**
 * Parse an untrusted document: the byte cap first, then JSON without a reviver, the depth and
 * the counts, every id, type, port, parameter and state. Parameters a node has gained since
 * the document was written take their defaults; an unknown key is refused.
 */
export function parseGraph(text: string, reg: Registry): Parsed {
  if (new TextEncoder().encode(text).length > LIMITS.bytes) {
    return { ok: false, errors: [`the document is over ${LIMITS.bytes} bytes`] };
  }
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ['the document is not JSON'] }; }
  if (depth(raw) > LIMITS.depth) return { ok: false, errors: [`the document nests deeper than ${LIMITS.depth}`] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['the document is not an object'] };
  let o = raw as Record<string, unknown>;
  for (let hops = 0; o.schema !== SCHEMA && typeof o.schema === 'string' && MIGRATIONS[o.schema] && hops < 8; hops++) {
    o = MIGRATIONS[o.schema](o);
  }
  if (o.schema !== SCHEMA) return { ok: false, errors: [`schema ${String(o.schema)} is not ${SCHEMA}`] };
  const errors: string[] = [];
  const seed = o.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 1 || seed > 0x7fffffff) errors.push('seed must be an integer from 1');
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges)) return { ok: false, errors: ['nodes and edges must be lists'] };
  if (o.nodes.length > LIMITS.nodes) return { ok: false, errors: [`more than ${LIMITS.nodes} nodes`] };
  if (o.edges.length > LIMITS.edges) return { ok: false, errors: [`more than ${LIMITS.edges} edges`] };
  const nodes: NodeInstance[] = [];
  for (const [i, rn] of o.nodes.entries()) {
    const n = rn as Record<string, unknown>;
    const where = `node ${i + 1}`;
    if (!n || typeof n !== 'object') { errors.push(`${where}: not an object`); continue; }
    if (typeof n.id !== 'string' || !ID.test(n.id)) { errors.push(`${where}: id must match ${ID.source}`); continue; }
    const d = typeof n.type === 'string' ? reg.get(n.type) : undefined;
    if (!d) { errors.push(`${n.id}: no node type ${String(n.type)}`); continue; }
    const at = n.at;
    if (!Array.isArray(at) || at.length !== 2 || !at.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5)) {
      errors.push(`${n.id}: at must be two finite numbers`);
      continue;
    }
    const given = (n.params ?? {}) as Record<string, unknown>;
    if (typeof given !== 'object' || Array.isArray(given)) { errors.push(`${n.id}: params must be an object`); continue; }
    const params: Params = {};
    for (const k of Object.keys(given)) {
      if (!d.params.some((p) => p.key === k)) errors.push(`${n.id}: ${d.title} has no parameter ${k}`);
    }
    for (const p of d.params) {
      if (!(p.key in given)) { params[p.key] = p.value; continue; }
      const v = paramValue(p, given[p.key]);
      if ('error' in v) errors.push(`${n.id}: ${v.error}`);
      else params[p.key] = v.value;
    }
    let state: unknown;
    if (d.state) {
      if (n.state === undefined) state = d.state.initial(params);
      else {
        const s = d.state.parse(n.state);
        if (typeof s === 'string') { errors.push(`${n.id}: ${s}`); continue; }
        state = s;
      }
    } else if (n.state !== undefined) errors.push(`${n.id}: ${d.title} keeps no state`);
    nodes.push({ id: n.id, type: d.type, params, ...(d.state ? { state } : {}), at: [at[0], at[1]] });
  }
  const edges: Edge[] = [];
  const ref = (r: unknown): PortRef | undefined => {
    const x = r as Record<string, unknown>;
    return x && typeof x.node === 'string' && typeof x.port === 'string' && ID.test(x.node) && /^[a-z][a-z0-9]{0,15}$/.test(x.port)
      ? { node: x.node, port: x.port } : undefined;
  };
  for (const [i, re] of o.edges.entries()) {
    const e = re as Record<string, unknown>;
    const from = ref(e?.from);
    const to = ref(e?.to);
    if (!from || !to) { errors.push(`edge ${i + 1}: from and to must name a node and a port`); continue; }
    edges.push({ from, to });
  }
  if (errors.length) return { ok: false, errors };
  const doc: GraphDoc = { schema: SCHEMA, seed: seed as number, nodes, edges };
  const c = check(doc, reg);
  if (!c.ok) return { ok: false, errors: c.errors.map((d) => d.message) };
  return { ok: true, doc };
}

/** The canonical text of a document: keys in a fixed order, so equal graphs are equal text. */
export function serialiseGraph(doc: GraphDoc): string {
  return JSON.stringify({
    schema: doc.schema,
    seed: doc.seed,
    nodes: doc.nodes.map((n) => ({
      id: n.id, type: n.type,
      params: Object.fromEntries(Object.keys(n.params).sort().map((k) => [k, n.params[k]])),
      ...(n.state !== undefined ? { state: n.state } : {}),
      at: [Math.round(n.at[0]), Math.round(n.at[1])],
    })),
    edges: doc.edges.map((e) => ({ from: e.from, to: e.to })),
  });
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** The document as a link token (base64url of its canonical text). */
export const encodeGraph = (doc: GraphDoc) => b64url(new TextEncoder().encode(serialiseGraph(doc)));

/** A link token back to a document, through the same parser an import uses. */
export function decodeGraph(token: string, reg: Registry): Parsed {
  if (!/^[A-Za-z0-9_-]*$/.test(token) || token.length > Math.ceil((LIMITS.bytes * 4) / 3)) {
    return { ok: false, errors: ['the link does not carry a graph'] };
  }
  try {
    const bin = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return parseGraph(new TextDecoder('utf-8', { fatal: true }).decode(bytes), reg);
  } catch {
    return { ok: false, errors: ['the link does not carry a graph'] };
  }
}
