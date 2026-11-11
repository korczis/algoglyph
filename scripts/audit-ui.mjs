#!/usr/bin/env node
// Browser gate for the built site (rule project.ui-quality-gate): serves dist/, opens it in one
// Chrome launch and checks, in light and dark, at phone and desktop widths:
//   - axe-core finds no WCAG 2.0/2.1/2.2 A or AA violation on the gallery and on a plate
//   - no console error or uncaught exception anywhere
//   - no horizontal overflow
//   - every gallery thumbnail renders
//   - every plate mounts a canvas of non-zero size and publishes a readout
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

try {
  const plates = [];
  for (const theme of ['dark', 'light']) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const label = `${theme} ${w}px`;
      const context = await browser.newContext({
        viewport: { width: w, height: h },
        colorScheme: theme,
        reducedMotion: 'no-preference',
      });
      await context.addInitScript((t) => localStorage.setItem('color-theme', t), theme);
      const p = await page(context, `${label} gallery`);
      await p.goto(base, { waitUntil: 'load' });
      // every thumbnail is a real render, sequential; they do not depend on the viewport, so
      // they are awaited (and proven) once per theme, at desktop width
      if (w >= 1024) await p.waitForFunction(() => {
        const imgs = [...document.querySelectorAll('main img')];
        return imgs.length > 0 && imgs.every((i) => i.getAttribute('src')?.startsWith('data:image'));
      }, null, { timeout: 300000, polling: 500 })
        .catch(() => fail(`${label} gallery`, 'thumbnails did not all render'));
      log(`${label}: gallery ${w >= 1024 ? 'thumbnails done' : 'loaded'}`);
      if (!plates.length) {
        plates.push(...await p.evaluate(() => [...document.querySelectorAll('main a[href^="#/p/"]')]
          .map((a) => a.getAttribute('href').slice(4))));
      }
      await overflow(p, `${label} gallery`);
      await axe(p, `${label} gallery`);
      log(`${label}: gallery audited`);
      if (SHOTS) await p.screenshot({ path: join(SHOTS, `gallery-${theme}-${w}.png`), fullPage: false });
      if (PREVIEWS && w >= 1024) {
        const suffix = theme === 'dark' ? '' : '-light';
        await p.screenshot({ ...JPEG, path: join(PREVIEWS, `gallery${suffix}.jpg`) });
        if (theme === 'dark') {
          await p.setViewportSize({ width: 1200, height: 630 });
          await p.waitForTimeout(400);
          await p.screenshot({ ...JPEG, path: join(PREVIEWS, 'og.jpg') });
          await p.setViewportSize({ width: w, height: h });
        }
      }

      // the plates: each mounts, draws and reports; axe on the first one
      const only = w === 1440 ? plates : plates.slice(0, 2);
      for (const [i, id] of only.entries()) {
        const where = `${label} plate ${id}`;
        log(where);
        await p.goto(`${base}#/p/${id}?seed=4242`, { waitUntil: 'load' });
        // previews let a plate develop for longer before its picture is taken
        await p.waitForTimeout(PREVIEWS && w >= 1024 ? 6000 : 1800);
        const state = await p.evaluate(() => {
          const c = document.querySelector('#stage canvas');
          return {
            canvas: c ? [c.clientWidth, c.clientHeight] : null,
            readouts: document.querySelectorAll('#main dl dd.font-mono').length,
          };
        });
        if (!state.canvas || !state.canvas[0] || !state.canvas[1]) fail(where, 'no canvas');
        if (!state.readouts) fail(where, 'no readout published');
        await overflow(p, where);
        if (i === 0) await axe(p, where);
        if (SHOTS && w === 1440) {
          await p.screenshot({ path: join(SHOTS, `plate-${theme}-${id}.png`), fullPage: false });
        }
        if (PREVIEWS && w >= 1024) {
          const canvas = p.locator('#stage canvas');
          if (await canvas.count()) {
            const suffix = theme === 'dark' ? '' : '-light';
            await canvas.first().screenshot({ ...JPEG, path: join(PREVIEWS, `${id}${suffix}.jpg`) });
          }
        }
      }
      await context.close();
    }
  }
  console.log(`audit-ui: ${plates.length} plates, 2 themes, 2 widths`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`audit-ui: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('audit-ui: ok');
