// Heat-engine cycles of one mole of an ideal gas, leg by leg, and what integrating along them gives:
// the work ∮p dV, the heat each leg takes in or gives out, and Clausius's ∮dQ/T. Every leg is a
// path s ∈ [0, 1] → (V, T) with its derivatives in closed form; the integrals are Simpson's rule.

/** The gas constant (J/(mol·K)), exact since 2019. */
export const R = 8.314462618;

export type LegKind = 'isotherm' | 'adiabat' | 'isochore' | 'isobar';

/** One leg, from (Va, Ta) to (Vb, Tb). */
export interface Leg { kind: LegKind; Va: number; Ta: number; Vb: number; Tb: number }

export type CycleId = 'carnot' | 'otto' | 'diesel' | 'stirling';

export interface CycleSpec {
  cycle: CycleId;
  /** The heat capacity ratio Cp/Cv. */
  gamma: number;
  /** The hot and the cold reservoir's temperatures (K); Otto heats to Th, Diesel ignores it. */
  Th: number; Tc: number;
  /** The volume ratio: the hot isotherm's for Carnot, the compression ratio otherwise. */
  ratio: number;
  /** Diesel's cutoff ratio, the volume after burning over the volume before. */
  cutoff: number;
}

/** The volume a cycle starts from (m³): one litre, an arbitrary scale every ratio is free of. */
export const V0 = 1e-3;

/** The legs of a cycle, its states found in closed form. */
export function legs(c: CycleSpec): Leg[] {
  const g1 = c.gamma - 1;
  switch (c.cycle) {
    case 'carnot': {
      // expand at Th by the ratio, then adiabatically down to Tc, compress at Tc, adiabat back
      const V1 = V0; const V2 = V0 * c.ratio;
      const k = (c.Th / c.Tc) ** (1 / g1);
      return [
        { kind: 'isotherm', Va: V1, Ta: c.Th, Vb: V2, Tb: c.Th },
        { kind: 'adiabat', Va: V2, Ta: c.Th, Vb: V2 * k, Tb: c.Tc },
        { kind: 'isotherm', Va: V2 * k, Ta: c.Tc, Vb: V1 * k, Tb: c.Tc },
        { kind: 'adiabat', Va: V1 * k, Ta: c.Tc, Vb: V1, Tb: c.Th },
      ];
    }
    case 'otto': {
      // compress from Tc by the ratio, heat at constant volume to Th (or a fifth above, if the
      // compression alone already passes Th), expand, cool at constant volume
      const Vmax = V0 * c.ratio; const Vmin = V0;
      const T2 = c.Tc * c.ratio ** g1;
      const T3 = Math.max(c.Th, 1.2 * T2);
      const T4 = T3 / c.ratio ** g1;
      return [
        { kind: 'adiabat', Va: Vmax, Ta: c.Tc, Vb: Vmin, Tb: T2 },
        { kind: 'isochore', Va: Vmin, Ta: T2, Vb: Vmin, Tb: T3 },
        { kind: 'adiabat', Va: Vmin, Ta: T3, Vb: Vmax, Tb: T4 },
        { kind: 'isochore', Va: Vmax, Ta: T4, Vb: Vmax, Tb: c.Tc },
      ];
    }
    case 'diesel': {
      // compress from Tc, burn at constant pressure to the cutoff volume, expand, cool at constant volume
      const Vmax = V0 * c.ratio; const Vmin = V0;
      const T2 = c.Tc * c.ratio ** g1;
      const T3 = T2 * c.cutoff;
      const T4 = T3 * (c.cutoff / c.ratio) ** g1;
      return [
        { kind: 'adiabat', Va: Vmax, Ta: c.Tc, Vb: Vmin, Tb: T2 },
        { kind: 'isobar', Va: Vmin, Ta: T2, Vb: Vmin * c.cutoff, Tb: T3 },
        { kind: 'adiabat', Va: Vmin * c.cutoff, Ta: T3, Vb: Vmax, Tb: T4 },
        { kind: 'isochore', Va: Vmax, Ta: T4, Vb: Vmax, Tb: c.Tc },
      ];
    }
    case 'stirling':
    default: {
      // expand at Th by the ratio, cool at constant volume, compress at Tc, heat at constant volume;
      // no regenerator, so the heating is paid for from the hot reservoir
      const V1 = V0; const V2 = V0 * c.ratio;
      return [
        { kind: 'isotherm', Va: V1, Ta: c.Th, Vb: V2, Tb: c.Th },
        { kind: 'isochore', Va: V2, Ta: c.Th, Vb: V2, Tb: c.Tc },
        { kind: 'isotherm', Va: V2, Ta: c.Tc, Vb: V1, Tb: c.Tc },
        { kind: 'isochore', Va: V1, Ta: c.Tc, Vb: V1, Tb: c.Th },
      ];
    }
  }
}

/** A point of a leg and its rates: V, T and dV/ds, dT/ds. */
export interface Point { V: number; T: number; dV: number; dT: number }

/** The leg's point at s ∈ [0, 1]: volume geometric along isotherms and adiabats (T ∝ V^(1−γ) on
 * the latter), temperature linear along an isochore, volume linear along an isobar (T ∝ V). */
export function at(leg: Leg, s: number, gamma: number): Point {
  switch (leg.kind) {
    case 'isotherm': {
      const l = Math.log(leg.Vb / leg.Va);
      const V = leg.Va * Math.exp(l * s);
      return { V, T: leg.Ta, dV: V * l, dT: 0 };
    }
    case 'adiabat': {
      const l = Math.log(leg.Vb / leg.Va);
      const V = leg.Va * Math.exp(l * s);
      const T = leg.Ta * Math.exp(-(gamma - 1) * l * s);
      return { V, T, dV: V * l, dT: -(gamma - 1) * l * T };
    }
    case 'isochore':
      return { V: leg.Va, T: leg.Ta + (leg.Tb - leg.Ta) * s, dV: 0, dT: leg.Tb - leg.Ta };
    case 'isobar':
    default: {
      const V = leg.Va + (leg.Vb - leg.Va) * s;
      return { V, T: (leg.Ta * V) / leg.Va, dV: leg.Vb - leg.Va, dT: (leg.Ta * (leg.Vb - leg.Va)) / leg.Va };
    }
  }
}

/** What one leg's integrals give. */
export interface LegSums { work: number; heat: number; entropy: number }

/** Simpson's rule over `panels` (even) of one leg: ∫p dV, ∫dQ = ∫(Cv dT + p dV), ∫dQ/T. */
export function integrate(leg: Leg, gamma: number, panels = 2000): LegSums {
  const cv = R / (gamma - 1);
  let work = 0; let heat = 0; let entropy = 0;
  for (let i = 0; i <= panels; i++) {
    const w = i === 0 || i === panels ? 1 : i % 2 === 1 ? 4 : 2;
    const q = at(leg, i / panels, gamma);
    const pdV = ((R * q.T) / q.V) * q.dV;
    const dQ = cv * q.dT + pdV;
    work += w * pdV; heat += w * dQ; entropy += (w * dQ) / q.T;
  }
  const h = 1 / (3 * panels);
  return { work: work * h, heat: heat * h, entropy: entropy * h };
}

/** A cycle's totals: the work, the heat taken in on the legs that take it, and ∮dQ/T. */
export interface CycleSums { work: number; heatIn: number; heatOut: number; clausius: number; perLeg: LegSums[] }

/** The totals of a cycle's legs. */
export function totals(perLeg: LegSums[]): CycleSums {
  let work = 0; let heatIn = 0; let heatOut = 0; let clausius = 0;
  for (const s of perLeg) {
    work += s.work; clausius += s.entropy;
    if (s.heat > 0) heatIn += s.heat; else heatOut -= s.heat;
  }
  return { work, heatIn, heatOut, clausius, perLeg };
}

export const run = (c: CycleSpec, panels = 2000): CycleSums => totals(legs(c).map((l) => integrate(l, c.gamma, panels)));

/** The efficiency each cycle has in closed form, from the controls alone: Carnot 1 − Tc/Th, Otto
 * 1 − r^(1−γ), Diesel 1 − (ρ^γ − 1)/(γr^(γ−1)(ρ − 1)), Stirling without a regenerator
 * R(Th − Tc)ln r/(R·Th ln r + Cv(Th − Tc)). */
export function closedEfficiency(c: CycleSpec): number {
  const g = c.gamma; const r = c.ratio;
  switch (c.cycle) {
    case 'carnot': return 1 - c.Tc / c.Th;
    case 'otto': return 1 - r ** (1 - g);
    case 'diesel': return 1 - (c.cutoff ** g - 1) / (g * r ** (g - 1) * (c.cutoff - 1));
    case 'stirling':
    default: {
      const cv = 1 / (g - 1);
      return ((c.Th - c.Tc) * Math.log(r)) / (c.Th * Math.log(r) + cv * (c.Th - c.Tc));
    }
  }
}

/** Carnot's work per mole in closed form, R(Th − Tc)ln r: the isotherms' works, the adiabats'
 * cancelling. */
export const carnotWork = (c: CycleSpec): number => R * (c.Th - c.Tc) * Math.log(c.ratio);

/** The path drawn: `per` points of every leg, with the entropy accumulated by trapezoids from the
 * first state (S is defined up to a constant). */
export function path(c: CycleSpec, per = 60): { V: number[]; p: number[]; T: number[]; S: number[] } {
  const cv = R / (c.gamma - 1);
  const out = { V: [] as number[], p: [] as number[], T: [] as number[], S: [] as number[] };
  let S = 0; let last: Point | null = null;
  for (const leg of legs(c)) {
    for (let i = 0; i <= per; i++) {
      const q = at(leg, i / per, c.gamma);
      const rate = (cv * q.dT + ((R * q.T) / q.V) * q.dV) / q.T;
      if (last && i > 0) {
        const lastRate = (cv * last.dT + ((R * last.T) / last.V) * last.dV) / last.T;
        S += ((rate + lastRate) / 2) / per;
      }
      last = q;
      out.V.push(q.V); out.p.push((R * q.T) / q.V); out.T.push(q.T); out.S.push(S);
    }
  }
  return out;
}
