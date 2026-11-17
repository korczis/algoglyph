// The scales of length and time that the constants of nature set, each computed from its formula,
// and the tabled values they are read against. SI 2019 makes h, e, c and k exact; the electron's
// mass, the fine-structure constant and G are measured (CODATA 2018).

/** The constants the scales are built from. */
export interface Constants { h: number; c: number; me: number; alpha: number; G: number }

export const CODATA: Constants = {
  h: 6.62607015e-34, // J s, exact
  c: 299792458, // m/s, exact
  me: 9.1093837015e-31, // kg
  alpha: 7.2973525693e-3,
  G: 6.6743e-11, // m³/(kg s²)
};

/** One rung of the atlas: its name, its formula as text, and its value (m or s). */
export interface Rung { id: string; name: string; formula: string; value: number; kind: 'length' | 'time' }

/** The reduced Planck constant ħ = h/2π. */
export const hbar = (k: Constants): number => k.h / (2 * Math.PI);

/** Every rung computed from the constants. */
export function rungs(k: Constants): Rung[] {
  const hb = hbar(k);
  const compton = hb / (k.me * k.c);
  const bohr = compton / k.alpha;
  const rydberg = (k.alpha * k.alpha * k.me * k.c) / (2 * k.h);
  const hartree = k.alpha * k.alpha * k.me * k.c * k.c;
  const year = 365.25 * 86400;
  return [
    { id: 'planck-length', name: 'Planck length', formula: '√(ħG/c³)', value: Math.sqrt((hb * k.G) / k.c ** 3), kind: 'length' },
    { id: 'electron-radius', name: 'classical electron radius', formula: 'α ħ/(m_e c)', value: k.alpha * compton, kind: 'length' },
    { id: 'compton', name: 'electron\'s reduced Compton wavelength', formula: 'ħ/(m_e c)', value: compton, kind: 'length' },
    { id: 'bohr', name: 'Bohr radius', formula: 'ħ/(α m_e c)', value: bohr, kind: 'length' },
    { id: 'lyman-alpha', name: 'Lyman α, infinite nuclear mass', formula: '4/(3R∞), R∞ = α² m_e c/2h', value: 4 / (3 * rydberg), kind: 'length' },
    { id: 'light-second', name: 'light-second', formula: 'c × 1 s', value: k.c, kind: 'length' },
    { id: 'light-year', name: 'light-year', formula: 'c × 365.25 × 86 400 s', value: k.c * year, kind: 'length' },
    { id: 'planck-time', name: 'Planck time', formula: '√(ħG/c⁵)', value: Math.sqrt((hb * k.G) / k.c ** 5), kind: 'time' },
    { id: 'atomic-time', name: 'atomic unit of time', formula: 'ħ/E_h, E_h = α² m_e c²', value: hb / hartree, kind: 'time' },
    { id: 'bohr-orbit', name: 'one Bohr orbit, ground state', formula: '2π a₀/(α c)', value: (2 * Math.PI * bohr) / (k.alpha * k.c), kind: 'time' },
    { id: 'light-across-bohr', name: 'light across a Bohr radius', formula: 'a₀/c', value: bohr / k.c, kind: 'time' },
    { id: 'julian-year', name: 'Julian year', formula: '365.25 × 86 400 s', value: year, kind: 'time' },
  ];
}

/** The tabled values the rungs are read against, never computed here: CODATA 2018's recommended
 * values (and their standard uncertainties, relative), the IAU's light-year. */
export const TABLED: Record<string, { value: number; relU: number }> = {
  'planck-length': { value: 1.616255e-35, relU: 1.1e-5 },
  'electron-radius': { value: 2.8179403262e-15, relU: 4.5e-10 },
  compton: { value: 3.8615926796e-13, relU: 3.0e-10 },
  bohr: { value: 5.29177210903e-11, relU: 1.5e-10 },
  'planck-time': { value: 5.391247e-44, relU: 1.1e-5 },
  'atomic-time': { value: 2.4188843265857e-17, relU: 1.9e-12 },
  'light-year': { value: 9460730472580800, relU: 0 },
  // from the tabled Rydberg constant, R∞ = 10 973 731.568 160 m⁻¹ (relative uncertainty 1.9e−12)
  'lyman-alpha': { value: 4 / (3 * 10973731.56816), relU: 1.9e-12 },
};
