// SI constants (CODATA 2018 exact values where defined) and the conversions the two-slit pages
// show their controls in.

/** Planck's constant h (J s), exact. */
export const PLANCK = 6.62607015e-34;
/** ħ = h/2π (J s). */
export const HBAR = PLANCK / (2 * Math.PI);
/** Electron mass (kg). */
export const ELECTRON_MASS = 9.1093837015e-31;
/** One electronvolt (J), exact. */
export const EV = 1.602176634e-19;

/** Non-relativistic momentum of an electron of kinetic energy E (eV): √(2 mₑ E) (kg m/s). */
export const electronMomentum = (eV: number): number => Math.sqrt(2 * ELECTRON_MASS * eV * EV);

/** De Broglie wavelength h/p (m). */
export const deBroglie = (momentum: number): number => PLANCK / momentum;

/** A length in the unit that reads best (nm, µm, mm, m), three significant figures. */
export function length(m: number): string {
  const a = Math.abs(m);
  if (a === 0) return '0 m';
  if (a < 1e-9 * 0.1 || a >= 1e3) return `${m.toExponential(2)} m`;
  if (a < 1e-6) return `${(m * 1e9).toPrecision(3)} nm`;
  if (a < 1e-3) return `${(m * 1e6).toPrecision(3)} µm`;
  if (a < 1) return `${(m * 1e3).toPrecision(3)} mm`;
  return `${m.toPrecision(3)} m`;
}
