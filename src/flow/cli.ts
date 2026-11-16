// The flow from a terminal or an agent (RFC §H step 10): the same registry, validator and
// runtime the editor uses, answering in JSON. Nothing here reads a file, the network or the
// DOM — scripts/flow.mjs hands it text and prints what it returns — so a graph an agent
// proposes is decided by the one parser and checker exactly as an import in the page is.
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
