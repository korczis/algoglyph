// The registry: the order here is the plate numbering, and the only list of plates there is.
import type { Category, Plate } from '../core/plate';
import { boidsMurmuration } from './boids/plate';
import { collatzCoral } from './collatz/plate';
import { doublePendulum } from './pendulum/plate';
import { foucaultPendulum } from './foucault/plate';
import { fourierEpicycles } from './fourier/plate';
import { grayScott } from './reaction/plate';
import { hashAvalanche } from './avalanche/plate';
import { isingModel } from './ising/plate';
import { lorenzAttractor } from './lorenz/plate';
import { mandelbrotJulia } from './fractal/plate';
import { mazeFlood } from './maze/plate';
import { nBody } from './nbody/plate';
import { pathfinding } from './pathfinding/plate';
import { rippleTank } from './ripple/plate';
import { ruleWeaver } from './automaton/plate';
import { sortTapestry } from './sorting/plate';
import { verletCloth } from './cloth/plate';
import { voronoiRelax } from './voronoi/plate';

export const PLATES: Plate[] = [
  sortTapestry,
  mazeFlood,
  pathfinding,
  boidsMurmuration,
  voronoiRelax,
  hashAvalanche,
  ruleWeaver,
  collatzCoral,
  fourierEpicycles,
  mandelbrotJulia,
  doublePendulum,
  foucaultPendulum,
  rippleTank,
  grayScott,
  isingModel,
  lorenzAttractor,
  nBody,
  verletCloth,
].map((plate, i) => ({ ...plate, no: String(i + 1).padStart(2, '0') }));

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'algorithms', label: 'Algorithms' },
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'physics', label: 'Physics' },
];

export function plate(id: string): Plate | undefined {
  return PLATES.find((p) => p.id === id);
}
