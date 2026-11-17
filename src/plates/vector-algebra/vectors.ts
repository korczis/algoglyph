// Vectors in three dimensions and what a change of axes does to them: the components change, the
// dot product does not, and the cross product turns with the axes only while they keep their
// handedness. A mirrored frame turns it the other way: it is an axial vector.

export type V3 = [number, number, number];
/** A 3 × 3 matrix by rows. */
export type M3 = [V3, V3, V3];

export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The cross product by components: (a_y b_z − a_z b_y, a_z b_x − a_x b_z, a_x b_y − a_y b_x). */
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const norm = (a: V3): number => Math.sqrt(dot(a, a));

export const apply = (m: M3, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/**
 * The matrix that gives a vector's components on new axes, the old axes turned by yaw ψ about z,
 * then pitch θ about the new y, then roll φ about the newest x (angles in degrees); with `mirror`
 * the new x axis is then reversed, a left-handed frame. Its rows are the new axes in old components.
 */
export function frame(yaw: number, pitch: number, roll: number, mirror: boolean): M3 {
  const r = Math.PI / 180;
  const [cy, sy] = [Math.cos(yaw * r), Math.sin(yaw * r)];
  const [cp, sp] = [Math.cos(pitch * r), Math.sin(pitch * r)];
  const [cr, sr] = [Math.cos(roll * r), Math.sin(roll * r)];
  // the new axes, as columns of Rz(ψ)Ry(θ)Rx(φ), written out
  const x: V3 = [cy * cp, sy * cp, -sp];
  const y: V3 = [cy * sp * sr - sy * cr, sy * sp * sr + cy * cr, cp * sr];
  const z: V3 = [cy * sp * cr + sy * sr, sy * sp * cr - cy * sr, cp * cr];
  return [mirror ? scale(x, -1) : x, y, z];
}

/** The determinant by cofactors along the first row: +1 for a rotation, −1 with a mirror. */
export const det = (m: M3): number => dot(m[0], cross(m[1], m[2]));

/** Everything the plate reads, for vectors a, b and a frame. */
export interface Reading {
  a: V3; b: V3; ab: V3;
  /** The components on the new axes, and the cross product taken there. */
  a2: V3; b2: V3; ab2: V3;
  /** The old cross product's components on the new axes. */
  turned: V3;
  det: number;
}

export function read(a: V3, b: V3, m: M3): Reading {
  const a2 = apply(m, a); const b2 = apply(m, b);
  const ab = cross(a, b);
  return { a, b, ab, a2, b2, ab2: cross(a2, b2), turned: apply(m, ab), det: det(m) };
}
