// The array engine's phases, lanes and rounds: free annotations a kernel records through ArrayOps
// (phase, lane, round), counted from its own events and never inferred, replayed into the phase
// name, the lane of every cell and the round number, and drawn as a lane row and a timeline of
// round boundaries. A kernel that records none draws exactly as it did before they existed.
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine, Replay, roundsApart } from '../src/engines/array';
import { OP, trace, type ArrayKernel, type ArrayOps } from '../src/engines/array/trace';
import { drawHash, drawRecorder } from './support/draw-recorder';

const ts = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const tsKernel = (id: string) => ts[`../src/kernels/array/${id}.ts`];

/** Odd-even transposition as a network: round r compares pairs (i, i + 1) of parity r, one lane each. */
const network = (annotate: boolean): ArrayKernel => ({
  roundUnit: 'Layers',
  run(a: ArrayOps) {
    for (let r = 0; r < a.n; r++) {
      if (annotate) { a.round(); a.phase(`layer ${r + 1}`); }
      for (let i = r % 2; i + 1 < a.n; i += 2) {
        if (annotate) a.lane(i >> 1);
        a.exch(i, i + 1);
      }
    }
  },
});

function mount(plate: PlateCode, over: Params) {
  const params: Params = {};
  for (const d of plate.params) params[d.key] = d.value;
  Object.assign(params, over);
  let stats: Stat[] = [];
  const charts: Chart[] = [];
  const ctx: PlateContext = {
    width: 1440, height: 810, params, seed: 9, rnd: mulberry32(9), theme: 'dark',
    bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false,
    palette: () => lookupPalette('spectral'), stats(rows) { stats = rows; }, chart(c) { charts.push(c); },
  };
  const { p, calls } = drawRecorder();
  const sim = plate.create(p, ctx);
  sim.setup();
  return { sim, stats: () => stats, charts, calls, value: (label: string) => stats.find((s) => s.label === label)?.value };
}

describe('array engine: phases, lanes and rounds in the trace', () => {
  it('are free: the same counts and output as the kernel without them, and counted on their own', () => {
    const data = [5, 3, 8, 1, 9, 2, 7, 4, 6];
    const [plain, marked] = [trace(network(false), data), trace(network(true), data)];
    expect(marked.counts).toEqual(plain.counts);
    expect(marked.output).toEqual(plain.output);
    expect(marked.marks).toEqual({ rounds: data.length, phases: data.length, lanes: 4 });
    expect(plain.marks).toEqual({ rounds: 0, phases: 0, lanes: 0 });
    // one event each, the round carrying its own number, the phase its label's id
    const ops = Array.from({ length: marked.length }, (_, e) => marked.events[3 * e]);
    expect(ops.filter((o) => o === OP.round).length).toBe(data.length);
    expect(ops.filter((o) => o === OP.lane).length).toBe(plain.counts.compares);
    const firstRound = ops.indexOf(OP.round);
    expect(marked.events[3 * firstRound + 1]).toBe(1);
    expect(marked.labels).toEqual(data.map((_, r) => `layer ${r + 1}`));
  });

  it('interns a repeated phase name once, and refuses a lane that is no non-negative integer', () => {
    const t = trace({ run(a: ArrayOps) { a.phase('x'); a.phase('y'); a.phase('x'); } }, [1]);
    expect(t.labels).toEqual(['x', 'y']);
    expect(t.marks.phases).toBe(3);
    for (const bad of [-1, 1.5, NaN]) expect(() => trace({ run(a: ArrayOps) { a.lane(bad); } }, [1])).toThrow(RangeError);
  });

  it('stop at the event cap like every other event, uncounted past it', () => {
    const t = trace({ run(a: ArrayOps) { for (;;) a.round(); } }, [1], 0, 50);
    expect(t.truncated).toBe(true);
    expect(t.marks.rounds).toBe(50);
  });
});

describe('array engine: the replay of phases, lanes and rounds', () => {
  it('tracks the phase name, the round number and the lane of every cell it touched', () => {
    const data = [4, 3, 2, 1, 8, 7, 6, 5];
    const r = new Replay(trace(network(true), data));
    expect([r.phase, r.round, r.lane, r.lanes]).toEqual(['', 0, -1, 0]);
    expect([...r.laneOf!]).toEqual(new Array(8).fill(-1));
    // round 1, phase 'layer 1', then lane 0 compares cells 0 and 1
    r.advance(4);
    expect([r.phase, r.round, r.lane]).toEqual(['layer 1', 1, 0]);
    expect([...r.laneOf!.slice(0, 2)]).toEqual([0, 0]);
    r.advance(r.t.length);
    expect([r.phase, r.phases, r.round, r.lanes]).toEqual(['layer 8', 8, 8, 4]);
    expect(r.counts().rounds).toBe(8);
    expect(r.history.at(-1)![4]).toBe(8);
    // the last layer (odd parity) compares (1,2), (3,4), (5,6): lanes 0, 1, 2; cells 0 and 7 keep
    // the lanes of layer 7
    expect([...r.laneOf!]).toEqual([0, 0, 0, 1, 1, 2, 2, 3]);
    expect(r.roundAt.length).toBe(8);
    expect(r.roundAt.every((e) => r.t.events[3 * e] === OP.round)).toBe(true);
  });

  it('marks at most one round boundary per pixel column', () => {
    const t = trace({ run(a: ArrayOps) { for (let k = 0; k < 500; k++) { a.round(); a.get(0); } } }, [1]);
    const r = new Replay(t);
    expect(r.roundTicks(2000).length).toBe(500);
    const narrow = r.roundTicks(100);
    expect(narrow.length).toBeLessThanOrEqual(100);
    expect(new Set(narrow).size).toBe(narrow.length);
    expect(Math.max(...narrow)).toBeLessThan(100);
  });

  it('costs a kernel without annotations nothing: no lane row, no round boundaries', () => {
    const r = new Replay(trace(tsKernel('quicksort'), [3, 1, 2, 5, 4]));
    expect(r.laneOf).toBeNull();
    expect(r.roundAt).toEqual([]);
  });
});

describe('array engine: the plate of a kernel with rounds', () => {
  const plate = engine.plate({ id: 'odd-even-network', title: 'net', group: 'g' }, network(true));

  it('reads out its rounds, lanes and phase as counted, in the unit the kernel names', () => {
    const m = mount(plate, { n: 64, speed: 2000, shape: 'reversed' });
    m.sim.draw();
    expect(m.value('Layers')).toMatch(/^\d+ of 64$/);
    for (let f = 0; f < 5; f++) m.sim.draw();
    expect(m.value('Layers')).toBe('64 of 64');
    expect(m.value('Lanes')).toBe('32 of 32 seen');
    expect(m.value('Phase')).toBe('layer 64 · 64 of 64');
  });

  it('draws the lane row with numbers and stripes, and the round boundaries, through the plate', () => {
    const m = mount(plate, { n: 16, speed: 30 });
    m.sim.draw();
    // lane numbers are drawn as text, inside push/pop so the plate's own text style survives
    expect(m.calls.some((c) => /^text\(0,/.test(c))).toBe(true);
    expect(m.calls.filter((c) => c === 'push()').length).toBe(m.calls.filter((c) => c === 'pop()').length);
  });

  it('puts rounds on a chart of their own when the work is a decade larger, else on the work chart', () => {
    // n layers of n/2 comparators: the compares outgrow the rounds by n/2
    const m = mount(plate, { n: 64, speed: 2000 });
    for (let f = 0; f < 5; f++) m.sim.draw();
    expect(roundsApart(trace(network(true), Array.from({ length: 64 }, (_, i) => 64 - i)))).toBe(true);
    const titles = m.charts.map((c) => c.title);
    expect(new Set(titles)).toEqual(new Set(['Work so far', 'Layers so far']));
    const work = m.charts.filter((c) => c.title === 'Work so far').at(-1)!;
    const own = m.charts.filter((c) => c.title === 'Layers so far').at(-1)!;
    expect(work.series.map((s) => s.name)).not.toContain('Layers');
    expect(own.y.label).toBe('layers');
    expect(own.series[0].points.at(-1)![1]).toBe(64);
    // a round per comparison: one magnitude, one chart
    const dense: ArrayKernel = { run(a: ArrayOps) { for (let i = 0; i + 1 < a.n; i++) { a.round(); a.exch(i, i + 1); } } };
    const d = mount(engine.plate({ id: 'dense', title: 'dense', group: 'g' }, dense), { n: 64, speed: 2000 });
    d.sim.draw();
    expect(new Set(d.charts.map((c) => c.title))).toEqual(new Set(['Work so far']));
    expect(d.charts[0].series.map((s) => s.name)).toContain('Rounds');
  });

  it('a lab measures each kernel\'s rounds as n grows, on a chart of their own', () => {
    const lab = engine.lab('t', [
      { info: { id: 'net', title: 'Network', group: 'g' }, kernel: network(true) },
      { info: { id: 'quicksort', title: 'Quicksort', group: 'g' }, kernel: tsKernel('quicksort') },
    ]);
    const m = mount(lab, { group: 'all', n: 32, speed: 2000 });
    for (let f = 0; f < 20; f++) m.sim.draw();
    const last = m.charts.filter((c) => c.title === 'Measured rounds as n grows').at(-1)!;
    expect(last.series.map((s) => s.name)).toEqual(['Network (layers)']);
    // n layers at every n: the kernel's own count
    expect(last.series[0].points.every(([n, rounds]) => rounds === n)).toBe(true);
    expect(m.stats().find((s) => s.label === 'Network')?.value).toMatch(/ of \d+ layers/);
    expect(m.stats().find((s) => s.label === 'Quicksort')?.value).not.toMatch(/rounds|layers/);
  });
});

// Every draw call, readout and chart of these plates and of a lab of TypeScript kernels, recorded
// with test/support/draw-recorder.ts on the engine as it was before phases, lanes and rounds
// (commit 0c0759f): the feature leaves a kernel that records none exactly as it was.
const BEFORE: Record<string, string> = {
  'quicksort 64': 'ee38977c97ea9f962e5752ed0d0228f28ae970102bcaf8e30a89c8fb144744f0',
  'quicksort 512': '046d59be57f9c78d951518065a258c5a28178b2f17392715f0a0858ab9442087',
  'mergesort-bottom-up 64': '78396c3ba8194eb88e335c1c7aef08265854803086b2ad91c165b220816f0cf6',
  'mergesort-bottom-up 512': '78c2169c95265d7637cf4679ec9e924fefd4626afdeaf78dc9451a5746783f69',
  'heapsort 64': '9dcf65e80f6a2ce5e58cc71f89d5635a1c6dd47aae1bce8a746fc54ad0417bf8',
  'heapsort 512': '2de5f86e438050b7797ebb020916b207193308578146ca474860199a68bae799',
  'batcher-merge-exchange 64': '468f5f3d113287507a439eabd7b6f69178b6cf9a2f40d778e17ac59a8125e6fe',
  'batcher-merge-exchange 512': '01367fde2c0fe0beded50a14e4cd65c8b8d75b934375d764ed20d6f37a0344f2',
  'counting-sort 64': '1b96579b491fc55a8e493e5b9f4ce3e0f3271588dd57b4c65ce573eb42171bda',
  'counting-sort 512': 'dba1a1b70198034da8fa552962a1ecce1e7d6e7155a17cf940dec33435bf02c2',
  'quickselect 64': '0cb0b65d0712abd07eb7c6c309db80c6540175c9d36b2b45c910c7c1165d824b',
  'quickselect 512': 'ffc89f7e61d896966aa73203ce412de44fd8d6299a7233495edd6b6c3c48ffe7',
  // re-recorded twice for intended lab changes, each checked by undoing it: 370dbba stopped a lab
  // measuring past its own n slider (the scaling chart lost its n = 512 points), then the new
  // panes were shown on a frame of their own, one frame after the last trace
  lab: 'b405ad1829aae267026e2de7972caf304132af0b6b901952bc084ac54d199ccc',
};

describe('array engine: a TypeScript kernel draws exactly as before phases, lanes and rounds', () => {
  for (const key of Object.keys(BEFORE).filter((k) => k !== 'lab')) {
    const [id, n] = key.split(' ');
    it(`${id} at n = ${n}: the same draw calls, readouts and charts`, () => {
      const plate = engine.plate({ id, title: id, group: 'g' }, tsKernel(id));
      expect(drawHash(plate, { n: Number(n), speed: 40 }, 300)).toBe(BEFORE[key]);
    });
  }
  it('a lab of them: the same draw calls, readouts and charts', () => {
    const lab = engine.lab('t', ['quicksort', 'mergesort-bottom-up', 'batcher-merge-exchange', 'counting-sort']
      .map((id, i) => ({ info: { id, title: id, group: i % 2 ? 'a' : 'b' }, kernel: tsKernel(id) })));
    expect(drawHash(lab, { group: 'all', n: 64, speed: 40 }, 300)).toBe(BEFORE.lab);
  });
});
