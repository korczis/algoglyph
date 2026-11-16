// Starting graphs, one per scenario of the RFC (§11), all built from the same node library and
// laid out by the same function. Each is a plain document; nothing in the editor special-cases one.
import { SCHEMA, topoOrder, type Edge, type GraphDoc, type NodeInstance } from './graph';
import type { Registry } from './node';

export const NODE_W = 232;
const GAP_X = 72;
const GAP_Y = 32;
/** Header and port-row heights of a node card (src/flow/studio.ts draws to these). */
export const HEAD_H = 44;
export const PORT_H = 28;
/** Room each view's preview takes below the ports, so cards in one column never overlap. */
const PREVIEW_H: Record<string, number> = { chart: 220, scatter: 250, readout: 230, export: 60 };

/** The height a node's card is laid out with: its header, its port rows and its preview. */
export function cardHeight(reg: Registry, type: string): number {
  const d = reg.get(type);
  if (!d) return 120;
  return HEAD_H + Math.max(d.inputs.length, d.outputs.length) * PORT_H + 8 + 36 + (d.view ? PREVIEW_H[d.view] : 0);
}

/**
 * Longest-path layering: a node's column is the longest chain of edges into it; a column stacks
 * its nodes in topological order, each card given its height. Deterministic, and the same for any listing of
 * the same graph (the graph library this stands in for, ELK, is deferred: RFC §8).
 */
export function layout(doc: GraphDoc, reg: Registry): GraphDoc {
  const { order } = topoOrder(doc.nodes.map((n) => n.id), doc.edges);
  const col = new Map<string, number>();
  for (const id of order) {
    const ins = doc.edges.filter((e) => e.to.node === id).map((e) => (col.get(e.from.node) ?? 0) + 1);
    col.set(id, Math.max(0, ...ins));
  }
  const type = new Map(doc.nodes.map((n) => [n.id, n.type]));
  const top = new Map<number, number>();
  const at = new Map<string, [number, number]>();
  for (const id of order) {
    const c = col.get(id) ?? 0;
    const y = top.get(c) ?? 24;
    top.set(c, y + cardHeight(reg, type.get(id) ?? '') + GAP_Y);
    at.set(id, [24 + c * (NODE_W + GAP_X), y]);
  }
  return { ...doc, nodes: doc.nodes.map((n) => ({ ...n, at: at.get(n.id) ?? n.at })) };
}

const e = (from: string, fp: string, to: string, tp: string): Edge => ({ from: { node: from, port: fp }, to: { node: to, port: tp } });

/** A node of `type` at its defaults, with `params` over them. */
export function instance(reg: Registry, id: string, type: string, params: Record<string, string | number | boolean> = {}): NodeInstance {
  const d = reg.get(type);
  if (!d) throw new Error(`flow: no node type ${type}`);
  const p = { ...Object.fromEntries(d.params.map((x) => [x.key, x.value])), ...params };
  return { id, type, params: p, ...(d.state ? { state: d.state.initial(p) } : {}), at: [0, 0] };
}

export interface Preset { id: string; title: string; summary: string; build(reg: Registry): GraphDoc }

const doc = (reg: Registry, nodes: NodeInstance[], edges: Edge[]): GraphDoc => layout({ schema: SCHEMA, seed: 4242, nodes, edges }, reg);

export const PRESETS: Preset[] = [
  {
    id: 'fit',
    title: 'Drag points, refit',
    summary: 'Points you drag are the state a least-squares fit reads; the curve and its residual follow.',
    build: (r) => doc(r, [
      instance(r, 'points', 'points'), instance(r, 'fit', 'fit'), instance(r, 'scatter', 'scatter'), instance(r, 'readout', 'readout'),
    ], [e('points', 'points', 'fit', 'in'), e('points', 'points', 'scatter', 'points'), e('fit', 'curve', 'scatter', 'curve'), e('fit', 'fit', 'readout', 'in')]),
  },
  {
    id: 'sorting',
    title: 'Sort and count',
    summary: 'Seeded keys through any sorting kernel of the collection, its compares and writes counted.',
    build: (r) => doc(r, [
      instance(r, 'keys', 'keys'), instance(r, 'sort', 'sort'), instance(r, 'chart', 'chart'), instance(r, 'counts', 'readout'),
    ], [e('keys', 'keys', 'sort', 'in'), e('sort', 'sorted', 'chart', 'a'), e('keys', 'keys', 'chart', 'b'), e('sort', 'counts', 'counts', 'in')]),
  },
  {
    id: 'table',
    title: 'Your table',
    summary: 'A CSV you attach, read under the schema you approve, one column normalized, sorted, charted and exported.',
    build: (r) => doc(r, [
      instance(r, 'csv', 'csv'), instance(r, 'column', 'column'), instance(r, 'normalize', 'normalize'), instance(r, 'sort', 'sort'),
      instance(r, 'stats', 'stats'), instance(r, 'chart', 'chart'), instance(r, 'export', 'export'), instance(r, 'readout', 'readout'),
    ], [
      e('csv', 'table', 'column', 'table'), e('column', 'series', 'normalize', 'in'), e('column', 'series', 'stats', 'in'),
      e('normalize', 'out', 'sort', 'in'), e('sort', 'sorted', 'chart', 'a'), e('sort', 'sorted', 'export', 'in'), e('stats', 'out', 'readout', 'in'),
    ]),
  },
  {
    id: 'spectrum',
    title: 'Signal and spectrum',
    summary: 'A sampled signal in seconds through the FFT to a spectrum in hertz; the two cannot share a chart.',
    build: (r) => doc(r, [
      instance(r, 'signal', 'signal'), instance(r, 'fft', 'fft'), instance(r, 'wave', 'chart'), instance(r, 'spectrum', 'chart'),
    ], [e('signal', 'signal', 'wave', 'a'), e('signal', 'signal', 'fft', 'in'), e('fft', 'out', 'spectrum', 'a')]),
  },
  {
    id: 'kernels',
    title: 'Catalogue kernels',
    summary: 'Nodes derived from the catalogue: a table, graph, tree, text and hash kernel, each on its seeded instance, measured by its own engine.',
    build: (r) => doc(r, [
      instance(r, 'grid', 'grid'), instance(r, 'readouts', 'readout'), instance(r, 'rows', 'chart'),
      instance(r, 'graph', 'graph'), instance(r, 'counts', 'readout'),
      instance(r, 'tree', 'tree'), instance(r, 'tree-counts', 'readout'),
      instance(r, 'text', 'text'), instance(r, 'text-counts', 'readout'),
      instance(r, 'hash', 'hash'), instance(r, 'hash-counts', 'readout'),
    ], [
      e('grid', 'readouts', 'readouts', 'in'), e('grid', 'rows', 'rows', 'a'), e('graph', 'counts', 'counts', 'in'),
      e('tree', 'counts', 'tree-counts', 'in'), e('text', 'counts', 'text-counts', 'in'), e('hash', 'counts', 'hash-counts', 'in'),
    ]),
  },
];

export const preset = (id: string) => PRESETS.find((p) => p.id === id);
