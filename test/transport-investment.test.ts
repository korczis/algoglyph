// transport-investment (src/plates/transport-investment) against references outside its code: the
// game's income formula at the values openttd-80's planner pins (tools/research/mcp-rhai plan.rs);
// the routes Yen's kernel enumerates on the multimodal graph against every route listed by hand;
// the mode that wins by ROI on hand-built worlds; and the budgeted portfolio against every subset.
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, incomePerUnit, invest, routes, timeFactor, type Demand, type Mode, type Place } from '../src/plates/transport-investment/invest';
import { data } from '../src/plates/transport-investment/data';
import { MODES, world } from '../src/plates/transport-investment/demo';

const bus: Mode = { mode: 'bus', build_per_tile: 60, terminal: 1_000, vehicle: { name: 'bus', price: 8_000, running_per_year: 1_500, capacity: 31, speed_kmh: 56 }, overhead_periods: 1, max_leg: 120 };
const rail: Mode = { mode: 'rail', build_per_tile: 100, terminal: 6_000, vehicle: { name: 'train', price: 40_000, running_per_year: 6_000, capacity: 120, speed_kmh: 112 }, overhead_periods: 2, min_leg: 20 };
const air: Mode = { mode: 'air', build_per_tile: 0, terminal: 25_000, vehicle: { name: 'plane', price: 60_000, running_per_year: 12_000, capacity: 30, speed_kmh: 476 / 4 }, overhead_periods: 3, min_leg: 60 };

describe('transport-investment: the game\'s income formula', () => {
  it('pays full rate while fast, falls by 1 and then 2 a period, and decays asymptotically past 31 (passengers: td1 0, td2 24)', () => {
    expect(timeFactor(10, 0, 24)).toBe(245);
    expect(timeFactor(30, 0, 24)).toBe(255 - 30 - 6);
    expect(timeFactor(124, 0, 24)).toBe(31);
    expect(timeFactor(124.5, 0, 24)).toBeCloseTo(30.06, 2);
    expect(timeFactor(1000, 0, 24)).toBeLessThan(3);
    expect(timeFactor(1e9, 0, 24)).toBeCloseTo(1 / 16, 9);
    // income is distance × time factor × payment >> 21
    expect(incomePerUnit(100, 10, 3_000, 0, 24)).toBeCloseTo((100 * 245 * 3_000) / 2 ** 21, 9);
  });
});

describe('transport-investment: routes on the multimodal graph', () => {
  const places: Place[] = [{ id: 'A', x: 0, y: 0 }, { id: 'H', x: 50, y: 0 }, { id: 'B', x: 100, y: 0 }];
  const byId = new Map(places.map((q) => [q.id, q]));
  const d: Demand = { id: 'd', from: 'A', to: 'B', cargo: 'passengers', volume: 400, payment: 3_185, td1: 0, td2: 24, two_way: true };

  it('Yen\'s kernel finds every route a hand count lists: direct per mode, and through the hub with or without a change of mode', () => {
    const got = routes(d, byId, [bus, rail], ['H'], new Set(), DEFAULT_PARAMS);
    if (typeof got === 'string') throw new Error(got);
    const label = (o: (typeof got)[number]) => o.legs.map((l) => `${l.from}-${l.to}:${l.mode}`).join(' ');
    // by hand: direct bus (100 ≤ 120) and rail; via H every pair of modes whose legs (50 tiles) fit
    const expected = ['A-B:bus', 'A-B:rail', 'A-H:bus H-B:bus', 'A-H:bus H-B:rail', 'A-H:rail H-B:bus', 'A-H:rail H-B:rail'];
    expect(got.map(label).sort()).toEqual(expected.sort());
    for (const o of got) expect(o.distance).toBe(100);
    // a transfer adds its waiting time to the whole chain's transit
    const via = got.find((o) => label(o) === 'A-H:rail H-B:rail')!;
    expect(via.transit_periods).toBeCloseTo(via.legs[0].periods + via.legs[1].periods + DEFAULT_PARAMS.transfer_periods, 9);
  });

  it('ranks a demand\'s routes by ROI, best first', () => {
    const got = routes(d, byId, [bus, rail], ['H'], new Set(), DEFAULT_PARAMS);
    if (typeof got === 'string') throw new Error(got);
    for (let i = 1; i < got.length; i++) expect(got[i - 1].roi).toBeGreaterThanOrEqual(got[i].roi);
  });
});

describe('transport-investment: the mode that wins is the one that pays', () => {
  const near: Place[] = [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 30, y: 0 }];
  const far: Place[] = [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 400, y: 0 }];
  const d: Demand = { id: 'd', from: 'A', to: 'B', cargo: 'passengers', volume: 300, payment: 3_185, td1: 0, td2: 24, two_way: true };

  it('picks the bus over 30 tiles and the train or plane over 400, and says by how much', () => {
    const short = invest(near, [d], [bus, rail, air], [], [], DEFAULT_PARAMS);
    const long = invest(far, [d], [bus, rail, air], [], [], DEFAULT_PARAMS);
    if (typeof short === 'string' || typeof long === 'string') throw new Error('refused');
    expect(short.why[0].mode).toBe('bus');
    expect(long.why[0].mode).not.toBe('bus');
    expect(long.why[0].runner_up!.roi).toBeLessThanOrEqual(long.why[0].roi);
  });

  it('a road already built makes the bus cheaper to start, and never less attractive', () => {
    const fresh = invest(near, [d], [bus], [], [], DEFAULT_PARAMS);
    const roads = invest(near, [d], [bus], [], [{ from: 'A', to: 'B', mode: 'bus' }], DEFAULT_PARAMS);
    if (typeof fresh === 'string' || typeof roads === 'string') throw new Error('refused');
    expect(roads.options[0][0].legs[0].build).toBe(0);
    expect(roads.options[0][0].investment).toBeLessThan(fresh.options[0][0].investment);
    expect(roads.options[0][0].roi).toBeGreaterThan(fresh.options[0][0].roi);
  });

  it('changes mode at a hub when no single mode reaches: a bus feeder into a train', () => {
    const places: Place[] = [{ id: 'A', x: 0, y: 0 }, { id: 'H', x: 15, y: 0 }, { id: 'B', x: 215, y: 0 }];
    // the bus cannot go past 120 tiles and the train needs 20, so A-B is only bus then rail through H
    const r = invest(places, [{ ...d, volume: 200 }], [bus, { ...rail, min_leg: 20 }], ['H'], [], DEFAULT_PARAMS);
    if (typeof r === 'string') throw new Error(r);
    const best = r.options[0][0];
    expect(best.legs.map((l) => l.mode)).toEqual(['bus', 'rail']);
    expect(best.transfers).toBe(1);
    expect(best.distance).toBe(215);
  });
});

describe('transport-investment: the portfolio within the budget', () => {
  it('takes the subset of best routes with the most score that fits, as a brute force over every subset does', () => {
    const places: Place[] = [{ id: 'P0', x: 0, y: 0 }, ...Array.from({ length: 6 }, (_, i) => ({ id: `Q${i}`, x: 40 + 30 * i, y: 10 * i }))];
    const demands: Demand[] = Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, from: 'P0', to: `Q${i}`, cargo: 'coal', volume: 150 + 60 * i, payment: 5_916, td1: 7, td2: 255 }));
    const free = invest(places, demands, [bus, rail], [], [], DEFAULT_PARAMS);
    if (typeof free === 'string') throw new Error(free);
    const best = free.options.map((o) => o.find((x) => x.score > 0)).filter((x) => x !== undefined);
    const budget = Math.round(best.reduce((s, o) => s + o!.investment, 0) * 0.45);
    const r = invest(places, demands, [bus, rail], [], [], { ...DEFAULT_PARAMS, budget });
    if (typeof r === 'string') throw new Error(r);
    // brute force over the same items with the same 1000-unit weights the knapsack sees
    const unit = Math.max(1000, Math.ceil((budget * (best.length + 1)) / 200_000));
    // the same integer values the kernel's table holds: whole money units of score
    let top = 0; let topScore = 0;
    for (let mask = 0; mask < 1 << best.length; mask++) {
      let w = 0; let v = 0; let sc = 0;
      best.forEach((o, i) => { if (mask & (1 << i)) { w += Math.max(1, Math.ceil(o!.investment / unit)); v += Math.round(o!.score); sc += o!.score; } });
      if (w <= Math.floor(budget / unit) && v > top) { top = v; topScore = sc; }
    }
    expect(r.chosen.reduce((s, c) => s + Math.round(c.option.score), 0)).toBe(top);
    expect(r.best_total).toBeCloseTo(topScore, 6);
    expect(r.chosen.reduce((s, c) => s + c.option.investment, 0)).toBeLessThanOrEqual(budget + unit * best.length);
  });
});

describe('transport-investment: the plate\'s world, the decision its claims read', () => {
  it('considers 148 routes, the bus best only once, and six routes in the portfolio', () => {
    const w = world(256, 160, 4242, 8);
    const r = invest(w.places, w.demands, MODES, w.hubs, [], DEFAULT_PARAMS);
    if (typeof r === 'string') throw new Error(r);
    expect(r.routes_considered).toBe(148);
    expect(r.why.filter((x) => x.mode === 'bus').length).toBe(1);
    expect(r.chosen.length).toBe(6);
    // every chosen route pays within the payback: its score is positive
    for (const c of r.chosen) expect(c.option.score).toBeGreaterThan(0);
  });
});

describe('transport-investment: the data form', () => {
  it('answers with the effective inputs echoed, and refuses a malformed world with the field named', () => {
    const world = { places: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 30, y: 0 }], demands: [{ id: 'd', from: 'A', to: 'B', cargo: 'passengers', volume: 300, payment: 3185, td1: 0, td2: 24, two_way: true }], modes: [bus, rail] };
    const r = data.solve(world);
    if (typeof r === 'string') throw new Error(r);
    expect(r).toMatchObject({ effective: { params: { payback_months: DEFAULT_PARAMS.payback_months } } });
    expect(data.solve({ ...world, places: [{ id: 'A', x: 0.5, y: 0 }] })).toMatch(/places\[0\]/);
    expect(data.solve({ ...world, demands: [{ ...world.demands[0], to: 'A' }] })).toMatch(/two different places/);
    expect(data.solve({ ...world, modes: [{ ...bus, vehicle: { ...bus.vehicle, speed_kmh: 0 } }] })).toMatch(/effective speed/);
    expect(data.solve({ ...world, params: { max_legs: 3 } })).toMatch(/max_legs/);
    expect(data.solve({ ...world, hubs: ['Z'] })).toMatch(/hubs/);
  });
});
