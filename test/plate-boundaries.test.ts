// A plate never imports another plate (rule project.viz-component-layer): code that several
// bespoke plates share lives in src/plates/_shared/<name>/, which has no plate.ts and so is never
// discovered as a plate. Derived from the tree, so a new plate or a new import is judged at once.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const PLATES = resolve('src/plates');
const SHARED = '_shared';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|js|mjs)$/.test(f) ? [p] : [];
  });
}

/** Every relative import of a file, resolved to the plate directory it lands in (or null). */
export function crossings(file: string, text: string): string[] {
  const own = relative(PLATES, file).split(sep)[0];
  const out: string[] = [];
  for (const m of text.matchAll(/(?:import|export)[^'"`]*?from\s*['"`](\.{1,2}\/[^'"`]+)['"`]|import\(\s*['"`](\.{1,2}\/[^'"`]+)['"`]\s*\)/g)) {
    const spec = m[1] ?? m[2];
    const target = resolve(join(file, '..'), spec);
    const rel = relative(PLATES, target);
    if (rel.startsWith('..')) continue; // outside src/plates: core, engines, kernels
    const dir = rel.split(sep)[0];
    if (dir !== own && dir !== SHARED) out.push(`${relative(process.cwd(), file)} imports ${spec} (plate ${dir})`);
  }
  return out;
}

describe('plate boundaries', () => {
  it('no plate imports another plate; shared code goes through src/plates/_shared/', () => {
    const found = readdirSync(PLATES)
      .filter((d) => statSync(join(PLATES, d)).isDirectory())
      .flatMap((d) => files(join(PLATES, d)))
      .flatMap((f) => crossings(f, readFileSync(f, 'utf8')));
    expect(found).toEqual([]);
  });

  it('the check sees a crossing, a shared import and an import outside the plates', () => {
    const f = join(PLATES, 'a', 'plate.ts');
    expect(crossings(f, "import { x } from '../b/trace';")).toHaveLength(1);
    expect(crossings(f, "const m = import('../b/plate');")).toHaveLength(1);
    expect(crossings(f, "import { x } from '../_shared/trace/trace';")).toEqual([]);
    expect(crossings(f, "import { x } from './local';")).toEqual([]);
    expect(crossings(f, "import { num } from '../../core/plate';")).toEqual([]);
  });
});
