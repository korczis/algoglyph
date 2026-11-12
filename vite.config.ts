/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { catalogue } from './scripts/lib/vite-catalogue.mjs';

// The deployed site proves which commit it was built from: pages.yml polls revision.txt.
function revision(): Plugin {
  return {
    name: 'algoglyph-revision',
    apply: 'build',
    closeBundle() {
      let sha = process.env.GITHUB_SHA ?? '';
      if (!sha) {
        try {
          sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString().trim();
        } catch {
          sha = 'unknown';
        }
      }
      const out = resolve(process.cwd(), 'dist');
      mkdirSync(out, { recursive: true });
      writeFileSync(resolve(out, 'revision.txt'), `${sha}\n`);
    },
  };
}

export default defineConfig({
  base: process.env.ALGOGLYPH_BASE ?? './',
  plugins: [tailwindcss(), catalogue(), revision()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Correctness tests are judged on their result, not on wall-clock time: speed is the budget
    // gate's job (test/budget.test.ts, CPU time, calibrated). The default 5 s timeout failed a
    // boids invariant test that takes under 2 s here on the shared runner while the other
    // files ran beside it (Pages run 43128794427).
    testTimeout: 120_000,
  },
});
