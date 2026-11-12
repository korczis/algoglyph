// The sense of an entry's `data` declarations (ADR 0010), past the shape the schema checks
// (catalogue/schema/entry.yaml): what a well-formed declaration can still get wrong. Whether the
// select it names exists is the plate's, checked by test/registry.test.ts.

/** Every problem with an entry's data declarations, as messages. */
export function dataErrors(decls) {
  const out = [];
  const ids = new Set();
  for (const [i, d] of decls.entries()) {
    if (!d || typeof d !== 'object') continue;
    const at = `data[${i}]${d.id ? ` (${d.id})` : ''}`;
    if (d.id && ids.has(d.id)) out.push(`${at}: id ${d.id} is used twice`);
    if (d.id) ids.add(d.id);
    const cols = Array.isArray(d.columns) ? d.columns : [];
    if (d.kind === 'series' && cols.length !== 1) out.push(`${at}: a series has exactly one column`);
    const keys = new Set();
    for (const c of cols) {
      if (c?.key && keys.has(c.key)) out.push(`${at}: column ${c.key} is named twice`);
      if (c?.key) keys.add(c.key);
      if (typeof c?.min === 'number' && typeof c?.max === 'number' && c.min > c.max) {
        out.push(`${at}: column ${c.key} has min ${c.min} above max ${c.max}`);
      }
    }
    if (Array.isArray(d.ignores) && d.ignores.includes(d.replaces)) out.push(`${at}: ignores names ${d.replaces}, the select it replaces`);
    const r = d.rows ?? {};
    if (Number.isInteger(r.min) && r.min < 1) out.push(`${at}: rows.min must be at least 1`);
    if (Number.isInteger(r.min) && Number.isInteger(r.max) && r.min > r.max) out.push(`${at}: rows.min ${r.min} is above rows.max ${r.max}`);
    if (Number.isInteger(d.bytes) && d.bytes < 64) out.push(`${at}: bytes must be at least 64`);
    if (Number.isInteger(d.url_bytes) && d.url_bytes < 0) out.push(`${at}: url_bytes cannot be negative`);
    if (Number.isInteger(d.url_bytes) && Number.isInteger(d.bytes) && d.url_bytes > Math.ceil((d.bytes * 4) / 3) + 4) {
      out.push(`${at}: url_bytes ${d.url_bytes} is more than bytes ${d.bytes} can encode to`);
    }
  }
  return out;
}
