// The registry is discovered, never listed (ADR 0004 §3): a bespoke plate is
// src/plates/<id>/plate.ts, an engine-driven one is src/kernels/<engine>/<id>.ts, and the
// catalogue entry of the same id says which. Code is loaded on demand, so the gallery ships
// the catalogue and nothing else.
import { entry, lab as findLab, node, type Entry } from './core/catalogue';
import type { Plate, PlateCode } from './core/plate';
import type { Engine, KernelInfo } from './engines/types';

const PLATES = import.meta.glob<PlateCode>('./plates/*/plate.ts', { import: 'default' });
const KERNELS = import.meta.glob<unknown>('./kernels/*/[!_]*.ts', { import: 'kernel' });
const ENGINES = import.meta.glob<Engine>('./engines/*/index.ts', { import: 'engine' });

function info(e: Entry): KernelInfo {
  const shelf = node(e.taxonomy);
  return { id: e.id, title: e.title, group: shelf?.title ?? e.taxonomy };
}

async function engine(id: string): Promise<Engine> {
  const load = ENGINES[`./engines/${id}/index.ts`];
  if (!load) throw new Error(`engine ${id}: no src/engines/${id}/index.ts`);
  return load();
}

async function kernel(e: Entry): Promise<unknown> {
  const load = KERNELS[`./kernels/${e.engine}/${e.id}.ts`];
  if (!load) throw new Error(`${e.id}: no src/kernels/${e.engine}/${e.id}.ts`);
  return load();
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
    cache.set(id, p);
  }
  return p;
}

/** The runnable lab plate: every live kernel the lab names, side by side. */
export async function loadLab(id: string): Promise<Plate | undefined> {
  const l = findLab(id);
  if (!l) return undefined;
  const live = l.entries.map((x) => entry(x)).filter((e): e is Entry => e?.status === 'live');
  if (live.length < 2) return undefined;
  const eng = await engine(l.engine);
  const kernels = await Promise.all(live.map(async (e) => ({ info: info(e), kernel: await kernel(e) })));
  const c = eng.lab(id, kernels);
  return { ...c, title: l.title, summary: l.summary, no: 'lab' };
}

/** Whether a lab has enough live kernels to run. */
export function labRunnable(id: string): boolean {
  const l = findLab(id);
  return Boolean(l && l.entries.filter((x) => entry(x)?.status === 'live').length >= 2);
}
