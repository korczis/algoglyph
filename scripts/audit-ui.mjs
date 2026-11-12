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
//   - every routed figure page (ADR 0009) mounts its plate with its setup, opens on its canonical
//     link (the seed alone: the setup is the link's base), keeps a seed it is given and shows one
//     card per figure claim, and the figure collection and chapter indexes pass axe
//   - every documented field an entry declares is on its page (dark desktop pass, every plate):
//     its objectives, prerequisites, paradigm, bounds model and difficulty, and one card per
//     claim (ADR 0007; that a claim's readout exists is test/claims.test.ts's to prove)
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
// figure pages exist only once their chapter is reviewed and their plate is live and tested
const figures = (model.chapters ?? []).flatMap((c) => c.figures.filter((f) => f.routed));
const indexes = [...new Set(figures.map((f) => f.route.split('/').slice(0, 2).join('/')))]
  .flatMap((c) => [c, ...new Set(figures.filter((f) => f.route.startsWith(`${c}/`))
    .map((f) => f.route.split('/').slice(0, 4).join('/')))]);
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
/** The documented fields `e` declares, against what its page renders (data-doc hooks in index.html). */
async function documented(p, where, e) {
  const seen = await p.evaluate(() => {
    const all = (sel) => [...document.querySelectorAll(sel)];
    return {
      objectives: all('[data-doc="objective"]').length,
      prerequisites: all('[data-doc="prerequisite"]').map((a) => a.getAttribute('href')),
      paradigm: document.querySelector('[data-doc="paradigm"]')?.textContent?.trim() ?? '',
      model: document.querySelector('[data-doc="bounds-model"]')?.textContent?.trim() ?? '',
      difficulty: document.querySelector('[data-doc="difficulty"]')?.textContent?.trim() ?? '',
      claims: all('[data-doc="claim"]').length,
    };
  });
  const want = (n, what) => fail(where, `the entry declares ${what}, the page shows ${n}`);
  const objectives = e.pedagogy?.objectives?.length ?? 0;
  if (seen.objectives !== objectives) want(seen.objectives, `${objectives} objective(s)`);
  for (const id of e.pedagogy?.prerequisites ?? []) {
    if (!seen.prerequisites.includes(`#/p/${id}`)) fail(where, `prerequisite ${id} is declared but not linked on the page`);
  }
  if (e.pedagogy?.difficulty && seen.difficulty !== e.pedagogy.difficulty) want(`"${seen.difficulty}"`, `difficulty ${e.pedagogy.difficulty}`);
  if (e.algorithm?.paradigm && seen.paradigm !== e.algorithm.paradigm) want(`"${seen.paradigm}"`, `paradigm ${e.algorithm.paradigm}`);
  if (e.bounds?.model && !seen.model.includes(e.bounds.model)) want(`"${seen.model}"`, `bounds counting ${e.bounds.model}`);
  if (seen.claims !== e.claims.length) want(seen.claims, `${e.claims.length} claim(s)`);
  // that each claim's readout exists is test/claims.test.ts's to prove: it runs the plate until its
  // readouts settle, where this page is read at its first readout, before a run's later phases
}

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
        const url = `${base}#/p/${e.id}?seed=4242`;
        await p.goto(url, { waitUntil: 'load' });
        await readout(p, where, url);
        if (theme === 'dark' && desktop) await documented(p, where, e);
        if (i === 0) {
          // the wings queued their cards; none of them may start once a plate owns the page. The
          // count is taken once the plate has mounted: a render that began in the moment before
          // the navigation is the gallery's, and counting from before the navigation failed a
          // gate on exactly that (quick-find, light 1440 px, on bbe3cbb)
          const mounted = await p.evaluate(() => window.__thumbStarts);
          await p.waitForTimeout(1500);
          const behind = (await p.evaluate(() => window.__thumbStarts)) - mounted;
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

      // a reader's own data (ADR 0010): refused with its row named, attached, run on, announced as
      // carried by the link, restored from the link alone, and never sent anywhere. Every declaring
      // plate in the dark desktop pass, the first one elsewhere.
      const declaring = live.filter((e) => e.data?.length);
      for (const [i, e] of (theme === 'dark' && desktop ? declaring : declaring.slice(0, 1)).entries()) {
        const d = e.data[0];
        const where = `${label} data ${e.id}`;
        log(where);
        const url = `${base}#/p/${e.id}?seed=4242`;
        await p.goto(url, { waitUntil: 'load' });
        await readout(p, where, url);
        const sent = [];
        const watch = (r) => {
          const u = r.url();
          if (u.startsWith('data:') || u.startsWith('blob:')) return;
          if (!u.startsWith(base) || r.method() !== 'GET') sent.push(`${r.method()} ${u}`);
        };
        p.on('request', watch);
        const card = p.locator('[data-data-card]').first();
        await p.fill(`#data-paste-${d.id}`, `${d.columns.map((c) => c.key).join(',')}\n1,oops\n2,3`);
        await card.getByRole('button', { name: 'Use pasted data' }).click();
        const refused = await p.waitForSelector('[data-data-errors]', { state: 'visible', timeout: 5000 }).then(() => true, () => false);
        if (!refused) fail(where, 'a value that is not a number was not refused on the page');
        const n = Math.max(d.rows.min, 12);
        const csv = [d.columns.map((c) => c.key).join(','),
          ...Array.from({ length: n }, (_, k) => d.columns.map((c, j) => (j === 0 ? k : (k * k * 7 + 3) % 23)).join(','))].join('\n');
        await p.setInputFiles(`#data-file-${d.id}`, { name: 'mine.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        const ran = await p.waitForFunction(() => [...document.querySelectorAll('#main dl > div')]
          .some((r) => r.querySelector('dt')?.textContent === 'Input' && /^your data/.test(r.querySelector('dd')?.textContent ?? '')),
        null, { timeout: READOUT_MS, polling: 200 }).then(() => true, () => false);
        if (!ran) fail(where, 'the plate did not report running on the attached data');
        const href = p.url();
        if (!href.includes(`d.${d.id}=`)) fail(where, 'the link does not carry the attached data');
        if (!(await p.isVisible('[data-data-travels]'))) fail(where, 'the page does not say that a copied link carries the data');
        if (i === 0) { await overflow(p, where); await axe(p, where); }
        await p.goto('about:blank');
        await p.goto(href, { waitUntil: 'load' });
        const back = await p.waitForFunction(() => /from the link/.test(document.querySelector('[data-data-loaded]')?.textContent ?? ''),
          null, { timeout: READOUT_MS, polling: 200 }).then(() => true, () => false);
        if (!back) fail(where, 'opening the link did not restore the data');
        p.off('request', watch);
        for (const r of sent) fail(where, `a request left the page while it held a reader's data: ${r}`);
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

      // the figure pages: each mounts its plate with the figure's setup and reports
      for (const [i, f] of figures.entries()) {
        const where = `${label} figure ${f.route}`;
        log(where);
        const url = `${base}${f.route}?seed=4242`;
        await p.goto(url, { waitUntil: 'load' });
        await readout(p, where, url);
        await overflow(p, where);
        if (i === 0) await axe(p, where);
        // the canonical link of a figure at its setup is its seed alone; another seed is kept
        await p.waitForTimeout(400);
        const hash = await p.evaluate(() => location.hash);
        if (hash !== `${f.route}?seed=4242`) fail(where, `opened as ${hash}, not ${f.route}?seed=4242`);
        const cards = await p.evaluate(() => document.querySelectorAll('[data-doc="figure-claim"]').length);
        if (cards !== f.claims.length) fail(where, `${cards} figure claim card(s) for ${f.claims.length} claim(s)`);
        await p.goto(`${base}${f.route}?seed=99`, { waitUntil: 'load' });
        await readout(p, where, `${base}${f.route}?seed=99`);
        if (!(await p.evaluate(() => location.hash)).endsWith('?seed=99')) fail(where, 'did not keep the seed of its link');
        if (SHOTS && desktop) await p.screenshot({ path: join(SHOTS, `figure-${theme}-${f.route.replace(/[#/]/g, '_')}.png`), fullPage: false });
      }
      for (const [i, route] of indexes.entries()) {
        const where = `${label} figures ${route}`;
        await p.goto(`${base}${route}`, { waitUntil: 'load' });
        await p.waitForSelector('#figures-title');
        await overflow(p, where);
        if (i === 0) await axe(p, where);
      }
      await context.close();
    }
  }
  console.log(`audit-ui: ${live.length} plates, ${labs.length} lab(s), ${figures.length} figure page(s), ${model.roots.length} wings, 2 themes, 2 widths`);
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
