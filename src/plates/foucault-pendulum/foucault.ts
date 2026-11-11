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
 * Measures the precession of the swing plane: at every turning point (a local maximum of the
 * distance from rest) it reads the swing line's angle, unwraps it modulo π and fits the rate
 * by least squares over all turning points seen.
 */
export class PrecessionMeter {
  private prevR2 = -1;
  private rising = false;
  private last = NaN;
  private unwrapped = 0;
  private n = 0;
  private st = 0;
  private sa = 0;
  private stt = 0;
  private sta = 0;

  /** Feed one sample; returns true when it was a turning point. */
  sample(t: number, x: number, y: number): boolean {
    const r2 = x * x + y * y;
    const peak = this.rising && r2 < this.prevR2;
    this.rising = r2 > this.prevR2;
    this.prevR2 = r2;
    if (!peak) return false;
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
}
