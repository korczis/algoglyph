// Work bounds for plates whose cost grows with the canvas or with the steps asked per frame.
// One source for the arithmetic, so every plate bounds its work the same way and the readout can
// say what was actually done (ADR 0004, rule project.viz-component-layer; proven per plate by
// test/budget.test.ts at every width and every heavy corner).

/**
 * The steps a frame may take: as many as asked, but no more than the budget allows at the given
 * cost per step, and never fewer than one (a plate always moves).
 */
export function stepsWithin(asked: number, costPerStep: number, budget: number): number {
  if (!(costPerStep > 0)) return Math.max(1, asked);
  return Math.max(1, Math.min(asked, Math.floor(budget / costPerStep)));
}

/**
 * The cell size in pixels for a grid over a width × height canvas: the size asked, raised until
 * the grid has at most `maxCells` cells. A phone keeps the fine grid; a desktop canvas gets the
 * coarsest size that fits the budget, and the plate reports it.
 */
export function cellWithin(width: number, height: number, asked: number, maxCells: number): number {
  const fit = Math.ceil(Math.sqrt((width * height) / maxCells));
  return Math.max(asked, fit);
}

/** A readout for a bounded quantity: the value used, and what was asked when it differs. */
export function bounded(used: number, asked: number, unit = ''): string {
  return used === asked ? `${used}${unit}` : `${used}${unit} (asked ${asked}${unit}, bounded by the frame budget)`;
}
