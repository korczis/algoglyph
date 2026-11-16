// What every addition to the flow owes, read from the source tree so it holds for the next one
// too (rule project.typed-flow): an engine adapter has a test that runs its node against its
// engine and a row in the RFC's migration matrix saying so; a command of the flow's command line
// is documented where a reader and an agent look for it. Nothing here lists adapters or commands
// by hand — they are read from the registry and the script.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runnable } from '../src/flow/cli';
import { ADAPTERS } from '../src/flow/nodes';

const read = (p: string) => readFileSync(p, 'utf8');
// the sort node's references predate derivation and live with the runtime's
const derivedTests = read('test/flow-derive.test.ts') + read('test/flow-runtime.test.ts');
const rfc = read('docs/rfc/0001-typed-reactive-dag.md');
const architecture = read('docs/ARCHITECTURE.md');
const cliScript = read('scripts/flow.mjs');

describe('every engine adapter is tested and documented', () => {
  it.each(ADAPTERS.map((a) => [a.engine, a.type]))('%s (%s node) runs against its engine in test/flow-derive or flow-runtime', (_engine, type) => {
    expect(derivedTests).toContain(`REGISTRY.get('${type}')`);
  });

  it.each([...new Set(ADAPTERS.map((a) => a.engine))])('%s has a row in the RFC migration matrix that calls it derived', (engine) => {
    const row = rfc.split('\n').find((l) => l.startsWith(`| ${engine}`));
    expect(row, `docs/rfc/0001-typed-reactive-dag.md has no matrix row for ${engine}`).toBeDefined();
    expect(row).toMatch(/derived/);
  });
});

describe('every command of the flow command line is documented', () => {
  const commands = [...cliScript.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]);

  it('reads its commands from the script', () => {
    expect(commands.length).toBeGreaterThan(0);
  });

  it.each(commands)('%s is in the script\'s help and in docs/ARCHITECTURE.md', (cmd) => {
    const help = cliScript.split('\n').filter((l) => l.startsWith('//')).join('\n');
    expect(help).toContain(`npm run flow -- ${cmd}`);
    expect(architecture).toMatch(new RegExp(`npm run flow -- <[^>]*\\b${cmd}\\b`));
  });
});

describe('every data form has a reference test', () => {
  // a kernel that reads a caller's data (a grid fromData, or a data form of src/core/solve.ts)
  // owes a test that runs it on data whose answer is known independently
  const cliTests = read('test/flow-cli.test.ts');
  it('each kernel the command line reads data for, other than graph kernels, is run in test/flow-cli.test.ts', async () => {
    const forms = (await runnable()).filter((k) => k.engine !== 'graph').map((k) => String(k.id));
    expect(forms.length).toBeGreaterThan(0);
    for (const id of forms) expect(cliTests, `${id} declares a data form but test/flow-cli.test.ts never runs it`).toContain(`runKernel('${id}'`);
  });
});
