// Claims (ADR 0007), the part the catalogue checks without running anything.

/**
 * The static form of a list of claims (ADR 0007): exactly one of value, range, below and above; a
 * range is [lo, hi] with lo <= hi; a tolerance only around a value; a comparison judged by exactly
 * one of tolerance, below and above; expect.number, the readout's number read, a positive integer; ids unique within the list; no setup value naming a reader's
 * data option (data:<id>, ADR 0010), which the instrument cannot pass. Whether a claim's readout exists
 * and its value holds is the plate's to show: test/claims.test.ts runs it. One definition, for an
 * entry's claims and a figure's (scripts/lib/figures.mjs).
 */
export function claimErrors(claims) {
  const out = [];
  const claimIds = new Set();
  for (const [i, c] of claims.entries()) {
    const at = `claims[${i}]${c?.id ? ` (${c.id})` : ''}`;
    const err = (m) => out.push(`${at}: ${m}`);
    if (!c || typeof c !== 'object') continue;
    if (c.id && claimIds.has(c.id)) err(`id ${c.id} is used twice`);
    if (c.id) claimIds.add(c.id);
    const x = c.expect ?? {};
    const hasValue = typeof x.value === 'number';
    const hasRange = Array.isArray(x.range);
    const against = typeof x.against === 'string';
    if (against) {
      // a comparison judges a difference: by tolerance, below or above, never value or range
      const judged = [typeof x.tolerance === 'number', typeof x.below === 'number', typeof x.above === 'number'].filter(Boolean).length;
      if (hasValue || hasRange || judged !== 1) err('expect.against needs exactly one of tolerance, below and above, and no value or range');
      if (x.against_number !== undefined && x.against_number < 1) err('expect.against_number counts from 1');
    } else {
      const forms = [hasValue, hasRange, typeof x.below === 'number', typeof x.above === 'number'].filter(Boolean).length;
      if (forms !== 1) err('expect needs exactly one of value, range, below and above');
      if (x.against_number !== undefined) err('expect.against_number needs expect.against');
      if (x.offset !== undefined) err('expect.offset is a difference from expect.against');
    }
    if (x.number !== undefined && !(Number.isInteger(x.number) && x.number >= 1)) err('expect.number is a positive integer, counting from 1');
    if (hasRange && (x.range.length !== 2 || x.range[0] > x.range[1])) err('expect.range must be [lo, hi] with lo <= hi');
    if (x.tolerance !== undefined && !hasValue && !against) err('expect.tolerance is a distance around expect.value');
    if (typeof x.tolerance === 'number' && x.tolerance < 0) err('expect.tolerance cannot be negative');
    // a reader's own data (ADR 0010) never reaches the instrument: its context carries no `data`,
    // so the plate would run its generated input under that option and the claim would read it
    const params = c.setup?.params;
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string' && v.startsWith('data:')) {
          err(`setup.params.${k} is the reader-data option ${v}; the claims instrument passes no uploaded data, so the plate would silently run its generated input and the claim would read that`);
        }
      }
    }
  }
  return out;
}
