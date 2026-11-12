// Seeded randomness. A plate's picture is a function of its seed and parameters, so a URL with
// ?seed= reproduces it exactly.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The largest seed; seeds run 1 … SEED_MAX, the range a shared link accepts (src/core/share.ts). */
export const SEED_MAX = 0x7fffffff;

export function freshSeed(): number {
  return 1 + Math.floor(Math.random() * SEED_MAX);
}

export function shuffle<T>(items: T[], rnd: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = items[i];
    items[i] = items[j];
    items[j] = t;
  }
  return items;
}

export function gaussian(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-12);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
