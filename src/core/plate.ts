// The plate contract: every visualisation is a Plate, and only the stage turns a Plate into a
// running p5 instance (rule project.viz-component-layer). A plate never creates its own canvas,
// never sizes itself and never picks its own background: it receives all of that in its context.
import type p5 from 'p5';
import type { Palette, RGB } from './palette';

export type Category = 'algorithms' | 'physics' | 'mathematics';
export type Mode = '2d' | 'webgl';
export type Theme = 'dark' | 'light';

interface ParamBase {
  key: string;
  label: string;
  /** Changing this parameter rebuilds the simulation instead of steering the running one. */
  rebuild?: boolean;
  hint?: string;
}

export interface RangeParam extends ParamBase {
  kind: 'range';
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface SelectParam extends ParamBase {
  kind: 'select';
  options: { value: string; label: string }[];
  value: string;
}

export interface ToggleParam extends ParamBase {
  kind: 'toggle';
  value: boolean;
}

export type ParamDef = RangeParam | SelectParam | ToggleParam;
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

/** One measured readout of the running simulation. Never a constant, never an estimate. */
export interface Stat {
  label: string;
  value: string;
}

export interface PlateContext {
  readonly width: number;
  readonly height: number;
  /** Live parameters: read them each frame, the controls write them. */
  readonly params: Params;
  readonly seed: number;
  /** Seeded uniform [0, 1); the only randomness a plate may use. */
  readonly rnd: () => number;
  readonly theme: Theme;
  readonly bg: RGB;
  readonly fg: RGB;
  /** The palette the `palette` parameter names, or the plate's default. */
  palette(): Palette;
  /** Publish readouts; the stage throttles them, so calling every frame is fine. */
  stats(rows: Stat[]): void;
  /** True while the stage renders a gallery thumbnail rather than the live plate. */
  readonly thumbnail: boolean;
}

/** What a plate hands the stage: one frame of work and optional pointer handlers. */
export interface Sim {
  setup(): void;
  /** Advance the simulation and render one frame. Must not rely on p.frameCount. */
  draw(): void;
  pressed?(x: number, y: number): void;
  dragged?(x: number, y: number): void;
}

export interface Plate {
  id: string;
  /** Plate number as printed, e.g. "01". Assigned by the registry, not by hand. */
  no?: string;
  title: string;
  category: Category;
  mode: Mode;
  summary: string;
  /** Short paragraphs: what is drawn, how to read it, what to try. */
  notes: string[];
  /** Asymptotic cost or the integrator used, when it is a fact about the code. */
  complexity: string;
  tags: string[];
  /** Width / height of the canvas. */
  aspect: number;
  params: ParamDef[];
  /** Frames rendered for the gallery thumbnail. */
  thumbnailFrames?: number;
  /** Whether a pointer interacts with the canvas (shown in the plate's notes). */
  interaction?: string;
  create(p: p5, ctx: PlateContext): Sim;
}

export function defaults(plate: Plate): Params {
  const out: Params = {};
  for (const d of plate.params) out[d.key] = d.value;
  return out;
}

export function num(params: Params, key: string): number {
  return Number(params[key]);
}

export function str(params: Params, key: string): string {
  return String(params[key]);
}

export function bool(params: Params, key: string): boolean {
  return params[key] === true;
}
