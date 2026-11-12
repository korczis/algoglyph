// Which kernel plays which entry, as the build-time catalogue model carries it: the catalogue
// gate resolves catalogue/sorting-sidecar.yaml into `model.sidecar` (entry id -> the sidecar,
// the adapter and the kernel), so the client ships the mapping it needs and no parser. Nothing
// here lists an algorithm.
import { CATALOGUE, type Catalogue } from '../../core/catalogue';
import type { KernelOption } from '../../engines/array/trace';

// the model also carries a record's validated `options` (scripts/lib/catalogue.mjs sidecarOptions)
type Backing = NonNullable<Catalogue['sidecar']>[string] & { options?: KernelOption[] };
const MAP: Record<string, Backing> = CATALOGUE.sidecar ?? {};

/** The kernel that plays entry `id` (one entry, one record, one kernel), if a sidecar maps it. */
export function kernelOf(id: string): string | undefined {
  return MAP[id]?.kernel;
}

/** The largest n entry `id`'s kernel plays at, when its measured rebuild cost bounds it. */
export function maxNOf(id: string): number | undefined {
  return MAP[id]?.maxN;
}

/** The constants of entry `id`'s kernel its plate tunes (the record's `options`), if any. */
export function optionsOf(id: string): readonly KernelOption[] | undefined {
  return MAP[id]?.options;
}
