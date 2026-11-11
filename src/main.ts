import './styles/app.css';
import Alpine from 'alpinejs';
import 'flowbite';
import { CATALOGUE, children, entry, ENTRIES, lab as findLab, labsUnder, links, node, roots, search, source,
  trail, under, type Entry, type Lab, type Status, type TaxNode } from './core/catalogue';
import { factCards, facts, pick, spread } from './core/facts';
import { defaults, type Chart, type ParamDef, type Params, type Plate, type Stat, type Theme } from './core/plate';
import { freshSeed } from './core/random';
import { parse as parseShared, serialise } from './core/share';
import type { Stage } from './core/stage';
import { labRunnable, loadLab, loadPlate } from './registry';

type View = 'browse' | 'plate' | 'lab';

const THUMB_CACHE = 'algoglyph:thumb:v3';
const FACTS = facts(CATALOGUE);
const LIVE = ENTRIES.filter((e) => e.status === 'live');
const MOSAIC_SIZE = 9;
// p5 and the stage load with the first plate or thumbnail, not with the catalogue pages
const stageModule = () => import('./core/stage');
// ECharts loads with the first chart a plate publishes
const chartModule = () => import('./core/charts');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Not reactive on purpose: p5 instances must never be wrapped in Alpine proxies.
let stage: Stage | null = null;
let plateCode: Plate | null = null;
let thumbQueue: string[] = [];
// the query of the route being loaded, applied once the plate's controls are known
let pendingQuery = '';
let thumbBusy = false;
let thumbObserver: IntersectionObserver | null = null;

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

interface Route { view: View; key: string; id: string; seed?: number; query: string }

function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const seed = Number(new URLSearchParams(query).get('seed'));
  const s = Number.isInteger(seed) && seed > 0 ? seed : undefined;
  if (parts[0] === 'p' && parts[1] && entry(parts[1])) {
    return { view: 'plate', key: '', id: parts[1], seed: s, query };
  }
  if (parts[0] === 'lab' && parts[1] && findLab(parts[1])) {
    return { view: 'lab', key: '', id: parts[1], seed: s, query };
  }
  if (parts[0] === 'c' && parts.length > 1 && node(parts.slice(1).join('/'))) {
    return { view: 'browse', key: parts.slice(1).join('/'), id: '', query: '' };
  }
  return { view: 'browse', key: '', id: '', query: '' };
}

function cacheGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function cacheSet(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* storage full or blocked */ }
}

interface DrawerLike { hide(): void; isVisible(): boolean }

/**
 * Flowbite's drawer marks the sidebar aria-hidden even where CSS shows it (desktop), and leaves
 * its links focusable when it is hidden (mobile). Keep both true: visible means exposed, hidden
 * means inert.
 */
function syncSidebar(): void {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  if (window.innerWidth >= 1024) {
    if (aside.hasAttribute('aria-hidden')) aside.removeAttribute('aria-hidden');
    aside.inert = false;
  } else {
    aside.inert = aside.getAttribute('aria-hidden') === 'true'
      || (!aside.hasAttribute('aria-modal') && aside.classList.contains('-translate-x-full'));
  }
}

function watchSidebar(): void {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  new MutationObserver(syncSidebar).observe(aside, {
    attributes: true, attributeFilter: ['aria-hidden', 'aria-modal', 'class'],
  });
  window.addEventListener('resize', syncSidebar);
  syncSidebar();
}

function closeDrawer(): void {
  const registry = (window as unknown as {
    FlowbiteInstances?: { getInstance(kind: string, id: string): DrawerLike | undefined };
  }).FlowbiteInstances;
  const drawer = registry?.getInstance('Drawer', 'sidebar');
  if (drawer?.isVisible() && window.innerWidth < 1024) drawer.hide();
}

/** A fixed poster seed per entry, so the gallery looks the same on every visit. */
const posterSeed = (id: string) => 1009 + 7919 * ENTRIES.findIndex((e) => e.id === id);

Alpine.data('app', () => ({
  facts: FACTS,
  factCards: factCards(FACTS),
  wings: roots(),
  labs: CATALOGUE.labs,
  mosaic: spread(LIVE, MOSAIC_SIZE),
  open: Object.fromEntries(CATALOGUE.roots.map((k) => [k, false])) as Record<string, boolean>,
  query: '',
  status: 'all' as Status | 'all',
  view: 'browse' as View,
  nodeKey: '',
  currentId: '',
  defs: [] as ParamDef[],
  params: {} as Params,
  seed: 0,
  stats: [] as Stat[],
  chart: null as Chart | null,
  chartView: 'chart' as 'chart' | 'table',
  running: false,
  loading: false,
  error: '',
  paused: reducedMotion,
  reducedMotion,
  theme: currentTheme(),
  thumbs: {} as Record<string, string>,
  copied: false,
  keys: [
    ['Space', 'Play / pause'], ['.', 'Step one frame'], ['R', 'Reseed'], ['D', 'Default parameters'],
    ['S', 'Save PNG'], ['F', 'Full screen'], ['← →', 'Previous / next live plate'], ['G', 'Collection'],
    ['T', 'Toggle theme'], ['/', 'Search'], ['V', 'Reset the view (where a plate offers it)'],
  ] as [string, string][],

  init() {
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('keydown', (e) => this.key(e));
    thumbObserver = new IntersectionObserver((seen) => {
      for (const s of seen) {
        const id = (s.target as HTMLElement).dataset.thumb;
        if (!id) continue;
        if (s.isIntersecting) this.queueThumb(id);
        else thumbQueue = thumbQueue.filter((x) => x !== id);
      }
    }, { rootMargin: '200px' });
    let hashTimer = 0;
    this.$watch('params', () => {
      if (this.view === 'browse' || !plateCode) return;
      window.clearTimeout(hashTimer);
      hashTimer = window.setTimeout(() => this.writeHash(), 250);
    });
    this.route();
    watchSidebar();
  },

  // ---- catalogue views -------------------------------------------------------------------
  get node(): TaxNode | undefined { return this.nodeKey ? node(this.nodeKey) : undefined; },
  get trail(): TaxNode[] { return this.nodeKey ? trail(this.nodeKey) : []; },
  get current(): Entry | undefined { return this.view === 'plate' ? entry(this.currentId) : undefined; },
  get currentLab(): Lab | undefined { return this.view === 'lab' ? findLab(this.currentId) : undefined; },
  get currentTrail(): TaxNode[] { return this.current ? trail(this.current.taxonomy) : []; },
  children(key: string): TaxNode[] { return children(key); },
  shelves(): TaxNode[] { return this.nodeKey ? children(this.nodeKey) : []; },
  labsHere(): Lab[] { return labsUnder(this.nodeKey); },
  runnable(id: string): boolean { return labRunnable(id); },
  labEntries(l: Lab): Entry[] { return l.entries.map((id) => entry(id)).filter(Boolean) as Entry[]; },
  sourceTitle(id: string): string { return source(id)?.title ?? id; },
  sourceAuthor(id: string): string { return source(id)?.author ?? ''; },
  wingOf(e: Entry): TaxNode | undefined { return node(e.path[0]); },
  linksOf(e: Entry): { entry: Entry; why: string }[] {
    return links(e).slice(0, 18).map((l) => ({ entry: entry(l.id) as Entry, why: l.why }));
  },
  shelfOf(e: Entry): TaxNode | undefined { return node(e.taxonomy); },

  /** The entries the browse view lists: the node's subtree, or every match of a search. */
  shown(): Entry[] {
    const q = this.query.trim();
    if (!this.nodeKey && !q) return [];
    const scope = under(this.nodeKey);
    return search(scope, q).filter((e) => this.status === 'all' || e.status === this.status);
  },
  scopeCount(s: Status | 'all'): number {
    const scope = search(under(this.nodeKey), this.query.trim());
    return s === 'all' ? scope.length : scope.filter((e) => e.status === s).length;
  },
  pct(n: TaxNode): number { return Math.round((100 * n.live) / Math.max(1, n.live + n.planned)); },

  neighbour(offset: number): Entry {
    const i = LIVE.findIndex((p) => p.id === this.currentId);
    return LIVE[(Math.max(0, i) + offset + LIVE.length) % LIVE.length];
  },

  fmt(value: unknown, d: ParamDef): string {
    if (d.kind !== 'range') return String(value);
    const decimals = d.step < 1 ? Math.min(4, Math.ceil(-Math.log10(d.step))) : 0;
    return Number(value).toFixed(decimals);
  },

  go(hash: string) { if (location.hash !== hash) location.hash = hash; },
  openRandom() {
    const p = pick(LIVE.filter((x) => x.id !== this.currentId));
    if (p) this.go(`#/p/${p.id}`);
  },
  onSearch() {
    if (this.view !== 'browse') this.go(this.nodeKey ? `#/c/${this.nodeKey}` : '#/');
    this.$nextTick(() => this.observeThumbs());
  },

  route() {
    closeDrawer();
    const r = parseHash();
    if (r.view === 'browse') {
      stage?.unmount();
      plateCode = null;
      this.view = 'browse';
      this.nodeKey = r.key;
      this.currentId = '';
      this.status = 'all';
      if (r.key) this.open[r.key.split('/')[0]] = true;
      document.title = r.key ? `${node(r.key)?.title} · algoglyph` : 'algoglyph';
      this.$nextTick(() => this.observeThumbs());
      return;
    }
    const changed = r.id !== this.currentId || r.view !== this.view;
    this.view = r.view;
    if (changed) {
      this.currentId = r.id;
      this.stats = [];
      this.resetChart();
      this.defs = [];
      this.error = '';
      plateCode = null;
      stage?.unmount();
      const e = r.view === 'plate' ? entry(r.id) : undefined;
      if (e) this.open[e.path[0]] = true;
      document.title = `${(e?.title ?? findLab(r.id)?.title) ?? ''} · algoglyph`;
      if (e?.status === 'planned') {
        window.scrollTo({ top: 0 });
        return;
      }
    }
    // the route carries every changed knob; a link redraws the same picture (src/core/share.ts)
    pendingQuery = r.query;
    let paramsDiffer = false;
    if (!changed && plateCode) {
      const wanted = { ...defaults(plateCode), ...parseShared(plateCode.params, r.query).params };
      paramsDiffer = plateCode.params.some((d) => wanted[d.key] !== this.params[d.key]);
      if (paramsDiffer) Object.assign(this.params, wanted);
    }
    const seed = r.seed ?? (changed ? freshSeed() : this.seed);
    if (!changed && !paramsDiffer && seed === this.seed && plateCode) return;
    this.seed = seed;
    if (plateCode) this.writeHash();
    void this.load(changed || paramsDiffer);
  },

  async load(changed: boolean) {
    const id = this.currentId;
    const view = this.view;
    if (!plateCode) {
      this.loading = true;
      try {
        const p = view === 'lab' ? await loadLab(id) : await loadPlate(id);
        if (this.currentId !== id || this.view !== view) return;
        if (!p) throw new Error(view === 'lab' ? `this lab needs at least ${CATALOGUE.labMin} live plates` : 'not runnable');
        plateCode = p;
        this.defs = p.params;
        this.params = { ...defaults(p), ...parseShared(p.params, pendingQuery).params };
        this.writeHash();
      } catch (err) {
        this.error = String(err instanceof Error ? err.message : err);
        console.error(err);
        return;
      } finally {
        this.loading = false;
      }
    }
    this.$nextTick(() => {
      void this.mount();
      if (changed) window.scrollTo({ top: 0 });
    });
  },

  writeHash() {
    const query = plateCode ? serialise(plateCode.params, this.params, this.seed) : `seed=${this.seed}`;
    const hash = `#/${this.view === 'lab' ? 'lab' : 'p'}/${this.currentId}?${query}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  },

  canReset: false,
  resetView() { stage?.reset(); },

  async mount(attempt = 0) {
    const host = document.getElementById('stage');
    if (!plateCode || !host) return;
    if (!stage) {
      const { Stage } = await stageModule();
      stage ??= new Stage(host, () => { if (this.view !== 'browse') void this.mount(); });
    }
    if (!plateCode) return;
    if (!stage.ready()) {
      if (attempt < 60) requestAnimationFrame(() => void this.mount(attempt + 1));
      return;
    }
    stage.mount(plateCode, {
      params: this.params,
      seed: this.seed,
      theme: this.theme,
      paused: this.paused,
      onStats: (rows) => { this.stats = rows; },
      onChart: (c) => { this.chart = c; void this.drawChart(); },
      onLoopChange: (running) => { this.running = running; },
    });
    this.canReset = stage.canReset();
  },

  changed(d: ParamDef) { if (d.rebuild) void this.mount(); },
  togglePause() { this.paused = !this.paused; stage?.setPaused(this.paused); },
  step() { this.paused = true; stage?.step(); },
  reseed() { this.seed = freshSeed(); this.writeHash(); void this.mount(); },
  resetParams() {
    if (!plateCode) return;
    Object.assign(this.params, defaults(plateCode));
    void this.mount();
  },
  save() { stage?.save(`algoglyph-${this.currentId}-${this.seed}`); },
  fullscreen() {
    const el = document.getElementById('stage-card');
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  },
  async copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      this.copied = true;
      window.setTimeout(() => { this.copied = false; }, 1500);
    } catch {
      this.copied = false;
    }
  },

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', this.theme === 'dark');
    try { localStorage.setItem('color-theme', this.theme); } catch { /* this page only */ }
    document.dispatchEvent(new CustomEvent('dark-mode', { detail: this.theme }));
    if (this.view !== 'browse') void this.mount();
    void this.drawChart();
    this.thumbs = {};
    thumbQueue = [];
    this.$nextTick(() => this.observeThumbs());
  },

  // ---- charts: what a plate publishes, as an ECharts line chart or as a table -----------------
  async drawChart() {
    const el = document.getElementById('chart');
    if (!this.chart || !el || this.chartView !== 'chart') return;
    const { renderChart } = await chartModule();
    if (this.chart) renderChart(el, JSON.parse(JSON.stringify(this.chart)) as Chart, this.theme);
  },
  resetChart() {
    this.chart = null;
    const el = document.getElementById('chart');
    if (el) void chartModule().then(({ disposeChart }) => disposeChart(el));
  },
  showChart(view: 'chart' | 'table') {
    this.chartView = view;
    if (view === 'chart') this.$nextTick(() => void this.drawChart());
  },
  /** At most twelve rows per series, evenly spaced, for the table view. */
  chartRows(): { series: string; x: string; y: string }[] {
    if (!this.chart) return [];
    const f = (v: number) => (Math.abs(v) >= 1e5 || (Math.abs(v) > 0 && Math.abs(v) < 1e-2) ? v.toExponential(2) : v.toLocaleString('en-US', { maximumFractionDigits: 3 }));
    return this.chart.series.flatMap((s) => spread(s.points, 12).map(([x, y]) => ({ series: s.name, x: f(x), y: f(y) })));
  },

  // ---- lazy thumbnails: rendered for cards in view, one at a time ---------------------------
  observeThumbs() {
    if (!thumbObserver) return;
    thumbObserver.disconnect();
    document.querySelectorAll<HTMLElement>('[data-thumb]').forEach((el) => thumbObserver?.observe(el));
  },
  queueThumb(id: string) {
    if (this.thumbs[id] || thumbQueue.includes(id)) return;
    const cached = cacheGet(`${THUMB_CACHE}:${this.theme}:${id}`);
    if (cached) { this.thumbs[id] = cached; return; }
    thumbQueue.push(id);
    void this.drainThumbs();
  },
  async drainThumbs() {
    if (thumbBusy) return;
    thumbBusy = true;
    try {
      while (thumbQueue.length) {
        const id = thumbQueue.shift() as string;
        const theme = this.theme;
        try {
          const p = await loadPlate(id);
          if (!p) continue;
          const { thumbnail } = await stageModule();
          const url = await thumbnail(p, defaults(p), posterSeed(id), theme);
          if (theme !== this.theme) continue;
          this.thumbs[id] = url;
          cacheSet(`${THUMB_CACHE}:${theme}:${id}`, url);
        } catch (err) {
          console.error(`thumbnail ${id}`, err);
        }
        await new Promise((r) => window.setTimeout(r, 16));
      }
    } finally {
      thumbBusy = false;
    }
  },

  key(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.closest('input, select, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey)) return;
    const k = e.key.toLowerCase();
    if (k === 't') this.toggleTheme();
    else if (k === 'g') this.go('#/');
    else if (k === '/') {
      e.preventDefault();
      const id = window.innerWidth >= 768 ? 'topbar-search' : 'browse-search';
      document.getElementById(id)?.focus();
    }
    if (this.view === 'browse' || !plateCode) return;
    if (k === ' ') { e.preventDefault(); this.togglePause(); } else if (k === '.') this.step();
    else if (k === 'r') this.reseed();
    else if (k === 'd') this.resetParams();
    else if (k === 'v') this.resetView();
    else if (k === 's') this.save();
    else if (k === 'f') this.fullscreen();
    else if (k === 'arrowleft' && this.view === 'plate') this.go(`#/p/${this.neighbour(-1).id}`);
    else if (k === 'arrowright' && this.view === 'plate') this.go(`#/p/${this.neighbour(1).id}`);
  },
}));

declare global {
  interface Window { Alpine: typeof Alpine }
}

window.Alpine = Alpine;
Alpine.start();
