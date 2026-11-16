#!/usr/bin/env node
// The flow from a terminal or an agent: the editor's registry, validator and runtime, headless,
// answering in JSON (src/flow/cli.ts). Vite loads the TypeScript so the catalogue and kernel
// globs resolve exactly as in the site; nothing is built and nothing leaves the machine.
//
//   npm run flow -- nodes                  every node type: ports, parameters, derived or declared
//   npm run flow -- coverage [--level L]   every live catalogue entry at its level (declared|derived|inferred)
//   npm run flow -- preset [id]            the example ids, or one example as a graph document
//   npm run flow -- check <file|->         parse and check a graph document (exit 1 when refused)
//   npm run flow -- run <file|->           run it; each node's status and summarised outputs (exit 1 on a failed node)
//   npm run flow -- kernel <id> <file|-> [--trace]   one catalogue kernel on your data (graph: {n, edges, s, t, side?, params?}; any other: its data form, e.g. knapsack {weights, values, capacity}, simplex {A, b, c})
//   npm run flow -- kernels                the kernels `kernel` reads caller data for, with the shape each reads
//   npm run flow -- serve                  one long-lived process: a JSON request per stdin line, a JSON answer per stdout line
//   npm run flow -- help
//
// A graph is the editor's document (schema algoglyph.graph/v1, its "Export JSON"); `-` reads it
// from standard input, so an agent can pipe a proposal straight into `check`.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd = 'help', ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
async function input(arg) {
  if (!arg) throw new Error(`${cmd} needs a graph file, or - for standard input`);
  if (arg !== '-') return readFileSync(resolve(process.cwd(), arg), 'utf8');
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}
/**
 * One process for many requests (a planner that replans): each stdin line is a JSON request
 * {id?, cmd, ...}, answered by one stdout line {id, ...answer}. cmd is one of: kernel (kernel,
 * input, trace?), kernels, check (graph), run (graph), nodes, coverage (level?), preset (preset?).
 * A request that fails is answered {id, ok: false, errors}; the process keeps serving until stdin closes.
 */
async function serve(cli) {
  const answer = async (q) => {
    const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
    switch (q.cmd) {
      case 'kernel': return cli.runKernel(String(q.kernel), text(q.input ?? {}), { trace: Boolean(q.trace) });
      case 'kernels': return { ok: true, kernels: await cli.runnable() };
      case 'check': return cli.validate(text(q.graph));
      case 'run': return cli.run(text(q.graph));
      case 'nodes': return { ok: true, nodes: cli.nodes() };
      case 'coverage': return { ok: true, ...cli.entries(q.level) };
      case 'preset': return { ok: true, preset: cli.preset(q.preset) };
      default: return { ok: false, errors: [`unknown cmd ${q.cmd}; one of kernel, kernels, check, run, nodes, coverage, preset`] };
    }
  };
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let q;
    try { q = JSON.parse(line); } catch (e) { process.stdout.write(`${JSON.stringify({ ok: false, errors: [`not JSON: ${e.message}`] })}\n`); continue; }
    let a;
    try { a = await answer(q); } catch (e) { a = { ok: false, errors: [e instanceof Error ? e.message : String(e)] }; }
    process.stdout.write(`${JSON.stringify({ id: q.id ?? null, ...a })}\n`);
  }
  return 0;
}

const print = (v) => process.stdout.write(`${typeof v === 'string' ? v : JSON.stringify(v, null, 2)}\n`);

if (cmd === 'help' || cmd === '--help') {
  print(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(0, 16).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}

const vite = await createServer({ root: ROOT, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
let code = 0;
try {
  const cli = await vite.ssrLoadModule('/src/flow/cli.ts');
  switch (cmd) {
    case 'nodes': print(cli.nodes()); break;
    case 'coverage': print(cli.entries(opt('--level'))); break;
    case 'preset': print(cli.preset(rest[0])); break;
    case 'check': { const r = cli.validate(await input(rest[0])); print(r); code = r.ok ? 0 : 1; break; }
    case 'kernel': { const r = await cli.runKernel(rest[0], await input(rest[1]), { trace: rest.includes('--trace') }); print(r); code = r.ok ? 0 : 1; break; }
    case 'kernels': print(await cli.runnable()); break;
    case 'serve': code = await serve(cli); break;
    case 'run': { const r = await cli.run(await input(rest[0])); print(r); code = r.ok ? 0 : 1; break; }
    default: throw new Error(`unknown command ${cmd}; try: npm run flow -- help`);
  }
} catch (e) {
  process.stderr.write(`flow: ${e instanceof Error ? e.message : String(e)}\n`);
  code = 2;
} finally {
  await vite.close();
}
process.exit(code);
