// Two projections, written from their defining formulas. Angles in degrees, lengths in metres.
//
// Web Mercator (EPSG:3857): the spherical Mercator formulas on a sphere of radius a = 6378137 m,
// applied to geodetic latitude and longitude.
//
// Křovák (EPSG:5514, S-JTSK / Krovak East North): an oblique conformal conic on the Bessel 1841
// ellipsoid. The ellipsoid is first mapped conformally onto a Gaussian sphere, the sphere is
// rotated so that the cone's axis becomes its pole, and a conformal conic with one standard
// parallel (the pseudo standard parallel, scale kP) maps it to the plane. EPSG:5514 reports
// easting = -westing and northing = -southing, so the plane is oriented north-up.

const D = Math.PI / 180;

export const WEB_MERCATOR_R = 6378137;

export function mercator(lat: number, lon: number): [number, number] {
  return [WEB_MERCATOR_R * lon * D, WEB_MERCATOR_R * Math.log(Math.tan(Math.PI / 4 + (lat * D) / 2))];
}

export function mercatorInverse(x: number, y: number): [number, number] {
  return [(2 * Math.atan(Math.exp(y / WEB_MERCATOR_R)) - Math.PI / 2) / D, x / WEB_MERCATOR_R / D];
}

/** The defining constants of EPSG:5514, on the Bessel 1841 ellipsoid (S-JTSK datum). */
export const KROVAK = {
  a: 6377397.155,
  invf: 299.1528128,
  latC: 49.5, // latitude of the projection centre, 49°30'
  lon0: 24 + 50 / 60, // longitude of origin, 24°50' east of Greenwich (42°30' east of Ferro)
  alphaC: 30 + 17 / 60 + 17.30311 / 3600, // co-latitude of the cone axis, 30°17'17.30311"
  latP: 78.5, // latitude of the pseudo standard parallel, 78°30'
  kP: 0.9999, // scale factor on the pseudo standard parallel
};

const f = 1 / KROVAK.invf;
export const BESSEL_E2 = f * (2 - f);
const e = Math.sqrt(BESSEL_E2);
const phiC = KROVAK.latC * D;
const alpha = KROVAK.alphaC * D;
const phiP = KROVAK.latP * D;
const A = (KROVAK.a * Math.sqrt(1 - BESSEL_E2)) / (1 - BESSEL_E2 * Math.sin(phiC) ** 2);
const B = Math.sqrt(1 + (BESSEL_E2 * Math.cos(phiC) ** 4) / (1 - BESSEL_E2));
const g0 = Math.asin(Math.sin(phiC) / B);
const iso = (phi: number, k: number) => ((1 + e * Math.sin(phi)) / (1 - e * Math.sin(phi))) ** k;
const t0 = (Math.tan(Math.PI / 4 + g0 / 2) * iso(phiC, (e * B) / 2)) / Math.tan(Math.PI / 4 + phiC / 2) ** B;
const n = Math.sin(phiP);
const r0 = (KROVAK.kP * A) / Math.tan(phiP);
const tP = Math.tan(Math.PI / 4 + phiP / 2);

/** Southing X and westing Y (the classical S-JTSK plane) of a Bessel latitude and longitude. */
export function krovakSW(lat: number, lon: number): [number, number] {
  const phi = lat * D;
  const U = 2 * (Math.atan((t0 * Math.tan(phi / 2 + Math.PI / 4) ** B) / iso(phi, (e * B) / 2)) - Math.PI / 4);
  const V = B * (KROVAK.lon0 * D - lon * D);
  const T = Math.asin(Math.cos(alpha) * Math.sin(U) + Math.sin(alpha) * Math.cos(U) * Math.cos(V));
  const Dd = Math.asin((Math.cos(U) * Math.sin(V)) / Math.cos(T));
  const theta = n * Dd;
  const r = (r0 * tP ** n) / Math.tan(T / 2 + Math.PI / 4) ** n;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

/** EPSG:5514 easting and northing. */
export function krovak(lat: number, lon: number): [number, number] {
  const [X, Y] = krovakSW(lat, lon);
  return [-Y, -X];
}

/** The inverse of `krovak`: Bessel latitude and longitude of an EPSG:5514 easting, northing. */
export function krovakInverse(E: number, N: number): [number, number] {
  const X = -N; const Y = -E;
  const r = Math.hypot(X, Y);
  const theta = Math.atan2(Y, X);
  const Dd = theta / n;
  const T = 2 * (Math.atan((r0 / r) ** (1 / n) * tP) - Math.PI / 4);
  const U = Math.asin(Math.cos(alpha) * Math.sin(T) - Math.sin(alpha) * Math.cos(T) * Math.cos(Dd));
  const V = Math.asin((Math.cos(T) * Math.sin(Dd)) / Math.cos(U));
  const lon = KROVAK.lon0 * D - V / B;
  let phi = U;
  for (let i = 0; i < 30; i++) {
    const next = 2 * (Math.atan(t0 ** (-1 / B) * Math.tan(U / 2 + Math.PI / 4) ** (1 / B) * iso(phi, e / 2)) - Math.PI / 4);
    if (Math.abs(next - phi) < 1e-15) { phi = next; break; }
    phi = next;
  }
  return [phi / D, lon / D];
}

/** Meridional and prime-vertical radii of curvature of an ellipsoid at latitude phi (radians). */
export function radii(a: number, e2: number, phi: number): [number, number] {
  const w = 1 - e2 * Math.sin(phi) ** 2;
  return [(a * (1 - e2)) / w ** 1.5, a / Math.sqrt(w)];
}
