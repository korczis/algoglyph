// Which transport to build, decided by return on investment, never by habit. For every demand
// (cargo from a source to a sink) the routes are enumerated on a multimodal graph — a node per
// place and mode, a leg edge per mode between places, a transfer edge at a hub — by the
// collection's own Yen's k-shortest-paths kernel (src/kernels/graph/yen-k-shortest.ts on the graph
// engine, not a copy), fastest first. Each route is priced as OpenTTD pays: the delivery earns on
// the Manhattan distance from the source to the final sink and the total transit time across all
// legs (feeder shares are not income); each leg carries its own costs, track or road, terminals,
// the vehicles to carry the volume and their running costs. The best route by ROI is kept per
// demand, and the portfolio within the budget is chosen by the knapsack-dp kernel's own table.
import { build } from '../../engines/graph/graph';
import { trace } from '../../engines/graph/trace';
import { kernel as yen, type KspResult } from '../../kernels/graph/yen-k-shortest';
import { trace as gridTrace } from '../../engines/grid/trace';
import { kernel as knapsack, type KnapsackResult } from '../../kernels/grid/knapsack-dp';

export interface Place { id: string; x: number; y: number }
export interface Demand {
  id: string; from: string; to: string; cargo: string;
  /** Units a month to carry (both directions together when two_way). */
  volume: number;
  /** The cargo's current payment rate and transit periods (CargoSpec). */
  payment: number; td1: number; td2: number;
  two_way?: boolean;
  production_cost?: number;
}
export interface Vehicle { name: string; price: number; running_per_year: number; capacity: number; speed_kmh: number }
export interface Mode {
  mode: string;
  build_per_tile: number;
  /** Stations (and a depot) at one end of a leg. */
  terminal: number;
  /** The vehicle this mode runs, or one per cargo (a mode without one for a demand's cargo cannot carry it). */
  vehicle?: Vehicle;
  vehicles?: Record<string, Vehicle>;
  overhead_periods: number;
  min_leg?: number; max_leg?: number;
  length_factor?: number;
}
export interface Params { payback_months: number; load_factor: number; transfer_periods: number; transfer_cost_per_unit: number; max_legs: 1 | 2; k: number; budget?: number }
export const DEFAULT_PARAMS: Params = { payback_months: 24, load_factor: 0.8, transfer_periods: 2, transfer_cost_per_unit: 0, max_legs: 2, k: 32 };

export interface Leg { from: string; to: string; mode: string; tiles: number; periods: number; vehicles: { name: string; count: number }; build: number; vehicle_cost: number; running_per_month: number; prebuilt: boolean }
export interface Option {
  demand: string; legs: Leg[]; transfers: number;
  /** Units a month the chosen fleet carries: the volume, or less where one more vehicle would not pay for itself. */
  carried: number;
  distance: number; transit_periods: number; income_per_unit: number;
  monthly_income: number; monthly_profit: number; investment: number; score: number; roi: number;
}

/**
 * OpenTTD's GetTransportedGoodsIncome (src/economy.cpp) for one unit, transit in periods: the time
 * factor is 255 while the cargo is fast, falls by 1 a period past td1 and by 2 past td1 + td2, and
 * once it would drop below 31 decays asymptotically, 2·31·16·16 / (over_max + 32) in sixteenths,
 * never below 1/16. Continuous in the transit, as the planner prices a route's expected time.
 */
export function incomePerUnit(distance: number, periods: number, payment: number, td1: number, td2: number): number {
  const MIN = 31; const MAX = 255; const FRAC = 16;
  const over1 = Math.max(periods - td1, 0);
  const over2 = Math.max(over1 - td2, 0);
  const overMax = MIN - MAX + (td2 > MAX - MIN ? periods - td1 : 2 * (periods - td1) - td2);
  if (overMax > 0) {
    const tf16 = Math.max((2 * MIN * FRAC * FRAC) / (overMax + 2 * FRAC), 1);
    return (distance * tf16 * payment) / 2 ** 25;
  }
  return (distance * Math.max(MAX - over1 - over2, MIN) * payment) / 2 ** 21;
}

/** The time factor alone (1 = 1/255 of the full rate is not the unit: 255 is full), for tests and readouts. */
export const timeFactor = (periods: number, td1: number, td2: number) => incomePerUnit(2 ** 21, periods, 1, td1, td2);

const manhattan = (a: Place, b: Place) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The vehicle a mode runs for a cargo, if any. */
export const vehicleOf = (m: Mode, cargo: string): Vehicle | undefined => m.vehicles?.[cargo] ?? m.vehicle;

/** A leg's transit periods: tiles / (km/h × 0.0903) + the mode's overhead. */
export const legPeriods = (tiles: number, v: Vehicle, m: Mode) => tiles / (v.speed_kmh * 0.0903) + m.overhead_periods;

/** Units a month one vehicle moves on a leg of `periods` one way (two-way: a load each way). */
export const perVehicle = (v: Vehicle, periods: number, twoWay: boolean, load: number) => (v.capacity * load * 12) / (twoWay ? periods : 2 * periods);

/**
 * Every route of one demand, priced. Routes come from Yen's kernel on the multimodal graph
 * (fastest first, up to k), so a 2-leg route through a hub with a change of mode is one path.
 */
export function routes(d: Demand, places: Map<string, Place>, modes: Mode[], hubs: string[], prebuilt: Set<string>, p: Params): Option[] | string {
  const src = places.get(d.from); const dst = places.get(d.to);
  if (!src || !dst) return `demand ${d.id}: ${!src ? d.from : d.to} is not a place`;
  const stops = [d.from, ...(p.max_legs >= 2 ? hubs.filter((h) => h !== d.from && h !== d.to && places.has(h)) : []), d.to];
  // vertices: S, T, and (stop, mode) for every stop and mode
  const vid = (si: number, mi: number) => 2 + si * modes.length + mi;
  const n = 2 + stops.length * modes.length;
  const edges: [number, number, number][] = [];
  const meta: ({ kind: 'leg'; a: number; b: number; m: number; tiles: number } | { kind: 'other' })[] = [];
  const add = (u: number, v: number, w: number, m: (typeof meta)[number]) => { edges.push([u, v, w]); meta.push(m); };
  for (let mi = 0; mi < modes.length; mi++) {
    add(0, vid(0, mi), 0, { kind: 'other' });
    add(vid(stops.length - 1, mi), 1, 0, { kind: 'other' });
  }
  const lastStop = stops.length - 1;
  for (let a = 0; a < stops.length; a++) for (let b = 1; b < stops.length; b++) {
    if (a === b || a === lastStop || (a !== 0 && b !== lastStop) || (a === 0 && b !== lastStop && b === 0)) continue;
    if (a !== 0 && b === 0) continue;
    for (const [mi, m] of modes.entries()) {
      const v = vehicleOf(m, d.cargo);
      if (!v) continue;
      const tiles = manhattan(places.get(stops[a])!, places.get(stops[b])!) * (m.length_factor ?? 1);
      if (tiles <= 0 || (m.min_leg !== undefined && tiles < m.min_leg) || (m.max_leg !== undefined && tiles > m.max_leg)) continue;
      add(vid(a, mi), vid(b, mi), legPeriods(tiles, v, m), { kind: 'leg', a, b, m: mi, tiles });
    }
  }
  // a change of mode at a hub costs the transfer's waiting time
  for (let h = 1; h < lastStop; h++) for (let m1 = 0; m1 < modes.length; m1++) for (let m2 = 0; m2 < modes.length; m2++) {
    if (m1 !== m2) add(vid(h, m1), vid(h, m2), p.transfer_periods, { kind: 'other' });
  }
  if (!meta.some((x) => x.kind === 'leg')) return [];
  const g = build('digraph', Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, () => 0), edges, true);
  const t = trace(yen, g, { s: 0, t: 1, p: { k: p.k } }, 1, Infinity, false);
  const found = (t.result as KspResult | undefined)?.paths ?? [];
  const out: Option[] = [];
  for (const path of found) {
    const legEdges = path.edges.map((e) => meta[e]).filter((x): x is Extract<(typeof meta)[number], { kind: 'leg' }> => x.kind === 'leg');
    if (!legEdges.length || legEdges.length > p.max_legs) continue;
    const geo = legEdges.map((le) => {
      const m = modes[le.m]; const v = vehicleOf(m, d.cargo)!;
      const periods = legPeriods(le.tiles, v, m);
      const from = stops[le.a]; const to = stops[le.b];
      const pre = prebuilt.has(`${from}|${to}|${m.mode}`) || prebuilt.has(`${to}|${from}|${m.mode}`);
      return { m, v, periods, from, to, tiles: le.tiles, pre, per: perVehicle(v, periods, Boolean(d.two_way), p.load_factor), build: pre ? 0 : le.tiles * m.build_per_tile + 2 * m.terminal };
    });
    const transfers = geo.length - 1;
    const transit = geo.reduce((s, l) => s + l.periods, 0) + transfers * p.transfer_periods;
    const distance = manhattan(src, dst);
    const ipu = incomePerUnit(distance, transit, d.payment, d.td1, d.td2);
    // the fleet: carry the volume, or less where one more vehicle on some leg costs more than the
    // cargo it adds earns within the payback; the score can only change where a leg needs one
    // more vehicle, so those breakpoints (and the whole volume) are every candidate there is
    const candidates = new Set<number>([d.volume]);
    for (const l of geo) for (let k = 1; k * l.per < d.volume; k++) candidates.add(k * l.per);
    let best: Option | null = null;
    for (const carried of candidates) {
      const counts = geo.map((l) => Math.max(1, Math.ceil(carried / l.per - 1e-9)));
      const legs: Leg[] = geo.map((l, j) => ({
        from: l.from, to: l.to, mode: l.m.mode, tiles: l.tiles, periods: l.periods, vehicles: { name: l.v.name, count: counts[j] },
        build: l.build, vehicle_cost: counts[j] * l.v.price, running_per_month: (counts[j] * l.v.running_per_year) / 12, prebuilt: l.pre,
      }));
      const monthlyIncome = carried * ipu;
      const monthlyProfit = monthlyIncome - legs.reduce((s, l) => s + l.running_per_month, 0)
        - carried * (d.production_cost ?? 0) - carried * transfers * p.transfer_cost_per_unit;
      const investment = legs.reduce((s, l) => s + l.build + l.vehicle_cost, 0);
      const score = monthlyProfit * p.payback_months - investment;
      if (best && score <= best.score) continue;
      best = {
        demand: d.id, legs, transfers, carried, distance, transit_periods: transit, income_per_unit: ipu,
        monthly_income: monthlyIncome, monthly_profit: monthlyProfit, investment, score,
        roi: investment > 0 ? (12 * monthlyProfit) / investment : monthlyProfit > 0 ? Infinity : 0,
      };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.roi - a.roi);
}

export interface Plan {
  options: Option[][];
  chosen: { demand: string; option: Option }[];
  best_total: number;
  why: { demand: string; mode: string; roi: number; runner_up?: { mode: string; roi: number } }[];
  routes_considered: number;
}

/** The whole decision: routes per demand, the best by ROI, and the budgeted portfolio. */
export function invest(places: Place[], demands: Demand[], modes: Mode[], hubs: string[], prebuilt: { from: string; to: string; mode: string }[], p: Params): Plan | string {
  const byId = new Map(places.map((q) => [q.id, q]));
  const pre = new Set(prebuilt.map((b) => `${b.from}|${b.to}|${b.mode}`));
  const options: Option[][] = [];
  let considered = 0;
  for (const d of demands) {
    const r = routes(d, byId, modes, hubs, pre, p);
    if (typeof r === 'string') return r;
    considered += r.length;
    options.push(r);
  }
  // the best route of each demand that pays at all enters the knapsack: weight its investment in
  // thousands, value its score; with no budget every paying best route is taken
  const best = options.map((o) => o.find((x) => x.score > 0));
  const items = best.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
  let picked: number[] = items;
  if (p.budget !== undefined && items.length) {
    // the knapsack-dp kernel's own run on the grid engine: weights are investments in units of at
    // least 1000, coarse enough for its table to stay within the cells it accepts
    const unit = Math.max(1000, Math.ceil((p.budget * (items.length + 1)) / 200_000));
    const weights = items.map((i) => Math.max(1, Math.ceil(best[i]!.investment / unit)));
    // the grid engine's cells are 32-bit integers: scores in whole money units, scaled down only
    // when the largest would not fit
    const valueUnit = Math.max(1, Math.ceil(Math.max(...items.map((i) => best[i]!.score)) / 1e9));
    const values = items.map((i) => Math.round(best[i]!.score / valueUnit));
    const inst = knapsack.fromData!({ weights, values, capacity: Math.floor(p.budget / unit) });
    if (typeof inst === 'string') return `portfolio: ${inst}`;
    const r = gridTrace(inst).outcome?.result as KnapsackResult | undefined;
    picked = (r?.items ?? []).map((j) => items[j]);
  }
  const chosen = picked.map((i) => ({ demand: demands[i].id, option: best[i]! }));
  const why = options.map((o, i) => {
    const first = o[0];
    if (!first) return { demand: demands[i].id, mode: 'none', roi: 0 };
    const label = (x: Option) => x.legs.map((l) => l.mode).join('+');
    const other = o.find((x) => label(x) !== label(first));
    return { demand: demands[i].id, mode: label(first), roi: first.roi, ...(other ? { runner_up: { mode: label(other), roi: other.roi } } : {}) };
  });
  return { options, chosen, best_total: chosen.reduce((s, c) => s + c.option.score, 0), why, routes_considered: considered };
}
