// The flow's layer boundaries, read from the source (rule project.typed-flow, RFC §3): the model,
// validator, store, runtime and nodes never touch the DOM, so a graph runs headless exactly as it
// runs in the page; no file of the flow names a network or storage API, so a reader's table cannot
// leave the tab; and the editor changes the document only by dispatching intents.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = 'src/flow';
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
const src = (f: string) => readFileSync(`${DIR}/${f}`, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const HEADLESS = ['types.ts', 'node.ts', 'graph.ts', 'store.ts', 'runtime.ts', 'nodes.ts', 'presets.ts', 'derive.ts', 'adapters.ts', 'cli.ts'];

describe('flow boundaries', () => {
  it('knows every file of the flow as headless or as the editor', () => {
    expect(files.sort()).toEqual([...HEADLESS, 'studio.ts'].sort());
  });

  it.each(HEADLESS)('%s runs without a DOM', (f) => {
    expect(src(f)).not.toMatch(/\b(document|window|navigator|location)\.|\b(HTMLElement|requestAnimationFrame|localStorage)\b/);
  });

  it.each(files)('%s names no network or storage API', (f) => {
    expect(src(f)).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|caches)\b/);
  });

  it.each(HEADLESS)('%s loads no code at run time', (f) => {
    expect(src(f)).not.toMatch(/\bimport\s*\(|\beval\s*\(|new Function\b/);
  });

  it('the editor never writes the document except through the store', () => {
    const s = src('studio.ts');
    expect(s).not.toMatch(/store\.graph\.(nodes|edges)\.(push|splice|pop|shift)\(/);
    expect(s).not.toMatch(/store\.graph\.[a-z]+\s*=[^=]/);
    expect(s).not.toMatch(/\.(state|params)\s*=[^=]/);
    expect(s).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });

  it('a view never sends a computed value back along an edge: only intents to an owner', () => {
    const s = src('studio.ts');
    // the scatter view's only write is a move intent addressed to the node that owns the points
    expect(s.match(/name: 'move'/g)?.length).toBe(1);
    expect(s).toMatch(/node: owner, name: 'move'/);
  });
});
