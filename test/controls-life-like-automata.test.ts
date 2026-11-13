// life-like-automata (wave 6). The Start select gains the blinker, the block and the glider (the
// patterns already in life.ts), centred on the board like the R-pentomino; the default, the
// random soup, is unchanged and draws the same numbers. Each check reads the plate through the
// claims instrument (test/support/claims.ts) against Conway's rule written out below,
// independent of the plate's life.ts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type Plate, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { RUNS_KEY } from '../src/plates/_shared/settle/settle';
import { loadPlate } from '../src/registry';
import { firstNumber, read, type Claim } from './support/claims';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const ID = 'life-like-automata';

/** A claim that reads `readout` once the run has settled, judging nothing. */
const probe = (readout: string, params: Params): Claim => ({
  id: 'probe', statement: `the ${readout} readout once settled`, readout,
  expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params },
});

/** The text of `readout` once the run has settled, failing on any reason. */
async function settled(readout: string, params: Params): Promise<string> {
  const r = await read(ID, probe(readout, params));
  expect(r.reason, JSON.stringify(params)).toBeUndefined();
  return r.text as string;
}

/** The plate's readouts frame by frame at 800 px, its defaults overridden, `drop` removed. */
async function trace(over: Params, frames: number, drop: string[] = []) {
  const plate = (await loadPlate(ID)) as Plate;
  const params: Params = { ...defaults(plate), ...over };
  for (const k of drop) delete params[k];
  let rows: Stat[] = [];
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: Math.round(800 / plate.aspect), params, seed: DEFAULT_SEED,
    rnd: mulberry32(DEFAULT_SEED), theme: 'dark', bg: ground.bg, fg: ground.fg,
    thumbnail: false, palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  const out: string[] = [];
  for (let f = 0; f < frames; f++) {
    sim.draw();
    out.push(JSON.stringify(rows));
  }
  return out;
}

// the claims instrument's board: 800 × 500 px in cells of 3 px
const W = Math.floor(800 / 3);
const H = Math.floor(500 / 3);

/** Conway's Life on a W × H torus, written out cell by cell. */
class Board {
  cells = new Uint8Array(W * H);

  place(rows: string[], x0: number, y0: number): this {
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (r[x] === 'O') this.cells[(y0 + y) * W + x0 + x] = 1;
    });
    return this;
  }

  /** Placed as the plate centres a preset: its box's corner at ((W − w)/2, (H − h)/2). */
  centre(rows: string[]): this {
    const w = Math.max(...rows.map((r) => r.length));
    return this.place(rows, Math.floor((W - w) / 2), Math.floor((H - rows.length) / 2));
  }

  step(): void {
    const a = this.cells;
    const b = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx || dy) n += a[((y + dy + H) % H) * W + ((x + dx + W) % W)];
          }
        }
        b[y * W + x] = n === 3 || (a[y * W + x] && n === 2) ? 1 : 0;
      }
    }
    this.cells = b;
  }

  get population(): number {
    return this.cells.reduce((s, v) => s + v, 0);
  }

  key(): string {
    return this.cells.join('');
  }
}

const BLINKER = ['OOO'];
const BLOCK = ['OO', 'OO'];
const GLIDER = ['.O.', '..O', 'OOO'];

describe('life-like-automata: the presets blinker, block and glider', () => {
  it('are options of the Start select, whose default is still the random soup', async () => {
    const plate = (await loadPlate(ID)) as Plate;
    const d = plate.params.find((x) => x.key === 'preset');
    expect(d?.kind).toBe('select');
    if (d?.kind !== 'select') return;
    expect(d.value).toBe('soup');
    expect(d.options.map((o) => o.value)).toEqual(
      ['soup', 'rpent', 'gun', 'acorn', 'blinker', 'block', 'glider', 'empty']);
  });

  it('survive the URL', async () => {
    const plate = (await loadPlate(ID)) as Plate;
    for (const v of ['blinker', 'block', 'glider']) {
      const q = serialise(plate.params, { ...defaults(plate), preset: v }, 4242);
      expect(parse(plate.params, q).params.preset).toBe(v);
    }
  });

  it('leave the default run as it was: the seed\'s soup, stepped by Conway', async () => {
    // one draw per cell in board order, alive below the default density 0.3
    const rnd = mulberry32(DEFAULT_SEED);
    const soup = new Board();
    for (let i = 0; i < W * H; i++) soup.cells[i] = rnd() < 0.3 ? 1 : 0;
    for (let n = 1; n <= 20; n++) {
      soup.step();
      if (n === 1 || n === 20) {
        expect(firstNumber(await settled('population', { [RUNS_KEY]: n })), `generation ${n}`)
          .toBe(soup.population);
      }
    }
    expect(await trace({ preset: 'soup' }, 40)).toEqual(await trace({}, 40));
  });

  it('place the pattern at the centre: its population and its period read as counted', async () => {
    // the blinker: 3 cells, back after 2 generations, and not after 1
    const b = new Board().centre(BLINKER);
    const start = b.key();
    b.step();
    expect(b.key()).not.toBe(start);
    b.step();
    expect(b.key()).toBe(start);
    expect(firstNumber(await settled('population', { preset: 'blinker', [RUNS_KEY]: 4 }))).toBe(3);
    expect(firstNumber(await settled('period of the board', { preset: 'blinker', [RUNS_KEY]: 4 })))
      .toBe(2);

    // the block: 4 cells, the same board every generation
    const k = new Board().centre(BLOCK);
    const still = k.key();
    k.step();
    expect(k.key()).toBe(still);
    expect(firstNumber(await settled('population', { preset: 'block', [RUNS_KEY]: 2 }))).toBe(4);
    expect(firstNumber(await settled('period of the board', { preset: 'block', [RUNS_KEY]: 2 })))
      .toBe(1);

    // the glider: 5 cells in each of its phases while it crosses the empty board
    const g = new Board().centre(GLIDER);
    for (let n = 0; n < 40; n++) g.step();
    expect(g.population).toBe(5);
    expect(firstNumber(await settled('population', { preset: 'glider', [RUNS_KEY]: 40 }))).toBe(5);
    expect(await settled('period of the board', { preset: 'glider', [RUNS_KEY]: 40 }))
      .toMatch(/^not periodic/);
  });
});
