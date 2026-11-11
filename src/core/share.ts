// A plate's URL carries its seed and every parameter that differs from the default, so a copied
// link redraws the same picture with the same knobs. Values from a URL are untrusted: each is
// checked against its control (range bounds and step, select options, toggle) and dropped when
// it does not fit, never passed through.
import type { ParamDef, Params, ParamValue } from './plate';

function fromText(d: ParamDef, text: string): ParamValue | undefined {
  if (d.kind === 'toggle') {
    if (text === '1' || text === 'true') return true;
    if (text === '0' || text === 'false') return false;
    return undefined;
  }
  if (d.kind === 'select') return d.options.some((o) => o.value === text) ? text : undefined;
  if (text.trim() === '') return undefined;
  const n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.min(d.max, Math.max(d.min, n));
  // snap to the control's own grid, so a value always matches what the slider can show
  const snapped = d.min + Math.round((clamped - d.min) / d.step) * d.step;
  return Number(Math.min(d.max, snapped).toFixed(10));
}

function toText(d: ParamDef, v: ParamValue): string {
  if (d.kind === 'toggle') return v ? '1' : '0';
  return String(v);
}

/** The query for a plate: seed first, then the non-default parameters in definition order. */
export function serialise(defs: ParamDef[], params: Params, seed: number): string {
  const q = new URLSearchParams();
  q.set('seed', String(seed));
  for (const d of defs) {
    const v = params[d.key];
    if (v === undefined || v === d.value) continue;
    q.set(d.key, toText(d, v));
  }
  return q.toString();
}

/** Parameters read from a query, each validated against its definition; unknown keys are ignored. */
export function parse(defs: ParamDef[], query: string): { seed?: number; params: Params } {
  const q = new URLSearchParams(query);
  const params: Params = {};
  for (const d of defs) {
    const text = q.get(d.key);
    if (text === null) continue;
    const v = fromText(d, text);
    if (v !== undefined) params[d.key] = v;
  }
  const seed = Number(q.get('seed'));
  return { seed: Number.isInteger(seed) && seed > 0 ? seed : undefined, params };
}
