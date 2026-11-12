// Great-circle helpers on a sphere of radius R (kilometres); angles in degrees.
export const EARTH_KM = 6371.0088; // the IUGG mean radius

const rad = (d: number) => (d * Math.PI) / 180;

/** Haversine great-circle distance. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number, R = EARTH_KM): number {
  const dp = rad(lat2 - lat1);
  const dl = rad(lon2 - lon1);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from point 1 to point 2, radians clockwise from north. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = rad(lat1); const p2 = rad(lat2); const dl = rad(lon2 - lon1);
  return Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
}
