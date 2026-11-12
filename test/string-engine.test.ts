// The string engine records a kernel's trace off create() and across frames (rule
// project.viz-component-layer): create() runs none of the kernel, the board appears once the run
// is recorded, a looped plate records its next input while the finished board is held, and a
// trace recorded in steps is the trace recorded in one go.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine } from '../src/engines/string';
import { input, KINDS, type InputKind } from '../src/engines/string/inputs';
import type { ParamDef } from '../src/core/plate';
import { EventLog, STEP_EVENTS, trace, traceSteps, type StringKernel } from '../src/engines/string/trace';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

type K = StringKernel<InputKind, unknown>;
const modules = import.meta.glob<K>('../src/kernels/string/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'string' && e.status === 'live');

function context(aspect: number, params: Params, rows: { stats: Stat[] }): PlateContext {
  const ground = GROUNDS.dark;
  return {
    width: 400, height: Math.round(400 / aspect), params, seed: 4242, rnd: mulberry32(4242),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(s) { rows.stats = s; }, chart() {},
  };
}

describe('string engine: recording off create()', () => {
  for (const e of live) {
    const kernel = modules[`../src/kernels/string/${e.id}.ts`];
    it(`${e.id}: create runs none of the kernel; a loop records the next input while it holds`, () => {
      let runs = 0;
      const k: K = { ...kernel, run(ops, x, params) { runs++; return kernel.run(ops, x, params); } };
      const code = engine.plate({ id: e.id, title: e.title, group: '' }, k);
      const params: Params = Object.fromEntries(code.params.map((d) => [d.key, d.value]));
      params.speed = 2000;
      const rows = { stats: [] as Stat[] };
      const sim = code.create(p5Stub(), context(code.aspect, params, rows));
      sim.setup();
      expect(runs, 'no kernel run inside create()').toBe(0);
      const progress = () => rows.stats.find((r) => r.label === 'Progress')?.value ?? '';
      let f = 0;
      for (; f < 20000 && !progress().startsWith('100%'); f++) sim.draw();
      expect(progress(), 'the first run is replayed to its end').toMatch(/^100%/);
      expect(runs).toBe(1);
      // the next input is recorded during the hold, and replaces the board only when it is done
      for (let g = 0; g < 400 && !/^0%|^\d%/.test(progress()); g++) sim.draw();
      expect(runs, 'one run per new input').toBe(2);
      expect(progress()).not.toMatch(/^100%/);
    });
  }

  it(`every kernel pauses at least every ${STEP_EVENTS} recorded events, at its largest inputs`, () => {
    const over: string[] = [];
    for (const e of live) {
      const kernel = modules[`../src/kernels/string/${e.id}.ts`];
      const def = KINDS[kernel.input];
      const sizes = [def.size.max, ...((e.labs ?? []).length ? [Math.max(...def.scale)] : [])];
      const own: ParamDef[] = kernel.params ?? [];
      const top: Params = Object.fromEntries(own.map((d) => [d.key, d.kind === 'range' ? d.max : d.value]));
      const variants = [top, ...own.flatMap((d) => (d.kind === 'select' ? d.options.map((o) => ({ ...top, [d.key]: o.value })) : []))];
      for (const n of sizes) {
        for (const shape of def.shapes.length ? def.shapes.map((sh) => sh.value) : ['']) {
          for (const params of variants) {
            const steps = traceSteps(kernel, input(kernel.input, n, shape, 77) as never, params);
            let last = 0; let worst = 0;
            for (let r = steps.next(); ; r = steps.next()) {
              const at = r.done ? r.value.events.length : r.value;
              worst = Math.max(worst, at - last);
              last = at;
              if (r.done) break;
            }
            if (worst > STEP_EVENTS) over.push(`${e.id} n=${n} ${shape} ${JSON.stringify(params)}: ${worst} events`);
          }
        }
      }
    }
    expect(over).toEqual([]);
  }, 300000);

  it('the event log keeps every field through its growth, and reads without allocating', () => {
    const log = new EventLog();
    const n = 5000;
    for (let k = 0; k < n; k++) log.push(k % 17, k - 1, 3 * k, -k | 0, k / 7, k % 5 ? undefined : `s${k}`, k % 9 ? undefined : [`a${k}`, 'b']);
    expect(log.length).toBe(n);
    const cur = { o: 0, p: 0, i: 0, j: 0, v: 0 };
    for (const k of [0, 1, 1023, 1024, 2047, 4096, n - 1]) {
      const e = log.get(k, cur);
      expect(e).toBe(cur);
      expect([e.o, e.p, e.i, e.j, e.v]).toEqual([k % 17, k - 1, 3 * k, -k | 0, k / 7]);
      expect(e.s).toBe(k % 5 ? undefined : `s${k}`);
      expect(e.ss).toEqual(k % 9 ? undefined : [`a${k}`, 'b']);
    }
    expect(log.toArray(10, 12)).toEqual([{ o: 10, p: 9, i: 30, j: -10, v: 10 / 7, s: 's10' }, { o: 11, p: 10, i: 33, j: -11, v: 11 / 7 }]);
  });

  it('a trace recorded in steps equals the trace recorded at once, for every kernel that yields', () => {
    for (const e of live) {
      const kernel = modules[`../src/kernels/string/${e.id}.ts`];
      const def = KINDS[kernel.input];
      const x = input(kernel.input, def.size.max, def.shapes[0]?.value ?? '', 31);
      const steps = traceSteps(kernel, x as never, {});
      let pauses = 0;
      let r = steps.next();
      for (; !r.done; r = steps.next()) pauses++;
      const whole = trace(kernel, x as never, {});
      expect(r.value.events.toArray(), e.id).toEqual(whole.events.toArray());
      expect(r.value.counts, e.id).toEqual(whole.counts);
      if (['fellegi-sunter', 'minhash-lsh', 'levenshtein-matrix', 'brute-force-search'].includes(e.id)) {
        expect(pauses, `${e.id} pauses inside its run`).toBeGreaterThan(1);
      }
    }
  });
});
