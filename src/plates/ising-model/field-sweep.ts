// A field swept in a triangle wave, h from +h₀ down to −h₀ and back, one step of 0.01 every
// `rate` sweeps, with the energy books of each cycle kept exactly. The energy is
//   E = −Σ s_i s_j − h Σ s_i,
// and it changes in two ways only: a field step at fixed spins changes it by the work
// W = −M Δh (M = Σ s), and an accepted flip at fixed field by its ΔE, heat Q taken from the bath.
// Over a cycle E_end − E_start = W + Q holds exactly, so the loop area −∮ M dh (the work the
// field does) is the heat the bath receives, −Q, plus the cycle's change of energy, which is
// small when the cycle starts and ends in the same saturated state.
// Every quantity is an integer in hundredths of J (the field is k / 100): the books balance
// exactly, in floating point, for any lattice the plate holds.
import { energyHundredths, spinSum, sweep, type Heat, type Lattice } from './ising';

/** One completed cycle, per spin unless named otherwise. */
export interface Cycle {
  /** −∮ m dh: the work the field did on the lattice. */
  area: number;
  /** −Q: the heat the bath received. */
  dissipated: number;
  /** E_end − E_start. */
  change: number;
  /** W + Q − (E_end − E_start) in hundredths of J: zero when the books balance. */
  residual: number;
  /** m at the end of each field level, against h: the hysteresis loop. */
  loop: [number, number][];
  /** The field at which m first reached 0 or below on the way down; null if it never did. */
  coercive: number | null;
}

export class FieldSweep {
  /** The field now, in hundredths. */
  k: number;
  /** Completed cycles. */
  cycles = 0;
  last: Cycle | null = null;
  private dir = -1;
  private atLevel = 0;
  private work = 0;
  private readonly heat: Heat = { e100: 0 };
  private start: number;
  private loop: [number, number][] = [];
  private coercive: number | null = null;

  /** A sweep of amplitude k0 / 100, one field step every `rate` sweeps, starting at +k0. */
  constructor(private readonly l: Lattice, readonly k0: number, readonly rate: number) {
    if (!Number.isInteger(k0) || k0 < 1) throw new Error(`FieldSweep: amplitude ${k0} is not a whole number of hundredths`);
    if (!Number.isInteger(rate) || rate < 1) throw new Error(`FieldSweep: rate ${rate} is not a whole number of sweeps`);
    this.k = k0;
    this.start = energyHundredths(l, k0);
  }

  get field(): number { return this.k / 100; }
  /** Sweeps in one cycle: 4 k0 field steps of `rate` sweeps each. */
  get period(): number { return 4 * this.k0 * this.rate; }

  /** One Metropolis sweep at the current field, then the field step once its sweeps are done. */
  step(temperature: number, rnd: () => number, flipped?: Uint8Array): number {
    const accepted = sweep(this.l, temperature, this.field, rnd, flipped, this.heat);
    if (++this.atLevel < this.rate) return accepted;
    this.atLevel = 0;
    const n = this.l.s.length;
    const m = spinSum(this.l);
    this.loop.push([this.field, m / n]);
    if (this.dir < 0 && this.coercive === null && m <= 0) this.coercive = this.field;
    // the step: the field moves by dir hundredths at fixed spins, work −M Δh
    this.work -= m * this.dir;
    this.k += this.dir;
    if (this.k === -this.k0) this.dir = 1;
    else if (this.k === this.k0) this.close();
    return accepted;
  }

  private close(): void {
    const n = this.l.s.length;
    const end = energyHundredths(this.l, this.k);
    const scale = 100 * n;
    this.last = {
      area: this.work / scale,
      dissipated: -this.heat.e100 / scale,
      change: (end - this.start) / scale,
      residual: this.work + this.heat.e100 - (end - this.start),
      loop: this.loop,
      coercive: this.coercive,
    };
    this.cycles++;
    this.start = end;
    this.work = 0;
    this.heat.e100 = 0;
    this.loop = [];
    this.coercive = null;
    this.dir = -1;
  }
}
