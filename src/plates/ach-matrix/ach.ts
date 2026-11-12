// Analysis of competing hypotheses as a matrix: each row is an item of evidence, each column a
// hypothesis, each cell how consistent the evidence is with the hypothesis. Hypotheses are
// ranked by how much evidence contradicts them, not by how much fits them: evidence that fits
// every hypothesis equally says nothing about which one is true.

/** −2 very inconsistent (II), −1 inconsistent (I), 0 neutral (N), 1 consistent (C), 2 very (CC). */
export type Rating = -2 | -1 | 0 | 1 | 2;

export const RATING_LABEL: Record<Rating, string> = { [-2]: 'II', [-1]: 'I', 0: 'N', 1: 'C', 2: 'CC' };

export interface Evidence {
  label: string;
  /** Credibility × relevance, a positive weight. */
  weight: number;
}

export interface Matrix {
  hypotheses: string[];
  evidence: Evidence[];
  /** cells[e][h]. */
  cells: Rating[][];
}

/** Weighted inconsistency of every hypothesis over the first `rows` items of evidence:
 * an I counts 1, an II counts 2, each times the item's weight; consistent cells count nothing. */
export function inconsistency(m: Matrix, rows = m.evidence.length): number[] {
  const score = new Array(m.hypotheses.length).fill(0);
  for (let e = 0; e < rows; e++) {
    for (let h = 0; h < m.hypotheses.length; h++) {
      const r = m.cells[e][h];
      if (r < 0) score[h] += -r * m.evidence[e].weight;
    }
  }
  return score;
}

/** Hypothesis indices from least to most contradicted; ties keep their column order. */
export function rank(scores: number[]): number[] {
  return scores.map((s, h) => [s, h] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([, h]) => h);
}

/** Where hypothesis h stands: 1 + the number of hypotheses strictly less contradicted, and
 * whether another one has exactly the same score (a shared place). */
export function standing(scores: number[], h: number): { place: number; tied: boolean } {
  let below = 0;
  let same = 0;
  scores.forEach((s, k) => {
    if (k === h) return;
    if (s < scores[h]) below++;
    else if (s === scores[h]) same++;
  });
  return { place: below + 1, tied: same > 0 };
}

const ORDINAL = ['1st', '2nd', '3rd'];

/** "1st", "tied 2nd", … */
export function placeLabel(st: { place: number; tied: boolean }): string {
  const o = ORDINAL[st.place - 1] ?? `${st.place}th`;
  return st.tied ? `tied ${o}` : o;
}

/** Weighted inconsistency of every hypothesis after each prefix of the evidence: row r holds
 * the scores over the first r items (row 0 is all zeros). */
export function inconsistencyByRow(m: Matrix, rows = m.evidence.length): number[][] {
  const out = [new Array(m.hypotheses.length).fill(0)];
  for (let e = 0; e < rows; e++) {
    const prev = out[out.length - 1];
    out.push(prev.map((s, h) => {
      const r = m.cells[e][h];
      return r < 0 ? s - r * m.evidence[e].weight : s;
    }));
  }
  return out;
}

/** How differently a row rates the hypotheses: highest minus lowest rating, 0 = not diagnostic. */
export function diagnosticity(row: readonly Rating[] | undefined): number {
  // a missing or empty row carries no evidence, so it cannot tell hypotheses apart
  if (!row || !row.length) return 0;
  return Math.max(...row) - Math.min(...row);
}

/** Cycle a cell II → I → N → C → CC → II. */
export function cycle(r: Rating): Rating {
  return (r === 2 ? -2 : r + 1) as Rating;
}

const WEIGHTS = [0.5, 1, 1.5];

/** The chance that an item fits every hypothesis alike, unless the plate's control sets it. */
export const BLAND = 0.2;

/** A synthetic case: hypothesis `truth` is true; each item of evidence is drawn so that it
 * mostly fits the truth (contradicting it with probability `noise`), rates the others at
 * random, and with probability `bland` fits everything equally. */
export function synthetic(rnd: () => number, hypotheses: number, items: number, truth: number,
  noise: number, bland = BLAND): Matrix {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const cells: Rating[][] = [];
  const evidence: Evidence[] = [];
  for (let e = 0; e < items; e++) {
    evidence.push({ label: `E${e + 1}`, weight: pick(WEIGHTS) });
    if (rnd() < bland) {
      const r = pick([0, 1] as const);
      cells.push(new Array(hypotheses).fill(r));
      continue;
    }
    const row: Rating[] = [];
    for (let h = 0; h < hypotheses; h++) {
      if (h === truth) row.push(rnd() < noise ? pick([-1, -2] as const) : pick([0, 1, 2] as const));
      else row.push(pick([-2, -1, -1, 0, 1, 1] as const));
    }
    cells.push(row);
  }
  return { hypotheses: Array.from({ length: hypotheses }, (_, h) => `H${h + 1}`), evidence, cells };
}
