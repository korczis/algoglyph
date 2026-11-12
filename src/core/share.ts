// A plate's URL carries its seed and every parameter that differs from the default, so a copied
// link redraws the same picture with the same knobs. Values from a URL are untrusted:
//   - a range value must be a plain decimal number; it is clamped into [min, max] and snapped to
//     the control's step (a value outside the range is clamped, not dropped, so a link made
//     with an older, wider slider still opens close to what it showed);
//   - a select value must be one of the options and a toggle 0/1/true/false; anything else is
//     dropped and the default stays;
//   - the seed must be a decimal integer in 1 … SEED_MAX, the range freshSeed() draws from, so
//     two different links never alias to the same generator state.
import type { ParamDef, Params, ParamValue, RangeParam } from './plate';
import { SEED_MAX } from './random';

export { SEED_MAX };
const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** The seed of a query, or undefined when it is absent or not a plain integer in range. */
export function parseSeed(query: string): number | undefined {
  const text = new URLSearchParams(query).get('seed');
  if (text === null || !/^\d{1,10}$/.test(text)) return undefined;
  const n = Number(text);
  return n >= 1 && n <= SEED_MAX ? n : undefined;
}

/** A number clamped into the range and snapped to its step (no snapping for a step <= 0). */
export function snap(d: RangeParam, n: number): number {
  const clamped = Math.min(d.max, Math.max(d.min, n));
  if (!(d.step > 0)) return clamped;
  const snapped = d.min + Math.round((clamped - d.min) / d.step) * d.step;
  // the last grid point never passes max, and float noise is trimmed so values compare equal
  const top = d.min + Math.floor((d.max - d.min) / d.step + 1e-9) * d.step;
  return Number(Math.min(top, snapped).toFixed(10));
}

function fromText(d: ParamDef, text: string): ParamValue | undefined {
  if (d.kind === 'toggle') {
    if (text === '1' || text === 'true') return true;
    if (text === '0' || text === 'false') return false;
    return undefined;
  }
  if (d.kind === 'select') return d.options.some((o) => o.value === text) ? text : undefined;
  if (!DECIMAL.test(text)) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? snap(d, n) : undefined;
}

function toText(d: ParamDef, v: ParamValue): string {
  if (d.kind === 'toggle') return v ? '1' : '0';
  // a value set by code can carry float noise (1.4000000000000001): write it on the control's grid
  if (d.kind === 'range') return String(snap(d, Number(v)));
  return String(v);
}

/**
 * The query for a plate: seed first, then the parameters that differ from `base` in definition
 * order. The base is the plate's defaults; a figure page (ADR 0009) passes its setup over them,
 * so its clean link carries the seed alone.
 */
export function serialise(defs: ParamDef[], params: Params, seed: number, base: Params = {},
  data: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  q.set('seed', String(seed));
  for (const d of defs) {
    const v = params[d.key];
    if (v === undefined) continue;
    const b = base[d.key] ?? d.value;
    // compare on the control's grid, so float noise around a default is not a change
    const same = d.kind === 'range' ? snap(d, Number(v)) === snap(d, Number(b)) : v === b;
    if (same) continue;
    q.set(d.key, toText(d, v));
  }
  // a reader's own data (ADR 0010): the token src/core/data.ts made, after every parameter
  for (const [id, token] of Object.entries(data)) if (DATA_ID.test(id)) q.set(`d.${id}`, token);
  return q.toString();
}

const DATA_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The data tokens of a query, by declared id (`d.<id>`), as written: each is untrusted text that
 * src/core/data.ts decodes and validates against the plate's declaration (ADR 0010).
 */
export function dataTokens(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(query)) {
    if (!k.startsWith('d.')) continue;
    const id = k.slice(2);
    if (DATA_ID.test(id)) out[id] = v;
  }
  return out;
}

/** Seed and parameters read from a query, each validated; unknown keys are ignored. */
export function parse(defs: ParamDef[], query: string): { seed?: number; params: Params } {
  const q = new URLSearchParams(query);
  const params: Params = {};
  for (const d of defs) {
    const text = q.get(d.key);
    if (text === null) continue;
    const v = fromText(d, text);
    if (v !== undefined) params[d.key] = v;
  }
  return { seed: parseSeed(query), params };
}

/**
 * A debounced URL writer that a route change can cancel. Live knobs schedule a write; leaving
 * the plate cancels it, so a late write never puts a plate URL over a catalogue view.
 */
export class HashWriter {
  private timer: ReturnType<typeof setTimeout> | undefined;

  // The defaults wrap the globals: called as `this.timers.set(…)`, a bare setTimeout would get
  // the timers object as its receiver, which a browser refuses ("Illegal invocation").
  constructor(private readonly delay = 250,
    private readonly timers: {
      set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
      clear: (id: ReturnType<typeof setTimeout>) => void;
    } = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) }) {}

  schedule(write: () => void): void {
    this.cancel();
    this.timer = this.timers.set(() => {
      this.timer = undefined;
      write();
    }, this.delay);
  }

  cancel(): void {
    if (this.timer !== undefined) this.timers.clear(this.timer);
    this.timer = undefined;
  }

  get pending(): boolean {
    return this.timer !== undefined;
  }
}
