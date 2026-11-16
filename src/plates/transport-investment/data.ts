// Transport investment on a caller's world (src/core/solve.ts): places, demands, the modes it can
// build with their costs and vehicles, hubs, legs already built, and the decision's parameters;
// the answer is every demand's routes ranked by ROI, the chosen portfolio, why each mode won, and
// the effective inputs echoed so the decision can be reproduced from its answer.
import { finite, integer, record, unknownKeys, type DataForm } from '../../core/solve';
import { DEFAULT_PARAMS, invest, type Demand, type Mode, type Params, type Place } from './invest';

export const LIMITS = { places: 2000, demands: 500, modes: 12, hubs: 64 };

const num = (v: unknown, lo = 0) => finite(v) && v >= lo;

export const data: DataForm = {
  input: '{places: [{id, x, y}], demands: [{id, from, to, cargo, volume, payment, td1, td2, two_way?, production_cost?}], modes: [{mode, build_per_tile, terminal, vehicle?: {name, price, running_per_year, capacity, speed_kmh}, vehicles?: {<cargo>: vehicle}, overhead_periods, min_leg?, max_leg?, length_factor?}], hubs?: [ids], prebuilt?: [{from, to, mode}], params?: {payback_months, load_factor, transfer_periods, transfer_cost_per_unit, max_legs, k, budget?}}',
  solve(raw) {
    if (!record(raw)) return 'the input must be an object {places, demands, modes, hubs?, prebuilt?, params?}';
    const extra = unknownKeys(raw, ['places', 'demands', 'modes', 'hubs', 'prebuilt', 'params']);
    if (extra) return extra;
    if (!Array.isArray(raw.places) || !raw.places.length || raw.places.length > LIMITS.places) return `places must list 1 to ${LIMITS.places} places`;
    const places: Place[] = [];
    for (const [i, q] of raw.places.entries()) {
      if (!record(q) || typeof q.id !== 'string' || !integer(q.x) || !integer(q.y)) return `places[${i}] must be {id, x, y} with integer tile coordinates`;
      places.push({ id: q.id, x: q.x, y: q.y });
    }
    const ids = new Set(places.map((q) => q.id));
    if (ids.size !== places.length) return 'places: an id appears twice';
    if (!Array.isArray(raw.demands) || !raw.demands.length || raw.demands.length > LIMITS.demands) return `demands must list 1 to ${LIMITS.demands} demands`;
    const demands: Demand[] = [];
    for (const [i, d] of raw.demands.entries()) {
      if (!record(d)) return `demands[${i}] must be an object`;
      const bad = unknownKeys(d, ['id', 'from', 'to', 'cargo', 'volume', 'payment', 'td1', 'td2', 'two_way', 'production_cost']);
      if (bad) return `demands[${i}]: ${bad}`;
      if (typeof d.id !== 'string' || typeof d.cargo !== 'string') return `demands[${i}] needs an id and a cargo`;
      if (typeof d.from !== 'string' || !ids.has(d.from) || typeof d.to !== 'string' || !ids.has(d.to) || d.from === d.to) return `demands[${i}]: from and to must be two different places`;
      for (const k of ['volume', 'payment', 'td1', 'td2'] as const) if (!num(d[k])) return `demands[${i}].${k} must be a non-negative number`;
      if (d.production_cost !== undefined && !num(d.production_cost)) return `demands[${i}].production_cost must be a non-negative number`;
      demands.push(d as unknown as Demand);
    }
    if (!Array.isArray(raw.modes) || !raw.modes.length || raw.modes.length > LIMITS.modes) return `modes must list 1 to ${LIMITS.modes} modes`;
    const modes: Mode[] = [];
    for (const [i, m] of raw.modes.entries()) {
      if (!record(m) || typeof m.mode !== 'string') return `modes[${i}] needs a mode name`;
      if (!num(m.build_per_tile) || !num(m.terminal) || !num(m.overhead_periods)) return `modes[${i}]: build_per_tile, terminal and overhead_periods must be non-negative numbers`;
      const okVehicle = (v: unknown) => record(v) && typeof v.name === 'string' && num(v.price) && num(v.running_per_year) && num(v.capacity, 1) && num(v.speed_kmh, 1);
      const shape = '{name, price, running_per_year, capacity >= 1, speed_kmh >= 1} (the effective speed; a train is its whole consist)';
      if (m.vehicle === undefined && m.vehicles === undefined) return `modes[${i}] needs a vehicle, or vehicles keyed by cargo`;
      if (m.vehicle !== undefined && !okVehicle(m.vehicle)) return `modes[${i}].vehicle must be ${shape}`;
      if (m.vehicles !== undefined) {
        if (!record(m.vehicles)) return `modes[${i}].vehicles must map each cargo to its vehicle`;
        for (const [cargo, v] of Object.entries(m.vehicles)) if (!okVehicle(v)) return `modes[${i}].vehicles.${cargo} must be ${shape}`;
      }
      modes.push(m as unknown as Mode);
    }
    const hubs = raw.hubs ?? [];
    if (!Array.isArray(hubs) || hubs.length > LIMITS.hubs || !hubs.every((h) => typeof h === 'string' && ids.has(h))) return `hubs must list up to ${LIMITS.hubs} place ids`;
    const prebuilt = raw.prebuilt ?? [];
    if (!Array.isArray(prebuilt) || !prebuilt.every((b) => record(b) && typeof b.from === 'string' && typeof b.to === 'string' && typeof b.mode === 'string')) return 'prebuilt must list {from, to, mode} legs already built';
    const params: Params = { ...DEFAULT_PARAMS };
    if (raw.params !== undefined) {
      if (!record(raw.params)) return 'params must be an object';
      const bad = unknownKeys(raw.params, [...Object.keys(DEFAULT_PARAMS), 'budget']);
      if (bad) return `params: ${bad}`;
      for (const [k, v] of Object.entries(raw.params)) {
        if (k === 'max_legs') { if (v !== 1 && v !== 2) return 'params.max_legs must be 1 or 2'; }
        else if (k === 'one_per_source') { if (typeof v !== 'boolean') return 'params.one_per_source must be a boolean'; }
        else if (k === 'k') { if (!(integer(v) && v >= 1 && v <= 256)) return 'params.k must be an integer 1..256'; }
        else if (!num(v)) return `params.${k} must be a non-negative number`;
        (params as unknown as Record<string, unknown>)[k] = v;
      }
    }
    const r = invest(places, demands, modes, hubs as string[], prebuilt as { from: string; to: string; mode: string }[], params);
    if (typeof r === 'string') return r;
    return { ...r, effective: { params, modes, hubs, prebuilt } };
  },
};
