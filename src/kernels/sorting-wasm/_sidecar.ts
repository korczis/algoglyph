// Which kernel plays which entry, as the build-time catalogue model carries it: the catalogue
// gate resolves catalogue/sorting-sidecar.yaml into `model.sidecar` (entry id -> the sidecar,
// the adapter and the kernel), so the client ships the mapping it needs and no parser. Nothing
// here lists an algorithm.
import { CATALOGUE, type Catalogue } from '../../core/catalogue';

type Backing = NonNullable<Catalogue['sidecar']>[string];
const MAP: Record<string, Backing> = CATALOGUE.sidecar ?? {};

/** The kernel that plays entry `id` (one entry, one record, one kernel), if a sidecar maps it. */
export function kernelOf(id: string): string | undefined {
  return MAP[id]?.kernel;
}

