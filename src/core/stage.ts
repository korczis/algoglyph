// The stage: the one place that turns a Plate into a running p5 instance. It owns canvas size,
// pixel density, the ground colours, pausing (by hand, off screen, reduced motion), stepping,
// export and the gallery thumbnails.
import p5 from './p5';
import { GROUNDS, palette as lookupPalette } from './palette';
import type { Params, Plate, PlateContext, Sim, Stat, Theme } from './plate';
import { mulberry32 } from './random';

export interface MountOptions {
  params: Params;
  seed: number;
  theme: Theme;
  paused: boolean;
  onStats: (rows: Stat[]) => void;
  onLoopChange: (running: boolean) => void;
}

const MAX_HEIGHT_FRACTION = 0.72;
const STATS_EVERY_MS = 200;

function context(plate: Plate, width: number, height: number, params: Params, seed: number,
  theme: Theme, thumbnail: boolean, onStats: (rows: Stat[]) => void): PlateContext {
  const ground = GROUNDS[theme];
  const fallback = String(plate.params.find((d) => d.key === 'palette')?.value ?? 'ember');
  let last = 0;
  return {
    width,
    height,
    params,
    seed,
    rnd: mulberry32(seed),
    theme,
    bg: ground.bg,
    fg: ground.fg,
    thumbnail,
    palette: () => lookupPalette(String(params.palette ?? fallback)),
    stats(rows: Stat[]) {
      if (thumbnail) return;
      const now = performance.now();
      if (now - last < STATS_EVERY_MS) return;
      last = now;
      onStats(rows);
    },
  };
}

function renderer(p: p5, plate: Plate) {
  return plate.mode === 'webgl' ? p.WEBGL : p.P2D;
}

export class Stage {
  private instance: p5 | null = null;
  private sim: Sim | null = null;
  private userPaused = false;
  private visible = true;
  private readonly observer: IntersectionObserver;
  private readonly resizer: ResizeObserver;
  private mountedWidth = 0;

  /** `onWidthChange` fires when the host's width moves away from the mounted canvas width. */
  constructor(private readonly host: HTMLElement, onWidthChange: () => void) {
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      this.sync();
    });
    this.observer.observe(host);
    let timer = 0;
    this.resizer = new ResizeObserver(() => {
      const w = Math.floor(this.host.clientWidth);
      if (!this.instance || !w || Math.abs(w - this.mountedWidth) < 24) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(onWidthChange, 200);
    });
    this.resizer.observe(host);
  }

  /** False while the host is hidden (zero width): mounting then would size the canvas wrong. */
  ready(): boolean {
    return this.host.clientWidth > 0;
  }

  size(plate: Plate): { width: number; height: number } {
    const width = Math.max(240, Math.floor(this.host.clientWidth));
    let height = Math.round(width / plate.aspect);
    const cap = Math.round(window.innerHeight * MAX_HEIGHT_FRACTION);
    if (height > cap) height = cap;
    return { width, height };
  }

  mount(plate: Plate, opts: MountOptions): void {
    this.unmount();
    this.userPaused = opts.paused;
    const { width, height } = this.size(plate);
    this.mountedWidth = width;
    this.host.style.height = `${height}px`;
    this.onLoopChange = opts.onLoopChange;
    this.instance = new p5((p: p5) => {
      const ctx = context(plate, width, height, opts.params, opts.seed, opts.theme, false,
        opts.onStats);
      const sim = plate.create(p, ctx);
      this.sim = sim;
      const inside = () => p.mouseX >= 0 && p.mouseY >= 0 && p.mouseX < p.width
        && p.mouseY < p.height;
      p.setup = () => {
        const c = p.createCanvas(width, height, renderer(p, plate));
        c.elt.setAttribute('role', 'img');
        c.elt.setAttribute('aria-label', `${plate.title}: ${plate.summary}`);
        p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        sim.setup();
        this.sync();
      };
      p.draw = () => sim.draw();
      p.mousePressed = () => {
        if (sim.pressed && inside()) sim.pressed(p.mouseX, p.mouseY);
      };
      p.mouseDragged = () => {
        if (sim.dragged && inside()) sim.dragged(p.mouseX, p.mouseY);
      };
    }, this.host);
  }

  private onLoopChange: (running: boolean) => void = () => {};

  private sync(): void {
    const p = this.instance;
    if (!p) return;
    const run = !this.userPaused && this.visible;
    if (run && !p.isLooping()) p.loop();
    if (!run && p.isLooping()) p.noLoop();
    this.onLoopChange(run);
  }

  setPaused(paused: boolean): void {
    this.userPaused = paused;
    this.sync();
  }

  step(): void {
    if (!this.instance || !this.sim) return;
    this.userPaused = true;
    this.sync();
    this.instance.redraw();
  }

  save(name: string): void {
    this.instance?.saveCanvas(name, 'png');
  }

  unmount(): void {
    this.instance?.remove();
    this.instance = null;
    this.sim = null;
    this.host.replaceChildren();
  }

  destroy(): void {
    this.unmount();
    this.observer.disconnect();
    this.resizer.disconnect();
  }
}

/**
 * Render one plate off screen for the gallery and resolve with a data URL. Thumbnails run one
 * at a time, so at most one extra WebGL context exists besides the live stage.
 */
export function thumbnail(plate: Plate, params: Params, seed: number, theme: Theme,
  width = 400, height = 250): Promise<string> {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
    document.body.append(host);
    const frames = plate.thumbnailFrames ?? 90;
    const chunk = 15;
    let done = 0;
    let instance: p5 | null = null;
    const finish = (fn: () => void) => {
      queueMicrotask(() => {
        instance?.remove();
        host.remove();
        fn();
      });
    };
    instance = new p5((p: p5) => {
      const ctx = context(plate, width, height, params, seed, theme, true, () => {});
      const sim = plate.create(p, ctx);
      p.setup = () => {
        p.createCanvas(width, height, renderer(p, plate));
        p.pixelDensity(1);
        sim.setup();
      };
      p.draw = () => {
        try {
          for (let k = 0; k < chunk && done < frames; k++, done++) {
            p.push();
            sim.draw();
            p.pop();
          }
          if (done >= frames) {
            p.noLoop();
            const canvas = (p.drawingContext as CanvasRenderingContext2D).canvas;
            const url = canvas.toDataURL('image/webp', 0.86);
            finish(() => resolve(url));
          }
        } catch (err) {
          p.noLoop();
          finish(() => reject(err));
        }
      };
    }, host);
  });
}
