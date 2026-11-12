// vitest globalSetup: the wasm kernels are a build output (ADR 0004 §6, never committed), so a
// fresh checkout has none; build them before any test imports a plate that needs them. Root
// cause of "vitest fails in a fresh worktree" (reported by dev-5f): only `npm test` built them.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export default function setup(): void {
  if (existsSync('src/wasm/algoglyph_kernels.wasm')) return;
  execFileSync('scripts/wasm.sh', ['--build'], { stdio: 'inherit' });
}
