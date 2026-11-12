#!/usr/bin/env node
// Browser gate for the built site (rule project.ui-quality-gate): serves dist/, opens it in one
// Chrome launch and checks, in light and dark, at phone and desktop widths:
//   - axe-core finds no WCAG 2.0/2.1/2.2 A or AA violation on the collection, a wing, a planned
//     entry, a plate and a lab
//   - no console error or uncaught exception anywhere
//   - no horizontal overflow
//   - every live entry's thumbnail renders on its wing page (dark, desktop; one wait per card)
//   - every live plate and every runnable lab mounts a canvas of non-zero size and publishes a
//     readout
//   - no gallery thumbnail starts rendering behind the first plate opened after the wings
//     (src/core/thumbs.ts; counted, not timed)
// What exists is read from the catalogue (scripts/lib/catalogue.mjs), the source the site is
// built from, never from a list kept here.
//
//   node scripts/audit-ui.mjs [--dist dist] [--screenshots <dir>] [--previews <dir>]
//
// --previews also writes the published preview images in the same browser launch: every
// plate's canvas at desktop width as <id>.jpg (dark) and <id>-light.jpg, the landing page as
// gallery.jpg / gallery-light.jpg, and the 1200x630 social card og.jpg (dark landing page).
//
// One launch per run on purpose: each headless Chrome launch on macOS leaves a large
// code-signing clone behind, so the gate opens many pages in one browser.
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { parse as parseYaml } from 'yaml';
import { loadCatalogue } from './lib/catalogue.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const DIST = resolve(opt('--dist', 'dist'));
const SHOTS = opt('--screenshots', '');
const PREVIEWS = opt('--previews', '');
const JPEG = { type: 'jpeg', quality: 82 };
const AXE = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.txt': 'text/plain', '.png': 'image/png', '.webp': 'image/webp',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`audit-ui: ${DIST}/index.html missing; run npm run build first`);
  process.exit(2);
}

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(DIST, 'index.html');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
if (PREVIEWS) mkdirSync(PREVIEWS, { recursive: true });

// Locally the installed Chrome; CI sets AUDIT_CHANNEL= (empty) to use the Chromium that
// `playwright-core install chromium` downloaded.
const channel = process.env.AUDIT_CHANNEL ?? 'chrome';
const browser = await chromium.launch({
  ...(channel ? { channel } : {}),
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const log = (msg) => console.log(`audit-ui: ${msg}`);

async function page(context, label) {
  const p = await context.newPage();
  p.setDefaultTimeout(90000);
  p.on('console', (m) => {
    if (m.type() === 'error') fail(label, `console error: ${m.text()}`);
  });
  p.on('pageerror', (e) => fail(label, `uncaught: ${e.message}`));
  return p;
}

async function axe(p, label) {
  await p.addScriptTag({ content: AXE });
  const result = await p.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`);
  });
  for (const v of result) fail(label, `axe ${v}`);
}

async function overflow(p, label) {
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) fail(label, `horizontal overflow of ${over}px`);
}

const { errors, model } = loadCatalogue(process.cwd());
if (errors.length) {
  console.error(`audit-ui: the catalogue has ${errors.length} error(s); run npm run catalogue`);
  process.exit(2);
}
const live = model.entries.filter((e) => e.status === 'live');
const planned = model.entries.filter((e) => e.status === 'planned');
const labs = model.labs.filter((l) => l.entries.filter((id) => live.some((e) => e.id === id)).length >= 2);
// Waits are data (config/budgets.yaml, `browser`): they bound how long a page may take to show
// its first picture and readout on the machine running the gate, a shared CI runner included.
// A lab that took 45 s to show its first readout on the x86 runner, against about 2 s for its
// neighbours (Pages run 43133085956), was a slow page, not a short wait: the readout wait stays a
// gate, and a page that misses it is fixed.
const BROWSER = parseYaml(readFileSync('config/budgets.yaml', 'utf8')).browser;
const THUMB_MS = BROWSER.thumb_ms;
const READOUT_MS = BROWSER.readout_ms;

const RETRIES = BROWSER.readout_retries;
const MAX_RETRIES = BROWSER.max_retries;
const retried = [];

/** The canvas and the readouts of the page now open, once they appear or the wait runs out. */
async function mounted(p) {
  // plates load on demand: wait for the condition, not for a fixed time
  await p.waitForFunction(() => {
    const c = document.querySelector('#stage canvas');
    return c && c.clientWidth > 0 && document.querySelectorAll('#main dl dd.font-mono').length > 0;
  }, null, { timeout: READOUT_MS, polling: 200 }).catch(() => {});
  return p.evaluate(() => {
    const c = document.querySelector('#stage canvas');
    return {
      canvas: c ? [c.clientWidth, c.clientHeight] : null,
      readouts: document.querySelectorAll('#main dl dd.font-mono').length,
    };
  });
}

// A page that misses its wait is opened again (browser.readout_retries): a page that never
// publishes misses every time, while a stall of the machine running the gate passes the second
// visit. Each retry is logged by name, and more than browser.max_retries in a run fails it.
async function readout(p, where, url) {
  const ok = (st) => st.canvas && st.canvas[0] && st.canvas[1] && st.readouts;
  let state = await mounted(p);
  for (let r = 0; r < RETRIES && !ok(state); r++) {
    retried.push(where);
    console.log(`audit-ui: retry ${where}: no ${state.readouts ? 'canvas' : 'readout'} in ${READOUT_MS} ms; opening it again`);
    await p.goto('about:blank');
    await p.goto(url, { waitUntil: 'load' });
    state = await mounted(p);
  }
  if (!state.canvas || !state.canvas[0] || !state.canvas[1]) fail(where, 'no canvas');
  if (!state.readouts) fail(where, 'no readout published');
}

try {
  for (const theme of ['dark', 'light']) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const label = `${theme} ${w}px`;
      const desktop = w >= 1024;
      const context = await browser.newContext({
        viewport: { width: w, height: h },
        colorScheme: theme,
        reducedMotion: 'no-preference',
      });
      await context.addInitScript((t) => localStorage.setItem('color-theme', t), theme);
      // every off-screen thumbnail render appends one host to <body> (src/core/stage.ts thumbnail)
      await context.addInitScript(() => {
        window.__thumbStarts = 0;
        new MutationObserver((records) => {
          for (const r of records) {
            for (const n of r.addedNodes) {
              if (n instanceof HTMLElement && n.parentElement === document.body
                && n.style.left === '-10000px') window.__thumbStarts++;
            }
          }
        }).observe(document, { childList: true, subtree: true });
      });
      const p = await page(context, `${label} collection`);
      await p.goto(base, { waitUntil: 'load' });
      if (PREVIEWS && desktop) {
        await p.waitForFunction(() => [...document.querySelectorAll('main [data-thumb] img')]
          .every((i) => i.getAttribute('src')?.startsWith('data:image')), null, { timeout: 300000, polling: 500 })
          .catch(() => log(`${label}: the mosaic did not finish before the preview`));
      }
      await overflow(p, `${label} collection`);
      await axe(p, `${label} collection`);
      log(`${label}: collection audited`);
      if (SHOTS) await p.screenshot({ path: join(SHOTS, `collection-${theme}-${w}.png`), fullPage: false });
      if (PREVIEWS && desktop) {
        const suffix = theme === 'dark' ? '' : '-light';
        await p.screenshot({ ...JPEG, path: join(PREVIEWS, `gallery${suffix}.jpg`) });
        if (theme === 'dark') {
          await p.setViewportSize({ width: 1200, height: 630 });
          await p.waitForTimeout(400);
          await p.screenshot({ ...JPEG, path: join(PREVIEWS, 'og.jpg') });
          await p.setViewportSize({ width: w, height: h });
        }
      }

      // the wings: each page audited for overflow; axe on the first; thumbnails proven card by
      // card in the dark desktop pass, so the wait is bounded per card and not per collection
      const proveThumbs = theme === 'dark' && desktop;
      for (const [i, wing] of model.roots.entries()) {
        const where = `${label} wing ${wing}`;
        await p.goto(`${base}#/c/${wing}`, { waitUntil: 'load' });
        await p.waitForSelector('#browse-title');
        await overflow(p, where);
        if (i === 0) await axe(p, where);
        if (!proveThumbs) continue;
        const ids = live.filter((e) => e.path[0] === wing).map((e) => e.id);
        // thumbnails render one after another in a queue, so a card waits for every card ahead
        // of it: the budget is derived from the cards on the page, then each card is judged
        // (run 43108000193: a 3D card behind other 3D cards outran a fixed per-card budget)
        const budget = THUMB_MS * Math.max(1, ids.length);
        const started = Date.now();
        for (const id of ids) {
          const card = p.locator(`main [data-thumb="${id}"]`);
          if (!(await card.count())) { fail(where, `no card for ${id}`); continue; }
          await card.scrollIntoViewIfNeeded();
          const left = Math.max(1000, budget - (Date.now() - started));
          await p.waitForFunction((x) => document.querySelector(`main [data-thumb="${x}"] img`)
            ?.getAttribute('src')?.startsWith('data:image'), id, { timeout: left, polling: 250 })
            .catch(() => fail(where, `thumbnail ${id} did not render within the wing's budget of ${budget / 1000} s`));
        }
        log(`${where}: ${ids.length} thumbnail(s) proven`);
      }

      // a planned entry: its page states what it will be
      if (planned.length) {
        const where = `${label} planned ${planned[0].id}`;
        await p.goto(`${base}#/p/${planned[0].id}`, { waitUntil: 'load' });
        await p.waitForSelector('#plate-title');
        await overflow(p, where);
        if (theme === 'dark') await axe(p, where);
      }

      // the plates: each mounts, draws and reports; axe on the first one
      const only = desktop ? live : live.slice(0, 2);
      for (const [i, e] of only.entries()) {
        const where = `${label} plate ${e.id}`;
        log(where);
        const thumbsBefore = await p.evaluate(() => window.__thumbStarts);
        const url = `${base}#/p/${e.id}?seed=4242`;
        await p.goto(url, { waitUntil: 'load' });
        await readout(p, where, url);
        if (i === 0) {
          // the wings queued their cards; none of them may start once a plate owns the page
          await p.waitForTimeout(1500);
          const behind = (await p.evaluate(() => window.__thumbStarts)) - thumbsBefore;
          if (behind > 0) fail(where, `${behind} gallery thumbnail render(s) started behind the plate`);
        }
        // previews let a plate develop for longer before its picture is taken
        await p.waitForTimeout(PREVIEWS && desktop ? 6000 : 600);
        await overflow(p, where);
        if (i === 0) await axe(p, where);
        if (SHOTS && desktop) await p.screenshot({ path: join(SHOTS, `plate-${theme}-${e.id}.png`), fullPage: false });
        if (PREVIEWS && desktop) {
          const canvas = p.locator('#stage canvas');
          if (await canvas.count()) {
            const suffix = theme === 'dark' ? '' : '-light';
            await canvas.first().screenshot({ ...JPEG, path: join(PREVIEWS, `${e.id}${suffix}.jpg`) });
          }
        }
      }

      // the labs: each runs its kernels side by side and reports per kernel
      for (const [i, l] of labs.entries()) {
        const where = `${label} lab ${l.id}`;
        log(where);
        const url = `${base}#/lab/${l.id}?seed=4242`;
        await p.goto(url, { waitUntil: 'load' });
        await readout(p, where, url);
        await overflow(p, where);
        if (i === 0) await axe(p, where);
        if (SHOTS && desktop) await p.screenshot({ path: join(SHOTS, `lab-${theme}-${l.id}.png`), fullPage: false });
      }
      await context.close();
    }
  }
  console.log(`audit-ui: ${live.length} plates, ${labs.length} lab(s), ${model.roots.length} wings, 2 themes, 2 widths`);
} finally {
  await browser.close();
  server.close();
}

if (retried.length) {
  console.log(`audit-ui: ${retried.length} page(s) opened again after a missed wait: ${retried.join(', ')}`);
  if (retried.length > MAX_RETRIES) fail('run', `${retried.length} retries, more than browser.max_retries ${MAX_RETRIES}: the machine or the site is too slow to judge`);
}
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`audit-ui: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('audit-ui: ok');
