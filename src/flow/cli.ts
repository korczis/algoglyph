// The flow from a terminal or an agent (RFC §H step 10): the same registry, validator and
// runtime the editor uses, answering in JSON. Nothing here reads a file, the network or the
// DOM — scripts/flow.mjs hands it text and prints what it returns — so a graph an agent
// proposes is decided by the one parser and checker exactly as an import in the page is.
import { ENTRIES } from '../core/catalogue';
import { build, DIRECTED, type Graph } from '../engines/graph/graph';
import { defaultParams, EVENT_CAP, trace as graphTrace, work as graphWork, type GraphKernel, type Options } from '../engines/graph/trace';
import { kernelLoader } from '../registry';
import { coverage, tally, type Coverage, type Level } from './derive';
import { check, parseGraph, serialiseGraph } from './graph';
import type { Registry } from './node';
import { ADAPTERS, DECLARED, REGISTRY } from './nodes';
import { PRESETS } from './presets';
import { Runtime, type SideData } from './runtime';
import { show, type Value } from './types';

/** Every node type with its category, ports (types written out), parameters and origin. */
export function nodes(reg: Registry = REGISTRY) {
  return [...reg.values()].map((d) => ({
    type: d.type,
    title: d.title,
    category: d.category,
    level: d.origin ? 'derived' : 'declared',
    entries: d.origin ? d.origin.entries.length : d.entry ? 1 : 0,
    inputs: d.inputs.map((p) => ({ id: p.id, type: show(p.type), required: Boolean(p.required) })),
    outputs: d.outputs.map((p) => ({ id: p.id, type: show(p.type) })),
    params: d.params.map((p) => ({
      key: p.key, kind: p.kind, value: p.value,
      ...(p.kind === 'select' ? { options: p.options.map((o) => o.value) } : {}),
      ...(p.kind === 'range' ? { min: p.min, max: p.max } : {}),
    })),
  }));
}

/** Every live entry of the catalogue at its level; with `level`, only those. */
export function entries(level?: Level): { tally: Record<Level, number>; entries: Coverage[] } {
  const all = coverage(DECLARED, ADAPTERS);
  return { tally: tally(all), entries: level ? all.filter((c) => c.level === level) : all };
}

/** A starting graph as canonical text; without an id, the list of ids. */
export function preset(id?: string): string | { id: string; title: string; summary: string }[] {
  if (!id) return PRESETS.map((p) => ({ id: p.id, title: p.title, summary: p.summary }));
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}; one of ${PRESETS.map((x) => x.id).join(', ')}`);
  return serialiseGraph(p.build(REGISTRY));
}

/** Parse and check a document: its errors, or its execution order and every output's type. */
export function validate(text: string, reg: Registry = REGISTRY) {
  const parsed = parseGraph(text, reg);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
  const c = check(parsed.doc, reg);
  if (!c.ok) return { ok: false as const, errors: c.errors.map((e) => e.message) };
  return {
    ok: true as const,
    order: c.order,
    types: Object.fromEntries([...c.types].map(([node, ports]) => [node, Object.fromEntries(Object.entries(ports).map(([p, t]) => [p, show(t)]))])),
  };
}

/** A value made printable: numbers kept exact, long arrays summarised by their ends and range. */
export function summarise(v: Value, keep = 8) {
  const head = (a: ArrayLike<number>) => Array.from(a).slice(0, keep);
  const range = (a: ArrayLike<number>) => {
    let lo = Infinity; let hi = -Infinity;
    for (let i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
    return a.length ? [lo, hi] : [];
  };
  switch (v.kind) {
    case 'series': return { kind: v.kind, label: v.label, unit: v.unit, axis: v.index.unit, n: v.values.length, head: head(v.values), range: range(v.values) };
    case 'points': return { kind: v.kind, x: v.x, y: v.y, n: v.xs.length, xs: head(v.xs), ys: head(v.ys) };
    case 'table': return { kind: v.kind, keys: v.keys, units: v.units, rows: v.rows };
    case 'record': return { kind: v.kind, rows: v.rows };
  }
}

/** Run a document headless: each node's status, reason, time and summarised outputs. */
export async function run(text: string, side: SideData = () => undefined, reg: Registry = REGISTRY) {
  const v = validate(text, reg);
  if (!v.ok) return v;
  const parsed = parseGraph(text, reg);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
  const x = await new Runtime(reg, side).run(parsed.doc);
  if (!x) return { ok: false as const, errors: ['the run was superseded'] };
  return {
    ok: x.ok && [...x.nodes.values()].every((t) => t.status !== 'error'),
    order: x.order,
    nodes: x.order.map((id) => {
      const t = x.nodes.get(id)!;
      return {
        id, status: t.status, ...(t.reason ? { reason: t.reason } : {}), ms: Math.round(t.ms * 100) / 100,
        outputs: Object.fromEntries(Object.entries(t.outputs).map(([p, val]) => [p, summarise(val)])),
      };
    }),
  };
}

/** Bounds on a caller's graph: refused past them, never truncated. */
export const KERNEL_LIMITS = { vertices: 5000, edges: 50000, trace: 200000 } as const;

const isInt = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/**
 * A caller's graph for a graph-engine kernel: `{ n, edges: [{ u, v, w?|len?, cap?, cost? }],
 * directed?, s?, t?, side?, params? }`. Every field is checked; a graph that is not well formed
 * is refused with the field named, never repaired.
 */
export function graphFromInput(raw: unknown, k: GraphKernel): { g: Graph; params: Record<string, unknown> } | string {
  if (!raw || typeof raw !== 'object') return 'the input must be a JSON object';
  const r = raw as Record<string, unknown>;
  if (!isInt(r.n, 1, KERNEL_LIMITS.vertices)) return `n must be an integer from 1 to ${KERNEL_LIMITS.vertices}`;
  const n = r.n;
  if (!Array.isArray(r.edges) || r.edges.length > KERNEL_LIMITS.edges) return `edges must be a list of at most ${KERNEL_LIMITS.edges}`;
  const edges: [number, number, number][] = []; const cap: number[] = []; const cost: number[] = [];
  for (const [i, e] of r.edges.entries()) {
    const x = e as Record<string, unknown>;
    if (!isInt(x?.u, 0, n - 1) || !isInt(x?.v, 0, n - 1)) return `edges[${i}]: u and v must be vertices 0..${n - 1}`;
    const w = x.w ?? x.len ?? 1;
    if (!isNum(w)) return `edges[${i}]: w (or len) must be a finite number`;
    if (x.cap !== undefined && !(isNum(x.cap) && x.cap >= 0)) return `edges[${i}]: cap must be a non-negative number`;
    if (x.cost !== undefined && !isNum(x.cost)) return `edges[${i}]: cost must be a finite number`;
    edges.push([x.u, x.v, w]); cap.push((x.cap as number | undefined) ?? 1); cost.push((x.cost as number | undefined) ?? 1);
  }
  const s = r.s ?? 0; const t = r.t ?? n - 1;
  if (!isInt(s, 0, n - 1) || !isInt(t, 0, n - 1)) return `s and t must be vertices 0..${n - 1}`;
  let truth: number[] | undefined;
  if (r.side !== undefined) {
    if (!Array.isArray(r.side) || r.side.length !== n || !r.side.every((v) => v === 0 || v === 1)) return 'side must list 0 or 1 for every vertex';
    truth = r.side as number[];
  }
  if (r.params !== undefined && (typeof r.params !== 'object' || r.params === null || Array.isArray(r.params))) return 'params must be an object';
  const params = (r.params ?? {}) as Record<string, unknown>;
  const known = new Set((k.params ?? []).map((d) => d.key));
  for (const key of Object.keys(params)) if (!known.has(key)) return `params.${key} is not a parameter of this kernel (it has: ${[...known].join(', ') || 'none'})`;
  // positions only matter to a drawing; a circle keeps every kernel's geometry well defined
  const x = Array.from({ length: n }, (_, i) => 0.5 + 0.45 * Math.cos((2 * Math.PI * i) / n));
  const y = Array.from({ length: n }, (_, i) => 0.5 + 0.45 * Math.sin((2 * Math.PI * i) / n));
  const g = build(k.inputs[0], x, y, edges, r.directed === undefined ? DIRECTED.has(k.inputs[0]) : Boolean(r.directed), { s, t, cap, cost, ...(truth ? { truth } : {}) });
  return { g, params };
}

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x)));

/**
 * Run one catalogue kernel on a caller's data with the engine and the code its plate runs: its
 * result, the engine's counts, its report, and with `trace` the recorded operations
 * ([op, a, b, x, y] per event) for an overlay. The graph engine first; other engines refuse.
 */
export async function runKernel(id: string, text: string, opt: { trace?: boolean; seed?: number } = {}) {
  const e = ENTRIES.find((x) => x.id === id && x.status === 'live');
  if (!e) return { ok: false as const, errors: [`no live catalogue entry ${id}`] };
  if (e.engine !== 'graph') return { ok: false as const, errors: [`${id} runs on the ${e.engine} engine; caller data is read for graph kernels so far`] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (err) { return { ok: false as const, errors: [`the input is not JSON: ${(err as Error).message}`] }; }
  const k = (await kernelLoader(e)()) as GraphKernel;
  const parsed = graphFromInput(raw, k);
  if (typeof parsed === 'string') return { ok: false as const, errors: [parsed] };
  const { g, params } = parsed;
  const opts: Options = { s: g.s, t: g.t, p: { ...defaultParams(k), ...(params as Options['p']) } };
  const t = graphTrace(k, g, opts, opt.seed ?? 1, k.cap ?? EVENT_CAP, Boolean(opt.trace));
  if (t.truncated) return { ok: false as const, errors: [`${e.title} stopped at the event cap on this graph`] };
  const events = opt.trace ? Array.from({ length: Math.min(t.length, KERNEL_LIMITS.trace) }, (_, i) => Array.from(t.events.slice(5 * i, 5 * i + 5))) : undefined;
  return {
    ok: true as const,
    kernel: { id: e.id, title: e.title, goal: k.goal, plate: `#/p/${e.id}` },
    graph: { n: g.n, m: g.m, directed: g.directed, s: g.s, t: g.t },
    params: opts.p,
    result: plain(t.result),
    counts: t.counts,
    work: graphWork(t.counts),
    ...(k.report && t.result !== undefined ? { report: k.report(t.result, g, opts) } : {}),
    ...(events ? { trace: { events: events.length, truncated: t.length > KERNEL_LIMITS.trace, format: '[op, a, b, x, y]', ops: events } } : {}),
  };
}

/** The kernels `runKernel` reads caller data for, with their parameters and goal. */
export async function runnable() {
  const out = [];
  for (const e of ENTRIES.filter((x) => x.engine === 'graph' && x.status === 'live').sort((a, b) => a.id.localeCompare(b.id))) {
    const k = (await kernelLoader(e)()) as GraphKernel;
    out.push({ id: e.id, title: e.title, goal: k.goal, shape: k.inputs[0], params: (k.params ?? []).map((d) => ({ key: d.key, value: d.value })) });
  }
  return out;
}
