// The array engine's phases, lanes and rounds: free annotations a kernel records through ArrayOps
// (phase, lane, round), counted from its own events and never inferred, replayed into the phase
// name, the lane of every cell and the round number, and drawn as a lane row and a timeline of
// round boundaries. A kernel that records none draws exactly as it did before they existed.
import { describe, expect, it } from 'vitest';
import { calm, PACING } from '../src/core/pace';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine, Replay, roundsApart } from '../src/engines/array';
import { input, OP, trace, type ArrayKernel, type ArrayOps } from '../src/engines/array/trace';
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
    const m = mount(plate, { n: 64, pace: PACING.pace.max, shape: 'reversed' });
    m.sim.draw();
    expect(m.value('Layers')).toMatch(/^\d+ of 64$/);
    for (let f = 0; f < 5; f++) m.sim.draw();
    expect(m.value('Layers')).toBe('64 of 64');
    expect(m.value('Lanes')).toBe('32 of 32 seen');
    expect(m.value('Phase')).toBe('layer 64 · 64 of 64');
  });

  it('draws the lane row with numbers and stripes, and the round boundaries, through the plate', () => {
    const m = mount(plate, { n: 16, pace: PACING.pace.max });
    m.sim.draw();
    // lane numbers are drawn as text, inside push/pop so the plate's own text style survives
    expect(m.calls.some((c) => /^text\(0,/.test(c))).toBe(true);
    expect(m.calls.filter((c) => c === 'push()').length).toBe(m.calls.filter((c) => c === 'pop()').length);
  });

  it('puts rounds on a chart of their own when the work is a decade larger, else on the work chart', () => {
    // n layers of n/2 comparators: the compares outgrow the rounds by n/2
    const m = mount(plate, { n: 64, pace: PACING.pace.max });
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
    const d = mount(engine.plate({ id: 'dense', title: 'dense', group: 'g' }, dense), { n: 64, pace: PACING.pace.max });
    d.sim.draw();
    expect(new Set(d.charts.map((c) => c.title))).toEqual(new Set(['Work so far']));
    expect(d.charts[0].series.map((s) => s.name)).toContain('Rounds');
  });

  it('a lab measures each kernel\'s rounds as n grows, on a chart of their own', () => {
    const lab = engine.lab('t', [
      { info: { id: 'net', title: 'Network', group: 'g' }, kernel: network(true) },
      { info: { id: 'quicksort', title: 'Quicksort', group: 'g' }, kernel: tsKernel('quicksort') },
    ]);
    const m = mount(lab, { group: 'all', n: 32, pace: PACING.pace.max });
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
// Re-recorded for the pace (ADR 0008), checked by undoing it: at exactly the old 40 operations a
// frame (paceFor), with the Pace readout left out and the old 90-frame hold, every hash but one
// came out as recorded at 0c0759f; the one, quickselect at n = 64, loops within the 300 frames,
// and its second run is paced from its own length, as every run now is.
const BEFORE: Record<string, string> = {
  'quicksort 64': 'b2a0f28a46137bd7b705b201629134c742cfded32b4e059b3c795bf349e659da',
  'quicksort 512': '360703999b930cab98cfdd751ee007bff16b74fa089678842bfa920e7dd82dc6',
  'mergesort-bottom-up 64': 'd15986f036361be7ed1cf0c32ceb5a4b581ff2d62b9afda52e0df8c6f9c6f49f',
  'mergesort-bottom-up 512': '5939579056e8e27ccf7d8dbd4e7490265aa5e69c5dcd6120b03641c3ec8347ae',
  'heapsort 64': '6673137a34035e2d155a191ed55b93b0d71cec9fe706264bdcdf6289530bd60b',
  'heapsort 512': '0bfb558a27964d41c08548259734aed8383f6efd133e328ca4af1be2a2d46f23',
  'batcher-merge-exchange 64': 'a45b8cf9fabe7aeab7f040233c4f1f9367ed5504627f4b487559f4aba883f781',
  'batcher-merge-exchange 512': 'cba4f7fe97b3cb9518ebcf630212bc5a3f72d812660c77868439722af1a1c015',
  'counting-sort 64': '2246795533adacb402736635a77cc2dc1626c15d30455aa7597eac4188c9c885',
  'counting-sort 512': '84b498adcc949f561493e4bc5750a7747b7d3f507b5835f392c2f4e5b105c716',
  'quickselect 64': '90d3c12a8bbb15bdc55d28b257343de6cf6e7b41cf8ca6044004ed51e640ce15',
  'quickselect 512': 'fc66a9f1101a9470934886f630cd149a92d47e78371545621870662859b9aed9',
  // re-recorded twice for intended lab changes, each checked by undoing it: 370dbba stopped a lab
  // measuring past its own n slider (the scaling chart lost its n = 512 points), then the new
  // panes were shown on a frame of their own, one frame after the last trace
  lab: '9ce16119149cc0ba57232945e50ee496d1fe02da188d0ae3ae639aa0a02c76d0',
};

/**
 * The pace that replays exactly `perFrame` operations a frame on the run drawHash draws (seed
 * 4242, a random input): the old fixed speed of 40, expressed in multiples of the calm rate.
 */
function paceFor(perFrame: number, kernels: ArrayKernel[], n: number, select = false): number {
  const length = Math.max(...kernels.map((k) => trace(k, input('random', n, 4242),
    select ? Math.min(n - 1, Math.floor(0.5 * (n - 1))) : Math.floor(n / 2)).length));
  return perFrame / calm('replay', length);
}

describe('array engine: a TypeScript kernel draws exactly as before phases, lanes and rounds', () => {
  for (const key of Object.keys(BEFORE).filter((k) => k !== 'lab')) {
    const [id, n] = key.split(' ');
    it(`${id} at n = ${n}: the same draw calls, readouts and charts`, () => {
      const plate = engine.plate({ id, title: id, group: 'g' }, tsKernel(id));
      const pace = paceFor(40, [tsKernel(id)], Number(n), id === 'quickselect');
      expect(drawHash(plate, { n: Number(n), pace }, 300)).toBe(BEFORE[key]);
    });
  }
  it('a lab of them: the same draw calls, readouts and charts', () => {
    const lab = engine.lab('t', ['quicksort', 'mergesort-bottom-up', 'batcher-merge-exchange', 'counting-sort']
      .map((id, i) => ({ info: { id, title: id, group: i % 2 ? 'a' : 'b' }, kernel: tsKernel(id) })));
    const pace = paceFor(40, ['quicksort', 'mergesort-bottom-up', 'batcher-merge-exchange', 'counting-sort'].map(tsKernel), 64);
    expect(drawHash(lab, { group: 'all', n: 64, pace }, 300)).toBe(BEFORE.lab);
  });
});
