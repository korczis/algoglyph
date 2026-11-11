// The sorting sidecar as data: catalogue/sorting-sidecar.yaml maps each catalogue entry id to
// the atlas kernel (Rust plugin) that implements it. Nothing here lists an algorithm; an entry
// is played by the wasm kernel the sidecar names, and by nothing else.
import { parse } from 'yaml';

export interface SidecarRecord {
  /** The catalogue entry id. */
  id: string;
  /** The atlas kernel id (its slug). */
  kernel: string;
  /** The entry predates the fold (it may have its own TypeScript kernel). */
  existing: boolean;
  engine: string;
  family?: string;
  kernel_stable?: string;
  kernel_kind?: string;
  custom_plate?: string;
}

const RAW = import.meta.glob<string>('../../../catalogue/sorting-sidecar.yaml',
  { query: '?raw', import: 'default', eager: true });

function load(): SidecarRecord[] {
  const text = Object.values(RAW)[0];
  if (!text) return [];
  const doc = parse(text) as { entries?: SidecarRecord[] } | null;
  return (doc?.entries ?? []).filter((r) => typeof r?.id === 'string' && typeof r?.kernel === 'string');
}

/** Every record, in the sidecar's order (one entry may stand for several kernels). */
export const SIDECAR: SidecarRecord[] = load();

/** The records of one entry, in the sidecar's order. */
export function recordsOf(id: string): SidecarRecord[] {
  return SIDECAR.filter((r) => r.id === id);
}

/**
 * The kernel that plays entry `id`: the record whose kernel has the entry's own id, else the
 * entry's first record. One entry, one live plate, one kernel.
 */
export function kernelOf(id: string): string | undefined {
  const rs = recordsOf(id);
  return (rs.find((r) => r.kernel === id) ?? rs[0])?.kernel;
}
