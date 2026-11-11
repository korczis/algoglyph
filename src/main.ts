import './styles/app.css';
import Alpine from 'alpinejs';
import 'flowbite';
import { defaults, type Category, type ParamDef, type Params, type Plate, type Stat,
  type Theme } from './core/plate';
import { freshSeed } from './core/random';
import { Stage, thumbnail } from './core/stage';
import { CATEGORIES, PLATES, plate as findPlate } from './plates';

type View = 'gallery' | 'plate';
type Meta = Omit<Plate, 'create'>;

const THUMB_CACHE = 'algoglyph:thumb:v1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Not reactive on purpose: p5 instances must never be wrapped in Alpine proxies.
let stage: Stage | null = null;
let thumbRun = 0;

function meta(p: Plate): Meta {
  const { create: _create, ...rest } = p;
  return rest;
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function parseHash(): { view: View; id?: string; seed?: number } {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [head, id] = path.split('/');
  if (head === 'p' && id && findPlate(id)) {
    const seed = Number(new URLSearchParams(query).get('seed'));
    return { view: 'plate', id, seed: Number.isInteger(seed) && seed > 0 ? seed : undefined };
  }
  return { view: 'gallery' };
}

function cacheGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // storage full or blocked: thumbnails are rendered again next time
  }
}

interface DrawerLike {
  hide(): void;
  isVisible(): boolean;
}

/**
 * Flowbite's drawer marks the sidebar aria-hidden even where CSS shows it (desktop), and leaves
 * its links focusable when it is hidden (mobile). Keep both true: visible means exposed, hidden
 * means inert.
 */
function syncSidebar(): void {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  const desktop = window.innerWidth >= 1024;
  if (desktop) {
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
    attributes: true,
    attributeFilter: ['aria-hidden', 'aria-modal', 'class'],
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

Alpine.data('app', () => ({
  plates: PLATES.map(meta),
  categories: CATEGORIES,
  open: { algorithms: true, mathematics: true, physics: true } as Record<Category, boolean>,
  query: '',
  filter: 'all' as Category | 'all',
  view: 'gallery' as View,
  currentId: '',
  params: {} as Params,
  seed: 0,
  stats: [] as Stat[],
  running: false,
  paused: reducedMotion,
  reducedMotion,
  theme: currentTheme(),
  thumbs: {} as Record<string, string>,
  copied: false,
  keys: [
    ['Space', 'Play / pause'],
    ['.', 'Step one frame'],
    ['R', 'Reseed'],
    ['D', 'Default parameters'],
    ['S', 'Save PNG'],
    ['F', 'Full screen'],
    ['← →', 'Previous / next plate'],
    ['G', 'Gallery'],
    ['T', 'Toggle theme'],
  ] as [string, string][],

  init() {
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('keydown', (e) => this.key(e));
    this.route();
    // Flowbite initialises its static components (drawer, modal, tooltip) on window load
    this.$nextTick(() => this.renderThumbs());
    watchSidebar();
  },

  get current(): Meta | null {
    return this.plates.find((p) => p.id === this.currentId) ?? null;
  },

  label(cat: Category): string {
    return CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
  },

  byCategory(cat: Category): Meta[] {
    return this.plates.filter((p) => p.category === cat);
  },

  shown(): Meta[] {
    const q = this.query.trim().toLowerCase();
    return this.plates.filter((p) => (this.filter === 'all' || p.category === this.filter)
      && (!q || [p.title, p.summary, ...p.tags].some((s) => s.toLowerCase().includes(q))));
  },

  neighbour(offset: number): Meta {
    const i = this.plates.findIndex((p) => p.id === this.currentId);
    return this.plates[(i + offset + this.plates.length) % this.plates.length];
  },

  fmt(value: unknown, d: ParamDef): string {
    if (d.kind !== 'range') return String(value);
    const decimals = d.step < 1 ? Math.min(4, Math.ceil(-Math.log10(d.step))) : 0;
    return Number(value).toFixed(decimals);
  },

  go(hash: string) {
    if (location.hash !== hash) location.hash = hash;
  },

  route() {
    closeDrawer();
    const r = parseHash();
    if (r.view === 'gallery' || !r.id) {
      this.view = 'gallery';
      this.currentId = '';
      stage?.unmount();
      document.title = 'algoglyph';
      return;
    }
    const changed = r.id !== this.currentId;
    if (changed) {
      const plate = findPlate(r.id) as Plate;
      this.currentId = r.id;
      this.params = defaults(plate);
      this.stats = [];
      document.title = `${plate.title} · algoglyph`;
    }
    const seed = r.seed ?? (changed ? freshSeed() : this.seed);
    if (!changed && seed === this.seed && this.view === 'plate') return;
    this.seed = seed;
    this.view = 'plate';
    this.writeHash();
    this.$nextTick(() => {
      this.mount();
      if (changed) window.scrollTo({ top: 0 });
    });
  },

  writeHash() {
    const hash = `#/p/${this.currentId}?seed=${this.seed}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  },

  mount(attempt = 0) {
    const plate = findPlate(this.currentId);
    const host = document.getElementById('stage');
    if (!plate || !host) return;
    stage ??= new Stage(host, () => {
      if (this.view === 'plate') this.mount();
    });
    if (!stage.ready()) {
      // the plate section is still hidden; mount once it has a width
      if (attempt < 60) requestAnimationFrame(() => this.mount(attempt + 1));
      return;
    }
    stage.mount(plate, {
      params: this.params,
      seed: this.seed,
      theme: this.theme,
      paused: this.paused,
      onStats: (rows) => {
        this.stats = rows;
      },
      onLoopChange: (running) => {
        this.running = running;
      },
    });
  },

  changed(d: ParamDef) {
    if (d.rebuild) this.mount();
  },

  togglePause() {
    this.paused = !this.paused;
    stage?.setPaused(this.paused);
  },

  step() {
    this.paused = true;
    stage?.step();
  },

  reseed() {
    this.seed = freshSeed();
    this.writeHash();
    this.mount();
  },

  resetParams() {
    const plate = findPlate(this.currentId);
    if (!plate) return;
    Object.assign(this.params, defaults(plate));
    this.mount();
  },

  save() {
    stage?.save(`algoglyph-${this.current?.no}-${this.currentId}-${this.seed}`);
  },

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
      window.setTimeout(() => {
        this.copied = false;
      }, 1500);
    } catch {
      this.copied = false;
    }
  },

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', this.theme === 'dark');
    try {
      localStorage.setItem('color-theme', this.theme);
    } catch {
      // the choice then lasts for this page only
    }
    document.dispatchEvent(new CustomEvent('dark-mode', { detail: this.theme }));
    if (this.view === 'plate') this.mount();
    this.thumbs = {};
    this.renderThumbs();
  },

  async renderThumbs() {
    const run = ++thumbRun;
    const theme = this.theme;
    for (const [i, plate] of PLATES.entries()) {
      if (run !== thumbRun) return;
      const key = `${THUMB_CACHE}:${theme}:${plate.id}`;
      const cached = cacheGet(key);
      if (cached) {
        this.thumbs[plate.id] = cached;
        continue;
      }
      try {
        // posters use a fixed seed per plate, so the gallery looks the same on every visit
        const url = await thumbnail(plate, defaults(plate), 1009 + i * 7919, theme);
        if (run !== thumbRun) return;
        this.thumbs[plate.id] = url;
        cacheSet(key, url);
      } catch (err) {
        console.error(`thumbnail ${plate.id}`, err);
      }
      await new Promise((r) => window.setTimeout(r, 16));
    }
  },

  key(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.closest('input, select, textarea, [contenteditable]') || e.metaKey || e.ctrlKey
      || e.altKey)) return;
    const k = e.key.toLowerCase();
    if (k === 't') this.toggleTheme();
    else if (k === 'g') this.go('#/');
    if (this.view !== 'plate') return;
    if (k === ' ') {
      e.preventDefault();
      this.togglePause();
    } else if (k === '.') this.step();
    else if (k === 'r') this.reseed();
    else if (k === 'd') this.resetParams();
    else if (k === 's') this.save();
    else if (k === 'f') this.fullscreen();
    else if (k === 'arrowleft') this.go(`#/p/${this.neighbour(-1).id}`);
    else if (k === 'arrowright') this.go(`#/p/${this.neighbour(1).id}`);
  },
}));

declare global {
  interface Window {
    Alpine: typeof Alpine;
  }
}

window.Alpine = Alpine;
Alpine.start();
