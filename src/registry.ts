// The registry is discovered, never listed (ADR 0004 §3): a bespoke plate is
// src/plates/<id>/plate.ts, an engine-driven one is src/kernels/<engine>/<id>.ts, and the
// catalogue entry of the same id says which. An array entry with no kernel file may instead be
// mapped by a catalogue/<family>-sidecar.yaml to a compiled kernel, which the adapter
// src/kernels/<family>-wasm/index.ts plays; the catalogue resolves the mapping (model.sidecar).
// Code is loaded on demand, so the gallery ships the catalogue and nothing else.
import {
  CATALOGUE, entry, lab as findLab, node, type Catalogue, type Entry,
} from './core/catalogue';
import type { Plate, PlateCode } from './core/plate';
import type { ArrayKernel } from './engines/array/trace';
import type { Engine, KernelInfo } from './engines/types';

/** The adapter contract of src/kernels/<family>-wasm/index.ts. */
export type SidecarKernel = (entryId: string) => Promise<ArrayKernel>;
/** Where a sidecar-mapped entry is played: the sidecar, the adapter directory, the kernel. */
export interface Backing {
  sidecar: string;
  adapter: string;
  kernel: string;
}
type Load<T> = () => Promise<T>;
/** What kernel resolution reads; the defaults are this tree's files and catalogue. */
export interface KernelSources {
  kernels: Record<string, Load<unknown>>;
  backing: Record<string, Backing>;
  adapters: Record<string, Load<SidecarKernel>>;
}

const PLATES = import.meta.glob<PlateCode>('./plates/*/plate.ts', { import: 'default' });
const KERNELS = import.meta.glob<unknown>('./kernels/*/[!_]*.ts', { import: 'kernel' });
const ENGINES = import.meta.glob<Engine>('./engines/*/index.ts', { import: 'engine' });
// A glob, not a literal import(): each adapter becomes its own lazy chunk, and the bundle
// builds while no adapter exists.
const ADAPTERS = import.meta.glob<SidecarKernel>('./kernels/*-wasm/index.ts',
  { import: 'sidecarKernel' });
const SOURCES: KernelSources = {
  kernels: KERNELS,
  backing: (CATALOGUE as Catalogue & { sidecar?: Record<string, Backing> }).sidecar ?? {},
  adapters: ADAPTERS,
};

function info(e: Entry): KernelInfo {
  const shelf = node(e.taxonomy);
  return { id: e.id, title: e.title, group: shelf?.title ?? e.taxonomy };
}

async function engine(id: string): Promise<Engine> {
  const load = ENGINES[`./engines/${id}/index.ts`];
  if (!load) throw new Error(`engine ${id}: no src/engines/${id}/index.ts`);
  return load();
}

/**
 * The lazy loader of an entry's kernel: its file src/kernels/<engine>/<id>.ts, else, for an
 * entry a sidecar maps, the adapter's sidecarKernel(id). The catalogue maps only engines an
 * adapter plays (array) and only entries without a file. Throws when neither exists, when
 * both do, or when the mapped adapter is not in the tree.
 */
export function kernelLoader(
  e: Pick<Entry, 'id' | 'engine'>, s: KernelSources = SOURCES,
): Load<unknown> {
  const file: Load<unknown> | undefined = s.kernels[`./kernels/${e.engine}/${e.id}.ts`];
  const b: Backing | undefined = s.backing[e.id];
  if (file !== undefined && b !== undefined) {
    throw new Error(
      `${e.id}: src/kernels/${e.engine}/${e.id}.ts and ${b.sidecar} both implement it`);
  }
  if (file) return file;
  if (!b) throw new Error(`${e.id}: no src/kernels/${e.engine}/${e.id}.ts`);
  const adapter = s.adapters[`./kernels/${b.adapter}/index.ts`];
  if (!adapter) {
    throw new Error(
      `${e.id}: ${b.sidecar} maps it, but src/kernels/${b.adapter}/index.ts does not exist`);
  }
  return async () => (await adapter())(e.id);
}

async function kernel(e: Entry): Promise<unknown> {
  return kernelLoader(e)();
}

async function code(e: Entry): Promise<PlateCode> {
  if (e.engine === 'custom') {
    const load = PLATES[`./plates/${e.id}/plate.ts`];
    if (!load) throw new Error(`${e.id}: no src/plates/${e.id}/plate.ts`);
    return load();
  }
  const [eng, k] = await Promise.all([engine(e.engine), kernel(e)]);
  return eng.plate(info(e), k);
}

const cache = new Map<string, Promise<Plate>>();

/** The runnable plate of a live entry; undefined for an unknown or planned id. */
export function loadPlate(id: string): Promise<Plate> | undefined {
  const e = entry(id);
  if (!e || e.status !== 'live') return undefined;
  let p = cache.get(id);
  if (!p) {
    p = code(e).then((c) => {
      if (c.id !== id) throw new Error(`${id}: its code declares id ${c.id}`);
      return { ...c, title: e.title, summary: e.summary, no: e.no };
    });
    // a failed load (a module that did not arrive) is not remembered: the next visit retries
    p.catch(() => { if (cache.get(id) === p) cache.delete(id); });
    cache.set(id, p);
  }
  return p;
}

/**
 * The runnable lab plate: every live kernel the lab names, side by side. A kernel that fails to
 * load (a compiled module that did not arrive) is left out and named in the lab's summary; the
 * others run. Only when too few remain does the lab fail, with the first error.
 */
export async function loadLab(id: string): Promise<Plate | undefined> {
  const l = findLab(id);
  if (!l) return undefined;
  const live = l.entries.map((x) => entry(x)).filter((e): e is Entry => e?.status === 'live');
  if (live.length < CATALOGUE.labMin) return undefined;
  const eng = await engine(l.engine);
  const settled = await Promise.allSettled(live.map(async (e) => ({ info: info(e), kernel: await kernel(e) })));
  const kernels = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = live.filter((_, i) => settled[i].status === 'rejected');
  if (kernels.length < CATALOGUE.labMin) {
    throw (settled.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
  }
  if (failed.length) {
    const reasons = settled.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
    console.warn(`lab ${id}: not loaded: ${failed.map((e) => e.id).join(', ')}`, reasons);
  }
  const c = eng.lab(id, kernels);
  const summary = failed.length
    ? `${l.summary} Not loaded this time: ${failed.map((e) => e.title).join(', ')}.` : l.summary;
  return { ...c, title: l.title, summary, no: 'lab' };
}

/** Whether a lab has enough live kernels to run. */
export function labRunnable(id: string): boolean {
  const l = findLab(id);
  return Boolean(l && l.entries.filter((x) => entry(x)?.status === 'live').length >= CATALOGUE.labMin);
}
