// Controls the bespoke sorting plates share: how many of the kernel's steps a frame runs. A
// select of powers of four rather than a slider, so that one step at a time and sixteen thousand
// per frame are both one click away; every option is a heavy corner of the budget gate.
import type { Params, SelectParam } from '../../../core/plate';

export const SPEEDS = [1, 4, 16, 64, 256, 1024, 4096, 16384] as const;

export function speedParam(value: (typeof SPEEDS)[number] = 16): SelectParam {
  return {
    kind: 'select', key: 'speed', label: 'Kernel steps per frame', value: String(value),
    options: SPEEDS.map((s) => ({ value: String(s), label: s.toLocaleString('en-US') })),
  };
}

/** The steps per frame the speed select names (16 when it names nothing valid). */
export function speedOf(params: Params): number {
  const s = Number(params.speed);
  return SPEEDS.includes(s as (typeof SPEEDS)[number]) ? s : 16;
}
