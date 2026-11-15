// The one source of truth of a flow (RFC §6). Every change — a slider, a dragged point, a new
// edge, an import — is a typed intent dispatched here: validated, applied to an immutable copy of
// the document, the whole result checked by graph.ts, and only then committed with its origin.
// The computation graph stays acyclic because a view never writes along an edge; it sends an
// intent to the node that owns the state, and the runtime recomputes from the new revision.
import type { ParamValue } from '../core/plate';
import { check, edgeKey, paramValue, type Edge, type GraphDoc, type NodeInstance } from './graph';
import type { Registry } from './node';

/** Where a change came from, kept with it in the history (provenance). */
export type Origin = 'editor' | 'control' | 'view' | 'import' | 'link' | 'history';

export type Intent =
  | { type: 'node.add'; node: NodeInstance }
  | { type: 'node.remove'; id: string }
  | { type: 'node.move'; id: string; at: [number, number] }
  | { type: 'edge.add'; edge: Edge }
  | { type: 'edge.remove'; edge: Edge }
  | { type: 'param.set'; node: string; key: string; value: ParamValue }
  /** A node's own command (IntentDecl): `name` on node `node` with `payload`. */
  | { type: 'node.intent'; node: string; name: string; payload: unknown }
  | { type: 'graph.load'; doc: GraphDoc };

export type Result = { ok: true; revision: number; queued?: boolean } | { ok: false; reason: string };

export interface Commit {
  revision: number;
  origin: Origin;
  intent: Intent['type'] | string;
  /** Commits of one gesture (a drag) share a transaction and undo as one. */
  txn?: string;
}

/** Presentation-only intents: they change no computed value, so they never re-run anything. */
const PRESENTATION = new Set<Intent['type']>(['node.move']);

export interface DispatchOptions { origin: Origin; txn?: string }

const HISTORY_CAP = 200;

export class FlowStore {
  private doc: GraphDoc;
  private rev = 0;
  /** The revision of the last change to what is computed (not to positions). */
  private computeRev = 0;
  private past: { doc: GraphDoc; txn?: string }[] = [];
  private future: GraphDoc[] = [];
  private listeners = new Set<(c: Commit) => void>();
  private queue: [Intent, DispatchOptions][] = [];
  private busy = false;
  readonly log: Commit[] = [];

  constructor(readonly reg: Registry, doc: GraphDoc) {
    const c = check(doc, reg);
    if (!c.ok) throw new Error(`flow: the initial graph is invalid: ${c.errors[0].message}`);
    this.doc = doc;
  }

  get graph(): GraphDoc { return this.doc; }
  get revision(): number { return this.rev; }
  get computeRevision(): number { return this.computeRev; }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  subscribe(f: (c: Commit) => void): () => void {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }

  /**
   * Validate and apply one intent. A listener that dispatches while being notified is queued
   * behind the current commit, never applied inside it (reentrancy).
   */
  dispatch(intent: Intent, opt: DispatchOptions): Result {
    if (this.busy) {
      this.queue.push([intent, opt]);
      return { ok: true, revision: this.rev, queued: true };
    }
    const next = this.reduce(this.doc, intent);
    if (typeof next === 'string') return { ok: false, reason: next };
    const c = check(next, this.reg);
    if (!c.ok) return { ok: false, reason: c.errors[0].message };
    const last = this.past[this.past.length - 1];
    if (!(opt.txn && last?.txn === opt.txn)) {
      this.past.push({ doc: this.doc, txn: opt.txn });
      if (this.past.length > HISTORY_CAP) this.past.shift();
    }
    this.future = [];
    return this.commit(next, { origin: opt.origin, intent: intentName(intent), txn: opt.txn }, PRESENTATION.has(intent.type));
  }

  undo(): Result {
    const prev = this.past.pop();
    if (!prev) return { ok: false, reason: 'nothing to undo' };
    this.future.push(this.doc);
    return this.commit(prev.doc, { origin: 'history', intent: 'undo' }, false);
  }

  redo(): Result {
    const next = this.future.pop();
    if (!next) return { ok: false, reason: 'nothing to redo' };
    this.past.push({ doc: this.doc });
    return this.commit(next, { origin: 'history', intent: 'redo' }, false);
  }

  private commit(doc: GraphDoc, c: Omit<Commit, 'revision'>, presentation: boolean): Result {
    this.doc = doc;
    this.rev++;
    if (!presentation) this.computeRev = this.rev;
    const rec: Commit = { ...c, revision: this.rev };
    this.log.push(rec);
    if (this.log.length > HISTORY_CAP) this.log.shift();
    this.busy = true;
    try {
      for (const f of this.listeners) f(rec);
    } finally {
      this.busy = false;
    }
    const q = this.queue.shift();
    if (q) this.dispatch(q[0], q[1]);
    return { ok: true, revision: rec.revision };
  }

  /** The document an intent would produce, or why it is refused. Never mutates `doc`. */
  private reduce(doc: GraphDoc, it: Intent): GraphDoc | string {
    const find = (id: string) => doc.nodes.find((n) => n.id === id);
    const withNode = (id: string, f: (n: NodeInstance) => NodeInstance | string): GraphDoc | string => {
      const n = find(id);
      if (!n) return `no node ${id}`;
      const r = f(n);
      return typeof r === 'string' ? r : { ...doc, nodes: doc.nodes.map((x) => (x.id === id ? r : x)) };
    };
    switch (it.type) {
      case 'node.add': {
        if (find(it.node.id)) return `a node ${it.node.id} exists`;
        const d = this.reg.get(it.node.type);
        if (!d) return `no node type ${it.node.type}`;
        const state = d.state ? (it.node.state ?? d.state.initial(it.node.params)) : undefined;
        return { ...doc, nodes: [...doc.nodes, { ...it.node, ...(d.state ? { state } : {}) }] };
      }
      case 'node.remove':
        if (!find(it.id)) return `no node ${it.id}`;
        return {
          ...doc,
          nodes: doc.nodes.filter((n) => n.id !== it.id),
          edges: doc.edges.filter((e) => e.from.node !== it.id && e.to.node !== it.id),
        };
      case 'node.move':
        if (!it.at.every((v) => Number.isFinite(v) && Math.abs(v) < 1e5)) return 'a position must be finite';
        return withNode(it.id, (n) => ({ ...n, at: [it.at[0], it.at[1]] }));
      case 'edge.add':
        if (it.edge.from.node === it.edge.to.node) return 'a node cannot feed itself';
        if (doc.edges.some((e) => edgeKey(e) === edgeKey(it.edge))) return 'that connection exists';
        return { ...doc, edges: [...doc.edges, it.edge] };
      case 'edge.remove': {
        const k = edgeKey(it.edge);
        if (!doc.edges.some((e) => edgeKey(e) === k)) return 'no such connection';
        return { ...doc, edges: doc.edges.filter((e) => edgeKey(e) !== k) };
      }
      case 'param.set':
        return withNode(it.node, (n) => {
          const d = this.reg.get(n.type);
          const p = d?.params.find((x) => x.key === it.key);
          if (!d || !p) return `${it.node} has no parameter ${it.key}`;
          const v = paramValue(p, it.value);
          if ('error' in v) return v.error;
          return { ...n, params: { ...n.params, [it.key]: v.value } };
        });
      case 'node.intent':
        return withNode(it.node, (n) => {
          const d = this.reg.get(n.type);
          const decl = d?.intents?.[it.name];
          if (!d || !decl) return `${d?.title ?? it.node} does not accept ${it.name}`;
          const why = decl.validate(n.state, it.payload, n.params);
          if (why) return why;
          return { ...n, state: decl.apply(n.state, it.payload, n.params) };
        });
      case 'graph.load':
        return it.doc;
    }
  }
}

function intentName(it: Intent): string {
  return it.type === 'node.intent' ? `${it.type}:${it.name}` : it.type;
}
