// The node contract (RFC §3, §4). A node definition is behaviour plus its typed surface; what a
// person reads about the algorithm behind it stays in its catalogue entry (`entry`), so a node
// that runs an existing kernel takes its title from the catalogue and links to the plate.
import type { ParamDef, Params } from '../core/plate';
import type { PortType, Value } from './types';

export type Category = 'provider' | 'processor' | 'sink';

export interface PortDecl {
  id: string;
  label: string;
  type: PortType;
  /** The node waits until a required input is connected and has a value. */
  required?: boolean;
}

/**
 * A typed command a node accepts from a view or a control (RFC §6): the view sends it, the store
 * validates it against the node's own state and applies it. Nothing else changes node state.
 */
export interface IntentDecl<S> {
  label: string;
  /** null when the payload may be applied; otherwise the reason it is refused. */
  validate(state: S, payload: unknown, params: Params): string | null;
  apply(state: S, payload: unknown, params: Params): S;
}

/** What a node's run receives. */
export interface RunContext<S> {
  nodeId: string;
  params: Params;
  state: S;
  inputs: Record<string, Value | undefined>;
  /** Text attached to a provider in this tab only (never in the graph document or a link). */
  side?: string;
  /** The graph's seed; read it only in a node that declares `seeded`. */
  seed: number;
  /** Aborted when a newer revision of the graph supersedes this run. */
  signal: AbortSignal;
}

export type Outputs = Record<string, Value>;

/** Thrown by a run that cannot start yet (nothing attached, no schema approved): not a failure. */
export class Wait extends Error {}

/** How the editor presents a sink: each is a renderer adapter over a declared value. */
export type View = 'chart' | 'scatter' | 'readout' | 'export';

export interface NodeDef<S = unknown> {
  type: string;
  title: string;
  category: Category;
  summary: string;
  /** The catalogue entry whose code this node runs; its plate is linked from the node. */
  entry?: string;
  params: ParamDef[];
  inputs: PortDecl[];
  outputs: PortDecl[];
  /**
   * Output types that depend on parameters, state or concrete input types (a column's unit, a
   * spectrum's axis). A string is a type error the graph reports at the node.
   */
  infer?(a: { params: Params; state: S; inputs: Record<string, PortType | undefined> }): Record<string, PortType> | string;
  /** Node-owned canonical state (points a reader may move, an approved schema). */
  state?: {
    initial(params: Params): S;
    /** Parse untrusted state (an import, a link): the state, or the reason it is refused. */
    parse(raw: unknown): S | string;
  };
  intents?: Record<string, IntentDecl<S>>;
  /** Reads attached text (`RunContext.side`): its digest joins the node's fingerprint. */
  side?: { label: string; bytes: number };
  view?: View;
  /** Its result depends on the graph's seed, which then joins its fingerprint. */
  seeded?: boolean;
  /**
   * Set by derivation (src/flow/derive.ts) on a family node an engine adapter builds from the
   * catalogue: the entries it runs, chosen by the select parameter `param`. A node without it is
   * declared, written in nodes.ts.
   */
  origin?: { level: 'derived'; adapter: string; entries: readonly string[]; param: string };
  run(ctx: RunContext<S>): Outputs | Promise<Outputs>;
}

export type AnyNodeDef = NodeDef<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Registry = ReadonlyMap<string, AnyNodeDef>;

export function registry(defs: AnyNodeDef[]): Registry {
  const m = new Map<string, AnyNodeDef>();
  for (const d of defs) {
    if (m.has(d.type)) throw new Error(`flow: node type ${d.type} defined twice`);
    const ids = [...d.inputs, ...d.outputs].map((p) => p.id);
    if (new Set(ids).size !== ids.length) throw new Error(`flow: ${d.type} repeats a port id`);
    m.set(d.type, d);
  }
  return m;
}
