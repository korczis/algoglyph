#!/usr/bin/env node
// Imported helpers called inside loops, in the code the budget gate times (src/plates, src/engines,
// src/kernels). Under vitest's module transform an imported binding is a property read on a module
// object, so a helper like flush() or ramp() called once per cell or particle is measured by the
// gate at 3-4x what the site pays (config/budgets.yaml, scripts/budget-vs-bundle.mjs); and
// ramp()/mix()/scale() allocate a colour array per call besides. The fix is local and bit-equal: a
// local copy of the constant with the comparison inlined, or the colour arithmetic inlined in order.
//
// What it catches: an imported flush() called inside the body of any `for` or `while` loop; and
// an imported ramp(), mix() or scale() called inside a loop whose body writes pixels (an indexed
// `data[...]` store, the raster's or a local alias of it, or a `.set(` call: a raster shaded
// cell by cell).
//
// What it misses:
// - a helper reached through a wrapper of the module's own (f() calling flush());
// - a local alias of a helper (const r = ramp). That is how the fixes bind the in-place
//   rampInto/mixInto/scaleInto, so an alias of an allocating helper passes too;
// - a helper not named here, or a namespace import (core.flush);
// - loops written as forEach/map callbacks;
// - colour helpers in loops that draw element by element through p5 (bars, nodes, particles),
//   which are bound by their p5 calls, at most thousands a frame.
// It cannot tell a per-frame loop from a one-off one (a palette legend, a map painted once);
// those go in scripts/check-hot-loops.allow.json with the reason.
//
//   node scripts/check-hot-loops.mjs           fail (exit 1) on any call not allowed
//   node scripts/check-hot-loops.mjs --list    print every call found, allowed or not
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const DIRS = ['src/plates', 'src/engines', 'src/kernels'];
/** Helpers that cost a property read per call, in any loop. */
const HOT = ['flush'];
/** Helpers that also allocate a colour per call, in a loop that shades pixels. */
const SHADE = ['ramp', 'mix', 'scale'];
/** A loop body that writes pixels: an indexed store into `data` (a raster's or its alias), or a `.set(`. */
const PIXELS = /\bdata\[[^\]]*\]\s*=(?!=)|\.set\(/;

/**
 * Calls that are not in a per-frame loop over cells or particles, by file and the line's text
 * (trimmed, a substring of it), each with its reason. Read by the check; reported with --list.
 */
export const ALLOW = JSON.parse(readFileSync(join(root, 'scripts/check-hot-loops.allow.json'), 'utf8'));

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Names this module imports from anywhere, as they are bound here. */
function imported(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p || p.startsWith('type ')) continue;
      const as = p.split(/\s+as\s+/);
      names.add((as[1] ?? as[0]).trim());
    }
  }
  return names;
}

/** Line numbers inside the bodies of for/while loops (brace-matched, comments and strings blanked). */
function loopLines(src) {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (s) => ' '.repeat(s.length))
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (s) => s[0] + ' '.repeat(s.length - 2) + s[0]);
  const inLoop = new Set();
  /** [first line, last line, body text] of every loop. */
  const ranges = [];
  const re = /\b(for|while)\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    // skip the loop's header parentheses
    let i = m.index + m[0].length; let depth = 1;
    while (i < code.length && depth) { if (code[i] === '(') depth++; else if (code[i] === ')') depth--; i++; }
    while (i < code.length && /\s/.test(code[i])) i++;
    let end;
    if (code[i] === '{') {
      let d = 0; let j = i;
      for (; j < code.length; j++) { if (code[j] === '{') d++; else if (code[j] === '}' && --d === 0) break; }
      end = j;
    } else {
      // a single statement: to the end of the statement
      end = code.indexOf(';', i);
      if (end < 0) end = code.length;
    }
    const a = code.slice(0, i).split('\n').length; const b = code.slice(0, end).split('\n').length;
    for (let l = a; l <= b; l++) inLoop.add(l);
    ranges.push([a, b, code.slice(i, end + 1)]);
  }
  return { inLoop, ranges, code };
}

/** The calls one module makes to the helpers inside loops: [line, helper, text]. */
export function findings(src) {
  const names = imported(src);
  const hot = HOT.filter((h) => names.has(h));
  const shade = SHADE.filter((h) => names.has(h));
  if (!hot.length && !shade.length) return [];
  const { inLoop, ranges, code } = loopLines(src);
  const lines = code.split('\n'); const raw = src.split('\n');
  // a line shades pixels when some loop containing it writes pixels
  const shading = (l) => ranges.some(([a, b, body]) => a <= l && l <= b && PIXELS.test(body));
  const out = [];
  lines.forEach((line, k) => {
    if (!inLoop.has(k + 1)) return;
    for (const h of [...hot, ...(shading(k + 1) ? shade : [])]) {
      if (new RegExp(`(^|[^.\\w])${h}\\(`).test(line)) out.push({ line: k + 1, helper: h, text: raw[k].trim() });
    }
  });
  return out;
}

export function scan() {
  const found = [];
  for (const d of DIRS) {
    for (const f of files(join(root, d))) {
      const file = relative(root, f);
      for (const x of findings(readFileSync(f, 'utf8'))) {
        const allow = ALLOW.find((a) => a.file === file && x.text.includes(a.line));
        found.push({ file, ...x, allow: allow?.because });
      }
    }
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = scan();
  const bad = found.filter((x) => !x.allow);
  if (process.argv.includes('--list')) {
    for (const x of found) console.log(`${x.allow ? 'allowed' : 'FAIL   '} ${x.file}:${x.line} ${x.helper}() ${x.allow ? `— ${x.allow}` : ''}`);
  }
  for (const x of bad) console.error(`check-hot-loops: ${x.file}:${x.line} calls the imported ${x.helper}() inside a loop: ${x.text}`);
  console.log(`check-hot-loops: ${found.length} call(s) in loops, ${found.length - bad.length} allowed, ${bad.length} to fix`);
  process.exit(bad.length ? 1 : 0);
}
