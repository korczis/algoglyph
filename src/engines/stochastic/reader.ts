// A reader's own data on a stochastic plate (ADR 0010): the table its select picks, when the page
// holds one, and the readout every adopter publishes on it, which the browser gate and
// test/data-adopters.test.ts look for. Pure: no network, no storage.
import { optionId, type DataTable } from '../../core/data';
import type { Params } from '../../core/plate';

/** The reader's table when the select `key` picks a data option and the page holds it; null otherwise. */
export function readerTable(cfg: Params, key: string, data?: (id: string) => DataTable | null): DataTable | null {
  const id = optionId(cfg[key]);
  return id && data ? data(id) : null;
}

/** A column of the reader's table as plain numbers. */
export const column = (t: DataTable, j = 0): number[] => Array.from(t.values[j]);

/** The `Input` readout on a reader's data: what was read, in the plate's own words. */
export const readerInput = (what: string): { label: string; value: string } => ({ label: 'Input', value: `your data, ${what}` });
