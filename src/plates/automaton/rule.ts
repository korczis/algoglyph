// Elementary cellular automata (Wolfram's 256 rules) on a ring.

/** The neighbourhood index (left·4 + centre·2 + right) of every cell. */
export function neighbourhoods(row: Uint8Array, out: Uint8Array): void {
  const n = row.length;
  for (let i = 0; i < n; i++) {
    out[i] = (row[(i - 1 + n) % n] << 2) | (row[i] << 1) | row[(i + 1) % n];
  }
}

/** Next generation: bit k of `rule` is the new state of neighbourhood k. */
export function next(rule: number, hood: Uint8Array, out: Uint8Array): void {
  for (let i = 0; i < hood.length; i++) out[i] = (rule >> hood[i]) & 1;
}

export function binary(rule: number): string {
  return rule.toString(2).padStart(8, '0');
}
