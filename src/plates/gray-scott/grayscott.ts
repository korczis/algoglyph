// The Gray-Scott reaction-diffusion model on a torus, explicit Euler with dt = 1:
//   u' = Du ∇²u − u v² + f (1 − u)
//   v' = Dv ∇²v + u v² − (f + k) v
// The Laplacian is the 3×3 stencil with weights −1 (centre), 0.2 (edges), 0.05 (corners).

export const DU = 1.0;
export const DV = 0.5;

export interface Field {
  w: number;
  h: number;
  u: Float32Array;
  v: Float32Array;
  nu: Float32Array;
  nv: Float32Array;
}

export function field(w: number, h: number): Field {
  const n = w * h;
  const f: Field = {
    w, h,
    u: new Float32Array(n).fill(1),
    v: new Float32Array(n),
    nu: new Float32Array(n),
    nv: new Float32Array(n),
  };
  return f;
}

export function seed(fl: Field, cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = ((y + fl.h) % fl.h) * fl.w + ((x + fl.w) % fl.w);
      fl.u[i] = 0.5;
      fl.v[i] = 0.25;
    }
  }
}

export function step(fl: Field, f: number, k: number): void {
  const { w, h, u, v, nu, nv } = fl;
  for (let y = 0; y < h; y++) {
    const ym = ((y - 1 + h) % h) * w;
    const y0 = y * w;
    const yp = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const i = y0 + x;
      const lu = 0.2 * (u[y0 + xm] + u[y0 + xp] + u[ym + x] + u[yp + x])
        + 0.05 * (u[ym + xm] + u[ym + xp] + u[yp + xm] + u[yp + xp]) - u[i];
      const lv = 0.2 * (v[y0 + xm] + v[y0 + xp] + v[ym + x] + v[yp + x])
        + 0.05 * (v[ym + xm] + v[ym + xp] + v[yp + xm] + v[yp + xp]) - v[i];
      const uvv = u[i] * v[i] * v[i];
      nu[i] = u[i] + DU * lu - uvv + f * (1 - u[i]);
      nv[i] = v[i] + DV * lv + uvv - (f + k) * v[i];
    }
  }
  fl.u = nu;
  fl.v = nv;
  fl.nu = u;
  fl.nv = v;
}

export const PRESETS: Record<string, { label: string; f: number; k: number }> = {
  coral: { label: 'Coral growth', f: 0.0545, k: 0.062 },
  mitosis: { label: 'Mitosis', f: 0.0367, k: 0.0649 },
  worms: { label: 'Worms and mazes', f: 0.029, k: 0.057 },
  holes: { label: 'Holes', f: 0.039, k: 0.058 },
  chaos: { label: 'Turbulence', f: 0.026, k: 0.051 },
};
