// The generic connection of the catalogue to the flow (RFC §5). No algorithm becomes a node by
// a hand-written definition: an engine adapter reads the catalogue and turns every live entry of
// its engine into a choice of one family node, so an entry that goes live joins the graph with no
// edit here. Each live entry is accounted for at exactly one level:
//
//   declared  a node written in nodes.ts names the entry it runs (`entry`);
//   derived   an engine adapter accepts the entry and its family node runs the entry's kernel;
//   inferred  no adapter runs it: a hypothesis read from the code's shape and the catalogue,
//             with the reason, shown and never runnable; it becomes derived only when an adapter
//             declares its ports and test/flow-derive.test.ts validates the run.
//
// Nothing here is counted by hand: the levels, the choices and the reasons are computed from the
// catalogue and the source tree each time (rule project.derived-facts).
import { ENTRIES, type Entry } from '../core/catalogue';
import type { AnyNodeDef, NodeDef } from './node';

export type Level = 'declared' | 'derived' | 'inferred';

/** How an engine's kernels become one family node. */
export interface Adapter {
  engine: string;
  /** The type of the family node it derives. */
  type: string;
  /** What the family node consumes and produces, in one line (shown with its proposals). */
  signature: string;
  /** null when the entry joins the family node; otherwise why it does not. */
  refuse(e: Entry): string | null;
  /** The family node over the accepted entries; `load` resolves an entry to its kernel. */
  node(entries: Entry[], load: KernelLoad): NodeDef;
}

export type KernelLoad = (e: Entry) => Promise<unknown>;

export interface Coverage {
  id: string;
  title: string;
  engine: string;
  level: Level;
  /** The node type that runs it (declared or derived). */
  node?: string;
  /** Why it is at this level: the adapter's reason, or what the inference rests on. */
  reason: string;
  /** For an inferred entry: the proposed node, if the code suggests one. */
  proposal?: string;
}

/** Engines whose kernels run without drawing (a trace or a simulator module): read from the tree. */
const RUNNERS = Object.keys(import.meta.glob('../engines/*/{trace,sim}.ts'))
  .map((p) => /engines\/([^/]+)\//.exec(p)?.[1] ?? '');

export const headless = (engine: string, runners: readonly string[] = RUNNERS): boolean => runners.includes(engine);

const live = (entries: readonly Entry[]) => entries.filter((e) => e.status === 'live');

/** The family nodes the adapters derive from the live entries; an adapter that accepts none adds none. */
export function deriveNodes(adapters: readonly Adapter[], load: KernelLoad, entries: readonly Entry[] = ENTRIES): NodeDef[] {
  const engines = new Set<string>();
  const out: NodeDef[] = [];
  for (const a of adapters) {
    if (engines.has(a.engine)) throw new Error(`flow: two adapters for engine ${a.engine}`);
    engines.add(a.engine);
    const accepted = live(entries).filter((e) => e.engine === a.engine && a.refuse(e) === null)
      .sort((x, y) => x.title.localeCompare(y.title));
    if (!accepted.length) continue;
    const d = a.node(accepted, load);
    if (d.type !== a.type) throw new Error(`flow: the ${a.engine} adapter derived ${d.type}, not ${a.type}`);
    out.push({ ...d, origin: { level: 'derived', adapter: a.engine, entries: accepted.map((e) => e.id), param: 'kernel' } });
  }
  return out;
}

/** Why an entry no adapter runs is not a node, and what the code suggests it could become. */
function infer(e: Entry, runners: readonly string[]): Pick<Coverage, 'reason' | 'proposal'> {
  if (e.engine === 'custom') {
    return { reason: 'a bespoke plate keeps its computation inside its drawing; it joins once that computation is lifted out (RFC §H step 2)' };
  }
  if (headless(e.engine, runners)) {
    return {
      reason: `src/engines/${e.engine} runs its kernels without drawing, but no adapter declares their ports yet`,
      proposal: 'seeded provider: the engine\'s own instance in, its measured counts out (record)',
    };
  }
  return { reason: `src/engines/${e.engine} has no headless runner; its kernels run only inside a plate` };
}

/**
 * Every live entry, at its level. Declared wins over derived (a hand-written node that names its
 * entry is the more specific contract); an entry an adapter refuses is inferred with the refusal.
 */
export function coverage(declared: readonly AnyNodeDef[], adapters: readonly Adapter[],
  entries: readonly Entry[] = ENTRIES, runners: readonly string[] = RUNNERS): Coverage[] {
  const byEntry = new Map(declared.filter((d) => d.entry).map((d) => [d.entry as string, d.type]));
  const byEngine = new Map(adapters.map((a) => [a.engine, a]));
  return live(entries).map((e): Coverage => {
    const base = { id: e.id, title: e.title, engine: e.engine };
    const node = byEntry.get(e.id);
    if (node) return { ...base, level: 'declared', node, reason: `the ${node} node names it` };
    const a = byEngine.get(e.engine);
    const why = a?.refuse(e);
    if (a && why === null) return { ...base, level: 'derived', node: a.type, reason: a.signature };
    if (a && why) return { ...base, level: 'inferred', reason: why };
    return { ...base, level: 'inferred', ...infer(e, runners) };
  }).sort((x, y) => x.engine.localeCompare(y.engine) || x.title.localeCompare(y.title));
}

/** Entries per level, computed (never stored). */
export function tally(c: readonly Coverage[]): Record<Level, number> {
  const t: Record<Level, number> = { declared: 0, derived: 0, inferred: 0 };
  for (const x of c) t[x.level]++;
  return t;
}
