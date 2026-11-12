// The plate contract: every visualisation is a Plate, and only the stage turns a Plate into a
// running p5 instance (rule project.viz-component-layer). A plate never creates its own canvas,
// never sizes itself and never picks its own background: it receives all of that in its context.
import type p5 from 'p5';
import type { Palette, RGB } from './palette';

export type Mode = '2d' | 'webgl';
export type Theme = 'dark' | 'light';

interface ParamBase {
  key: string;
  label: string;
  /** Changing this parameter rebuilds the simulation instead of steering the running one. */
  rebuild?: boolean;
  /**
   * Changes how the picture looks, never how much work a frame does (a palette). The main-thread
   * budget gate measures every other control's corners and skips these.
   */
  cosmetic?: boolean;
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

/** A declarative chart of measured values (rendered with ECharts, one y-axis, ADR 0004). */
export interface Chart {
  title: string;
  x: { label: string; log?: boolean };
  y: { label: string; log?: boolean };
  series: { name: string; points: [number, number][] }[];
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
  /** Publish a chart of measured values; throttled like stats, ignored in thumbnails. */
  chart(c: Chart): void;
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
  /** Return to the starting view without rebuilding (e.g. undo zooms); the stage offers it. */
  reset?(): void;
}

/** What a plate's code provides: behaviour only. Everything a person reads about the plate
 * (title, summary, notes, tags, classification) is its catalogue entry (ADR 0004). */
export interface PlateCode {
  /** Equals the catalogue entry's id, and the directory or kernel file it lives in. */
  id: string;
  mode: Mode;
  /** Width / height of the canvas. */
  aspect: number;
  params: ParamDef[];
  /** Frames rendered for the gallery thumbnail. */
  thumbnailFrames?: number;
  create(p: p5, ctx: PlateContext): Sim;
}

/** What the stage reads of a plate's catalogue entry. */
export interface PlateInfo {
  title: string;
  summary: string;
  no: string;
}

/** A plate as the site runs it: its code joined with its catalogue entry. */
export type Plate = PlateCode & PlateInfo;

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
