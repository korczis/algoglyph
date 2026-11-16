// The flow's type system (RFC docs/rfc/0001-typed-reactive-dag.md §4). A port carries one of a
// few structural kinds, and every quantity in it carries its unit. Units are compared as exact
// strings: `s` and `Hz` never meet without a conversion node, and nothing is coerced. A unit that
// starts with `$` is a variable of the node it appears on: the first edge into the node binds it,
// and every other use on that node (inputs and outputs) must agree. One pure function, `unify`,
// decides compatibility; the editor, the importer, the runtime and the tests all call it.

export type Unit = string;

export type PortType =
  /** Values in `unit`, sampled along an axis in `index` (a position `1`, a time `s`, a frequency `Hz`). */
  | { kind: 'series'; unit: Unit; index: Unit }
  /** Points in the plane, x in `x`, y in `y`. */
  | { kind: 'points'; x: Unit; y: Unit }
  /**
   * Named numeric columns, each with its unit (src/core/data.ts DataTable). `columns` is known
   * once a schema is approved; a port that declares none accepts any table.
   */
  | { kind: 'table'; columns?: readonly { key: string; unit: Unit }[] }
  /** Measured readouts: label, value, unit. */
  | { kind: 'record' };

export type Bindings = Readonly<Record<string, Unit>>;

export type Unified = { ok: true; bindings: Bindings } | { ok: false; reason: string };

const isVar = (u: Unit) => u.startsWith('$');

/** The unit fields of a type, in a fixed order, with a name a reader understands. */
function fields(t: PortType): [string, Unit][] {
  switch (t.kind) {
    case 'series': return [['values', t.unit], ['axis', t.index]];
    case 'points': return [['x', t.x], ['y', t.y]];
    default: return [];
  }
}

export function show(t: PortType): string {
  switch (t.kind) {
    case 'series': return `Series<${t.unit}, axis ${t.index}>`;
    case 'points': return `Points<${t.x}, ${t.y}>`;
    case 'table': return 'Table';
    case 'record': return 'Readouts';
  }
}

/**
 * Can a value of type `out` (an upstream output, concrete or partly unbound) flow into a port
 * declared as `inp` on a node whose variables are bound as `bindings`? On success the bindings
 * are extended; on failure the reason names the field and both units.
 */
export function unify(out: PortType, inp: PortType, bindings: Bindings = {}): Unified {
  if (out.kind !== inp.kind) {
    return { ok: false, reason: `${show(out)} cannot feed ${show(inp)}: a ${out.kind} is not a ${inp.kind}` };
  }
  const b: Record<string, Unit> = { ...bindings };
  const of = fields(out);
  const want = fields(inp);
  for (let i = 0; i < want.length; i++) {
    const [name, w] = want[i];
    const got = of[i][1];
    // an unbound upstream variable (its own input not yet connected) says nothing yet
    if (isVar(got)) continue;
    const need = isVar(w) ? b[w] : w;
    if (need === undefined) { b[w] = got; continue; }
    if (need !== got) {
      return {
        ok: false,
        reason: `${name} in ${got} where ${need} is expected: no implicit unit conversion`,
      };
    }
  }
  return { ok: true, bindings: b };
}

/** `t` with its variables replaced by their bindings; unbound ones stay variables. */
export function substitute(t: PortType, b: Bindings): PortType {
  const s = (u: Unit) => (isVar(u) && b[u] !== undefined ? b[u] : u);
  switch (t.kind) {
    case 'series': return { kind: 'series', unit: s(t.unit), index: s(t.index) };
    case 'points': return { kind: 'points', x: s(t.x), y: s(t.y) };
    default: return t;
  }
}

/** True when no unit of `t` is a variable. */
export const concrete = (t: PortType): boolean => fields(t).every(([, u]) => !isVar(u));

// ---- values: what flows along an edge at run time --------------------------------------------

export interface SeriesValue {
  kind: 'series';
  values: Float64Array;
  unit: Unit;
  /** The sample axis: the i-th value sits at start + i * step, in `index`. */
  index: { unit: Unit; start: number; step: number };
  label: string;
}

export interface PointsValue {
  kind: 'points';
  xs: Float64Array;
  ys: Float64Array;
  x: Unit;
  y: Unit;
  /**
   * The node whose state holds these points, when they are canonical state rather than a result
   * (RFC §6): a view that lets the reader move a point sends its intent there, never back along
   * the edge.
   */
  owner?: string;
  label: string;
}

export interface TableValue {
  kind: 'table';
  keys: string[];
  units: Unit[];
  columns: Float64Array[];
  rows: number;
  digest: string;
}

export interface RecordValue {
  kind: 'record';
  rows: { label: string; value: number; unit: Unit }[];
}

export type Value = SeriesValue | PointsValue | TableValue | RecordValue;

/** The type a value has, for the runtime's own check that a node produced what it declared. */
export function typeOf(v: Value): PortType {
  switch (v.kind) {
    case 'series': return { kind: 'series', unit: v.unit, index: v.index.unit };
    case 'points': return { kind: 'points', x: v.x, y: v.y };
    case 'table': return { kind: 'table', columns: v.keys.map((key, i) => ({ key, unit: v.units[i] })) };
    case 'record': return { kind: 'record' };
  }
}
