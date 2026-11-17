// The Foucault pendulum in the small-angle limit, in the frame of the rotating Earth. With x
// east, y north and Ωz = Ω sin(latitude) the vertical component of Earth's rotation:
//   x'' = −ω0² x + 2 Ωz y'
//   y'' = −ω0² y − 2 Ωz x'
// The plane of swing then turns at −Ωz: clockwise seen from above in the northern hemisphere.

export const SIDEREAL_DAY_S = 86164.0905;
export const EARTH_OMEGA = (2 * Math.PI) / SIDEREAL_DAY_S;

export type State = [number, number, number, number]; // x, y, vx, vy

function derivative([x, y, vx, vy]: State, w0: number, wz: number): State {
  return [vx, vy, -w0 * w0 * x + 2 * wz * vy, -w0 * w0 * y - 2 * wz * vx];
}

export function rk4(s: State, dt: number, w0: number, wz: number): State {
  const add = (a: State, b: State, h: number): State =>
    [a[0] + b[0] * h, a[1] + b[1] * h, a[2] + b[2] * h, a[3] + b[3] * h];
  const k1 = derivative(s, w0, wz);
  const k2 = derivative(add(s, k1, dt / 2), w0, wz);
  const k3 = derivative(add(s, k2, dt / 2), w0, wz);
  const k4 = derivative(add(s, k3, dt), w0, wz);
  return [0, 1, 2, 3].map((i) => s[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as State;
}

/**
 * The two quantities the rotating-frame equations keep: the energy ½|v|² + ½ω0²r², because the
 * Coriolis force is at right angles to the velocity and does no work, and J = (x y' − y x') +
 * Ωz r², the angular momentum in the frame that does not turn, because the equations are the
 * same after any turn about the vertical.
 */
export function invariants([x, y, vx, vy]: State, w0: number, wz: number): { E: number; J: number } {
  const r2 = x * x + y * y;
  return { E: 0.5 * (vx * vx + vy * vy) + 0.5 * w0 * w0 * r2, J: x * vy - y * vx + wz * r2 };
}

/**
 * Measures the precession of the swing plane: at every turning point (a local maximum of the
 * distance from rest) it reads the swing line's angle, unwraps it modulo π and fits the rate
 * by least squares over all turning points seen.
 */
export class PrecessionMeter {
  private prevR2 = -1;
  private prev2R2 = -1;
  private rising = false;
  /** the first and the last turning point's time, each refined by a parabola through three samples */
  private firstAt = NaN;
  private lastAt = NaN;
  private refined = 0;
  private last = NaN;
  private unwrapped = 0;
  private n = 0;
  private st = 0;
  private sa = 0;
  private stt = 0;
  private sta = 0;

  /** Feed one sample; returns true when it was a turning point. */
  sample(t: number, x: number, y: number, dt = NaN): boolean {
    const r2 = x * x + y * y;
    const peak = this.rising && r2 < this.prevR2;
    this.rising = r2 > this.prevR2;
    const [r0, r1] = [this.prev2R2, this.prevR2];
    this.prev2R2 = this.prevR2;
    this.prevR2 = r2;
    if (!peak) return false;
    if (Number.isFinite(dt) && r0 >= 0) {
      // the largest r² lay at the previous sample's time, give or take the parabola's vertex
      const den = r0 - 2 * r1 + r2;
      const at = t - dt + (den === 0 ? 0 : (dt * (r0 - r2)) / (2 * den));
      if (Number.isNaN(this.firstAt)) this.firstAt = at;
      this.lastAt = at;
      this.refined++;
    }
    const a = Math.atan2(y, x);
    if (Number.isNaN(this.last)) this.unwrapped = a;
    else {
      // a swing line has no direction: compare modulo π
      let d = a - this.last;
      d -= Math.PI * Math.round(d / Math.PI);
      this.unwrapped += d;
    }
    this.last = a;
    this.n++;
    this.st += t;
    this.sa += this.unwrapped;
    this.stt += t * t;
    this.sta += t * this.unwrapped;
    return true;
  }

  get turns(): number {
    return this.n;
  }

  /** Fitted precession rate in rad/s (NaN until three turning points). */
  rate(): number {
    if (this.n < 3) return NaN;
    const den = this.n * this.stt - this.st * this.st;
    return den === 0 ? NaN : (this.n * this.sta - this.st * this.sa) / den;
  }

  angle(): number {
    return this.unwrapped;
  }

  /** The mean time between turning points refined by `dt` samples, NaN until two of them. */
  halfSwing(): number {
    return this.refined < 2 ? NaN : (this.lastAt - this.firstAt) / (this.refined - 1);
  }
}
