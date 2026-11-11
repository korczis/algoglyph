// One scattering run as the plate performs it: the grid, where the packet starts, when the run
// is over and how the probability is split. The plate and the tests share it, so a test of a
// slider setting measures exactly what the plate shows.
import {
  packetTransmission, potential, transmission, Wave, type Potential, type Preset,
} from './schrodinger';

export const N = 2048;
export const DX = 0.1;
export const ABSORB = 240;
/** Fine enough that the split-step error in the transmitted share stays small at every slider
 * extreme; test/quantum.test.ts measures it there. */
export const DT = 0.0125;
/** A run ends when this little probability is left on the grid... */
export const EMPTY = 1e-3;
/** ...or after this many times the packet centre's flight time across the visible grid. */
export const OVERTIME = 2.5;

/**
 * The sliders' bounds. k0 stops at 1 because slower components reflect off any absorbing edge
 * this narrow; σ stops at 8 so the packet's tail starts clear of the left edge.
 */
export const RANGES = {
  k0: { min: 1, max: 3 },
  v0: { min: 0, max: 4 },
  width: { min: 0.3, max: 8 },
  sigma: { min: 2, max: 8 },
} as const;

export const X_LEFT = (ABSORB - N / 2) * DX;
export const X_RIGHT = (N / 2 - ABSORB) * DX;

export interface RunSpec {
  preset: Preset;
  k0: number;
  v0: number;
  width: number;
  sigma: number;
}

export interface Shares {
  /** Left of the structure, plus what the left edge absorbed. */
  reflected: number;
  /** Between the structure's first and last edge (in a barrier or the double barrier's well). */
  inside: number;
  /** Right of the structure, plus what the right edge absorbed. */
  transmitted: number;
}

export class Scattering {
  readonly spec: RunSpec;
  readonly pot: Potential;
  readonly wave: Wave;
  readonly x0: number;
  /** Flight time of the packet centre from x0 to the right edge of the visible grid. */
  readonly tRun: number;
  e0 = 0;
  peak0 = 1;
  readonly planeT: number;
  readonly packetT: number;

  constructor(spec: RunSpec, dt = DT) {
    this.spec = spec;
    this.pot = potential(spec.preset, spec.v0, spec.width, DX);
    this.wave = new Wave({ n: N, dx: DX, dt, absorb: ABSORB }, this.pot);
    this.x0 = Math.round((this.lo - Math.max(4 * spec.sigma, 12)) / DX) * DX;
    this.tRun = (X_RIGHT - this.x0) / spec.k0;
    this.launch();
    this.planeT = transmission(this.e0, this.pot);
    this.packetT = packetTransmission(spec.k0, spec.sigma, this.pot);
  }

  get lo(): number {
    return this.pot.edges[0];
  }

  get hi(): number {
    return this.pot.edges[this.pot.edges.length - 1];
  }

  launch(): void {
    const w = this.wave;
    w.gaussian(this.x0, this.spec.k0, this.spec.sigma);
    this.e0 = w.measure().energy;
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, w.re[i] * w.re[i] + w.im[i] * w.im[i]);
    this.peak0 = peak;
  }

  shares(): Shares {
    const w = this.wave;
    return {
      reflected: w.probability(-Infinity, this.lo) + w.absorbedLeft,
      inside: w.probability(this.lo, this.hi),
      transmitted: w.probability(this.hi) + w.absorbedRight,
    };
  }

  /** True once the run is over. */
  done(): boolean {
    const w = this.wave;
    return w.t > OVERTIME * this.tRun || w.norm() < EMPTY;
  }

  /** Step to the end of the run, `chunk` steps at a time, and return the final split. */
  finish(chunk = 40): Shares {
    do this.wave.step(chunk); while (!this.done());
    return this.shares();
  }
}
