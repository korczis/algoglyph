import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { GROUNDS, palette } from '../src/core/palette';
import { defaults, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { loadPlate } from '../src/registry';
import { p5Stub, installBrowserStubs } from './support/p5-stub';
installBrowserStubs();
const SETUPS: [string, Record<string, any>][] = JSON.parse(process.env.SETUPS ?? '[]');
it('probe', async () => {
  const out: string[] = [];
  for (const [id, setup] of SETUPS) {
    const plate = (await loadPlate(id))!;
    const params = { ...defaults(plate), ...setup };
    let rows: Stat[] = [];
    const ctx: PlateContext = { width: 800, height: 500, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
      bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false, palette: () => palette('abyss'), stats(r) { rows = r; }, chart() {} };
    const sim = plate.create(p5Stub(), ctx); sim.setup();
    let last = ''; let still = 0;
    for (let f = 0; f < 20000 && still < 120; f++) { sim.draw(); const now = JSON.stringify(rows); still = now === last ? still + 1 : 0; last = now; }
    out.push(`== ${id} ${JSON.stringify(setup)}`);
    for (const r of rows) out.push(`  ${r.label}: ${r.value}`);
  }
  writeFileSync('/private/tmp/claude-501/-Users-korczis-dev-algoglyph/8b702ebf-3f15-4e77-880e-843436e75d2c/scratchpad/probe.txt', out.join('\n'));
}, 600000);
