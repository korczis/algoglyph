// The flow's executor (RFC §7): finite, pull-free, incremental. A run validates the document,
// walks it in the validator's topological order and gives each node the values on its input
// edges. A node's fingerprint is its type, parameters, state, attached text, the seed when it
// is seeded, and the fingerprints of what feeds it — so a node whose fingerprint is unchanged
// is not run again, and one change re-runs exactly the nodes downstream of it. A newer run
// aborts the older one, and a result that arrives after it was superseded is dropped.
import { check, type Diag, type GraphDoc, type NodeInstance } from './graph';
import { Wait, type Outputs, type Registry } from './node';
import { typeOf, unify, type Value } from './types';

export type Status = 'done' | 'waiting' | 'blocked' | 'error';

export interface NodeTrace {
  id: string;
  status: Status;
  /** Why the node is waiting, blocked or failed; when it ran, an optional input it ran without. */
  reason: string;
  /** True when the result was reused because nothing it depends on changed. */
  cached: boolean;
  /** Wall time of its last run, in ms (0 when cached). */
  ms: number;
  outputs: Outputs;
  fingerprint: string;
}

export interface Execution {
  ok: boolean;
  errors: Diag[];
  order: string[];
  nodes: Map<string, NodeTrace>;
}

/** Bounds on what one node may produce: a value over them is an error, not a slow tab. */
export const VALUE_LIMITS = { series: 1 << 16, points: 1024, records: 64 } as const;

/** What a provider has attached in this tab: its text and the digest that fingerprints it. */
export type SideData = (nodeId: string) => { text: string; digest: string } | undefined;

function sizeError(v: Value): string {
  if (v.kind === 'series' && v.values.length > VALUE_LIMITS.series) return `a series of ${v.values.length} values is over ${VALUE_LIMITS.series}`;
  if (v.kind === 'points' && v.xs.length > VALUE_LIMITS.points) return `${v.xs.length} points are over ${VALUE_LIMITS.points}`;
  if (v.kind === 'record' && v.rows.length > VALUE_LIMITS.records) return `${v.rows.length} readouts are over ${VALUE_LIMITS.records}`;
  return '';
}

const stable = (v: unknown): string => JSON.stringify(v, (_, x) => (
  x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));

export class Runtime {
  private cache = new Map<string, { fp: string; outputs: Outputs }>();
  private gen = 0;
  private ctrl: AbortController | null = null;
  /** Executions per node id since this runtime was made (the incremental tests read it). */
  readonly runs = new Map<string, number>();

  constructor(private reg: Registry, private side: SideData = () => undefined) {}

  /** Stop the run in flight, if any; its result will be dropped. */
  cancel(): void {
    this.gen++;
    this.ctrl?.abort();
    this.ctrl = null;
  }

  /** Run the document; null when a newer run superseded this one before it finished. */
  async run(doc: GraphDoc): Promise<Execution | null> {
    this.cancel();
    const gen = this.gen;
    const ctrl = new AbortController();
    this.ctrl = ctrl;
    const c = check(doc, this.reg);
    const nodes = new Map<string, NodeTrace>();
    if (!c.ok) return { ok: false, errors: c.errors, order: c.order, nodes };
    const byId = new Map(doc.nodes.map((n) => [n.id, n]));
    const into = new Map<string, { port: string; from: string; out: string }[]>();
    for (const e of doc.edges) {
      into.set(e.to.node, [...(into.get(e.to.node) ?? []), { port: e.to.port, from: e.from.node, out: e.from.port }]);
    }
    for (const id of c.order) {
      const n = byId.get(id) as NodeInstance;
      const d = this.reg.get(n.type);
      if (!d) continue;
      const edges = into.get(id) ?? [];
      const inputs: Record<string, Value | undefined> = {};
      let status: Status = 'done';
      let reason = '';
      let note = '';
      for (const p of d.inputs) {
        const e = edges.find((x) => x.port === p.id);
        if (!e) {
          if (p.required) { status = 'waiting'; reason = `input ${p.label} is not connected`; }
          continue;
        }
        const up = nodes.get(e.from);
        if (!up || up.status !== 'done') {
          const why = `${p.label} waits on ${e.from}${up?.reason ? `: ${up.reason}` : ''}`;
          if (p.required) {
            status = up?.status === 'waiting' ? 'waiting' : 'blocked';
            reason = why;
          } else if (status === 'done') {
            // an optional input that failed upstream is left out, and the node says so
            note = `${p.label} unavailable: ${e.from} ${up?.status ?? 'did not run'}`;
          }
          continue;
        }
        inputs[p.id] = up.outputs[e.out];
      }
      const side = d.side ? this.side(id) : undefined;
      const fp = stable([
        n.type, n.params, n.state ?? null, side?.digest ?? null, d.seeded ? doc.seed : null,
        edges.map((e) => [e.port, nodes.get(e.from)?.fingerprint ?? '', e.out]).sort(),
      ]);
      if (status !== 'done') {
        nodes.set(id, { id, status, reason, cached: false, ms: 0, outputs: {}, fingerprint: fp });
        continue;
      }
      const hit = this.cache.get(id);
      if (hit && hit.fp === fp) {
        nodes.set(id, { id, status: 'done', reason: note, cached: true, ms: 0, outputs: hit.outputs, fingerprint: fp });
        continue;
      }
      const t0 = performance.now();
      let outputs: Outputs;
      try {
        this.runs.set(id, (this.runs.get(id) ?? 0) + 1);
        outputs = await d.run({
          nodeId: id, params: n.params, state: n.state, inputs, side: side?.text, seed: doc.seed, signal: ctrl.signal,
        });
      } catch (err) {
        if (gen !== this.gen) return null;
        this.cache.delete(id);
        nodes.set(id, {
          id, status: err instanceof Wait ? 'waiting' : 'error', reason: err instanceof Error ? err.message : String(err),
          cached: false, ms: performance.now() - t0, outputs: {}, fingerprint: fp,
        });
        continue;
      }
      if (gen !== this.gen) return null;
      // the node's result must be what it declared: type and size, checked here, not trusted
      const declared = c.types.get(id) ?? {};
      let bad = '';
      for (const p of d.outputs) {
        const v = outputs[p.id];
        if (!v) { bad = `produced no ${p.label}`; break; }
        const u = unify(typeOf(v), declared[p.id]);
        if (!u.ok) { bad = `${p.label}: ${u.reason}`; break; }
        bad = sizeError(v);
        if (bad) break;
      }
      const ms = performance.now() - t0;
      if (bad) {
        this.cache.delete(id);
        nodes.set(id, { id, status: 'error', reason: bad, cached: false, ms, outputs: {}, fingerprint: fp });
        continue;
      }
      this.cache.set(id, { fp, outputs });
      nodes.set(id, { id, status: 'done', reason: note, cached: false, ms, outputs, fingerprint: fp });
    }
    for (const k of this.cache.keys()) if (!byId.has(k)) this.cache.delete(k);
    if (this.ctrl === ctrl) this.ctrl = null;
    return { ok: true, errors: [], order: c.order, nodes };
  }
}
