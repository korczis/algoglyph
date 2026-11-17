#!/usr/bin/env node
// How much of a budget-gate reading is the gate's own runtime? The gate (test/budget/) times plates
// under vitest, whose module transform turns every imported binding into a property read on a
// module object; the site ships a bundle where imports are plain bindings. This loads
// scripts/budget-vs-bundle-entry.ts both ways in one process and times the same corners:
//
//   transform  Vite's SSR module loader (server.ssrLoadModule), the transform vitest runs
//   bundle     a production SSR build of the entry (Rolldown, minified), imported as plain ESM
//
// For each corner it prints the median and the worst frame of each, and their ratios. It is a
// measurement, not a gate: run it on a quiet machine, more than once, and record what it says.
//
//   node scripts/budget-vs-bundle.mjs [--frames 300] [--warm 120] [--repeats 3]
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const FRAMES = opt('--frames', 300);
const WARM = opt('--warm', 120);
const REPEATS = opt('--repeats', 3);
const root = resolve(import.meta.dirname, '..');
const entry = join(root, 'scripts/budget-vs-bundle-entry.ts');

const out = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'budget-vs-bundle-'));
try {
  await build({
    root, configFile: false, logLevel: 'silent',
    build: { ssr: entry, outDir: out, minify: true, emptyOutDir: true, rollupOptions: { output: { format: 'es', entryFileNames: 'entry.mjs' } } },
  });
  const bundled = await import(pathToFileURL(join(out, 'entry.mjs')).href);
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const transformed = await server.ssrLoadModule(entry);

  const stat = (xs) => { const s = [...xs].sort((a, b) => a - b); return { median: s[s.length >> 1], worst: s[s.length - 1] }; };
  /** The best of the repeats, as the gate judges: the smallest median and the smallest worst frame. */
  const best = (mod, i) => {
    let median = Infinity; let worst = Infinity;
    for (let r = 0; r < REPEATS; r++) {
      const s = stat(mod.frames(mod.CORNERS[i], WARM, FRAMES, 4242 + 7919 * r));
      median = Math.min(median, s.median); worst = Math.min(worst, s.worst);
    }
    return { median, worst };
  };
  const f = (v) => v.toFixed(2).padStart(6);
  console.log(`frames ${FRAMES} after ${WARM} warm, best of ${REPEATS}; thread CPU ms per frame at 1440 × 900`);
  console.log('corner'.padEnd(44), 'transform med/worst', '  bundle med/worst', '  ratio med/worst');
  for (let i = 0; i < bundled.CORNERS.length; i++) {
    // alternate the order so neither runtime always runs warm
    const [t, b] = i % 2 ? [best(transformed, i), best(bundled, i)] : (() => { const b0 = best(bundled, i); return [best(transformed, i), b0]; })();
    console.log(bundled.CORNERS[i].label.padEnd(44), `${f(t.median)} ${f(t.worst)}`, `   ${f(b.median)} ${f(b.worst)}`,
      `   ${(t.median / b.median).toFixed(2).padStart(5)} ${(t.worst / b.worst).toFixed(2).padStart(5)}`);
  }
  await server.close();
} finally {
  rmSync(out, { recursive: true, force: true });
}
