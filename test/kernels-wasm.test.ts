// The Rust kernels as the browser runs them: the wasm32 module built by scripts/wasm.sh must
// reproduce the native build's fixture (crates/algoglyph-kernels/fixtures/fluids.json), the
// equivalence gate majordomus-core uses for its portable core.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fixture = JSON.parse(readFileSync('crates/algoglyph-kernels/fixtures/fluids.json', 'utf8'));
const { instance } = await WebAssembly.instantiate(readFileSync('src/wasm/algoglyph_kernels.wasm'), {});
const x = instance.exports as unknown as {
  memory: WebAssembly.Memory;
  ag_fluid_scenario_checksum(n: number, steps: number): number;
  ag_fluid_new(n: number): number;
  ag_fluid_step(h: number, dt: number, visc: number, diff: number, iters: number): void;
  ag_fluid_stats(h: number): number;
  ag_fluid_free(h: number): void;
};

describe('stable-fluids: the wasm kernels', () => {
  it('stable fluids in wasm reproduce the native fixture exactly', () => {
    expect(x.ag_fluid_scenario_checksum(fixture.n, fixture.steps)).toBe(fixture.checksum);
  });

  it('a still fluid stays still through the C ABI', () => {
    const h = x.ag_fluid_new(16);
    x.ag_fluid_step(h, 0.1, 0.001, 0.001, 20);
    const s = new Float32Array(x.memory.buffer, x.ag_fluid_stats(h), 4);
    expect([...s]).toEqual([0, 0, 0, 0]);
    x.ag_fluid_free(h);
  });
});
