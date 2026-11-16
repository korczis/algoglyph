// The plate's world, seeded: towns and industries on a map, a few hubs between them, passenger and
// coal demands, and three modes with costs in the game's base prices' proportions. The numbers are
// the plate's parameters', never a game's: a real game sends its own through the data form.
import { mulberry32 } from '../../core/random';
import type { Demand, Mode, Place } from './invest';

export const MODES: Mode[] = [
  { mode: 'bus', build_per_tile: 60, terminal: 1_000, vehicle: { name: 'bus', price: 8_000, running_per_year: 1_500, capacity: 31, speed_kmh: 56 }, overhead_periods: 1, max_leg: 120 },
  { mode: 'rail', build_per_tile: 100, terminal: 6_000, vehicle: { name: 'train, 4 wagons', price: 40_000, running_per_year: 6_000, capacity: 120, speed_kmh: 112 }, overhead_periods: 2, min_leg: 20 },
  { mode: 'air', build_per_tile: 0, terminal: 25_000, vehicle: { name: 'plane', price: 60_000, running_per_year: 12_000, capacity: 30, speed_kmh: 119 }, overhead_periods: 3, min_leg: 60 },
];

export function world(w: number, h: number, seed: number, demands: number): { places: Place[]; demands: Demand[]; hubs: string[] } {
  const rnd = mulberry32(seed);
  const places: Place[] = [];
  const n = Math.max(4, demands + 2);
  for (let i = 0; i < n; i++) places.push({ id: `p${i}`, x: Math.round(rnd() * w), y: Math.round(rnd() * h) });
  const hubs = places.slice(0, Math.max(1, Math.round(n / 4))).map((p) => p.id);
  const out: Demand[] = [];
  for (let i = 0; i < demands; i++) {
    const a = places[(i * 3 + 1) % n]; let b = places[(i * 5 + 2) % n];
    if (b.id === a.id) b = places[(i * 5 + 3) % n];
    const coal = rnd() < 0.4;
    out.push(coal
      ? { id: `d${i}`, from: a.id, to: b.id, cargo: 'coal', volume: Math.round(100 + rnd() * 300), payment: 5_916, td1: 7, td2: 255 }
      : { id: `d${i}`, from: a.id, to: b.id, cargo: 'passengers', volume: Math.round(150 + rnd() * 450), payment: 3_185, td1: 0, td2: 24, two_way: true });
  }
  return { places, demands: out, hubs };
}
