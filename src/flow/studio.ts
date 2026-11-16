// The flow editor (RFC §8, §9): a projection of the store, never its owner. It draws nodes as
// Flowbite cards over one SVG cable layer, and every gesture becomes an intent the store
// validates — a connection, a slider, a dragged point. Ports are buttons, so a connection can
// be made with the keyboard (focus an output, Enter, focus an input, Enter) or from the
// inspector's per-input menus, which list only what canConnect accepts. Text a reader supplies
// is only ever set as textContent or a value, never parsed as markup.
import { entry } from '../core/catalogue';
import type { Chart, ParamDef, Theme } from '../core/plate';
import { GROUNDS, palette, ramp, type RGB } from '../core/palette';
import { sha256Hex, utf8Length } from '../core/data';
import {
  canConnect, check, decodeGraph, edgeKey, encodeGraph, parseGraph, serialiseGraph,
  type Edge, type GraphDoc, type NodeInstance,
} from './graph';
import type { AnyNodeDef, Category, PortDecl } from './node';
import { coverage, tally, type Level } from './derive';
import { ADAPTERS, DECLARED, inferSchema, POINT_BOX, REGISTRY, seriesCsv, type PointSet, type Schema } from './nodes';
import { cardHeight, HEAD_H, layout, NODE_W, PORT_H, PRESETS, instance } from './presets';
import { Runtime, type Execution, type NodeTrace } from './runtime';
import { FlowStore, type Commit, type Intent, type Origin } from './store';
import { show, type PointsValue, type PortType, type RecordValue, type SeriesValue, type Value } from './types';

const reg = REGISTRY;
const HEAD = HEAD_H;
const ROW = PORT_H;
/** The smallest zoom Fit chooses: port rows stay 24 px apart (WCAG 2.5.8 target size). */
const MIN_FIT = 24 / PORT_H + 0.01;
const chartModule = () => import('../core/charts');

type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

/** Create an element; strings become text nodes, never markup. */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const rgb = (c: RGB) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const fmt = (v: number) => (!Number.isFinite(v) ? String(v) : Math.abs(v) >= 1e5 || (v !== 0 && Math.abs(v) < 1e-3)
  ? v.toExponential(3) : Number(v.toPrecision(6)).toLocaleString('en-US', { maximumFractionDigits: 6 }));

const BTN = 'inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-primary-700 focus:z-10 focus:ring-4 focus:ring-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700';
const BTN_PRIMARY = 'inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white rounded-lg bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 dark:bg-primary-700 dark:hover:bg-primary-800 dark:focus:ring-primary-800';
const INPUT = 'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500';
const LABEL = 'block mb-1 text-sm font-medium text-gray-900 dark:text-white';
const CARD = 'bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700';

const BADGE: Record<NodeTrace['status'] | 'idle', string> = {
  done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  waiting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  blocked: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  idle: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};
const CAT: Record<Category, string> = { provider: 'Source', processor: 'Processor', sink: 'View' };
/** Badges of the provenance levels (RFC §5); the level is always written out, never colour alone. */
const LEVEL: Record<Level, string> = {
  declared: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  derived: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  inferred: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
};
const LEVEL_TEXT: Record<Level, string> = {
  declared: 'a node written for it names it',
  derived: 'an engine adapter runs it from the catalogue',
  inferred: 'not runnable yet: the reason, read from the code',
};
/** Cable dash by kind of value, so a cable's type does not rest on colour alone. */
const DASH: Record<PortType['kind'], string> = { series: '', points: '6 4', table: '2 4', record: '10 3 2 3' };

export interface StudioOptions {
  /** The route's query (`g=<token>`, `preset=<id>`), read once at mount. */
  query: string;
  theme(): Theme;
  /** Writes the canonical link of the current graph (the address bar), without navigating. */
  writeLink(query: string): void;
}

export interface Studio { unmount(): void }

interface Side { text: string; digest: string; name: string }

export function mountStudio(host: HTMLElement, opt: StudioOptions): Studio {
  const q = new URLSearchParams(opt.query);
  let initial: GraphDoc = PRESETS[0].build(reg);
  let notice = '';
  const token = q.get('g');
  if (token) {
    const r = decodeGraph(token, reg);
    if (r.ok) initial = r.doc;
    else notice = `The link's graph was refused: ${r.errors[0]}. The first example is shown instead.`;
  } else {
    const p = PRESETS.find((x) => x.id === q.get('preset'));
    if (p) initial = p.build(reg);
  }
  const store = new FlowStore(reg, initial);
  // a reader's attached text: this tab's memory only, never in the document, a link or storage
  const sides = new Map<string, Side>();
  const runtime = new Runtime(reg, (id) => sides.get(id));
  let exec: Execution | null = null;
  let runMs = 0;
  let selected: string | null = null;
  let armed: { node: string; port: string } | null = null;
  let zoom = 1;
  let disposed = false;
  let proposal: Record<string, Schema> = {};

  // ---- layout of the page ----------------------------------------------------------------------
  const status = h('p', { role: 'status', 'aria-live': 'polite', class: 'text-sm text-gray-700 dark:text-gray-300 min-h-5', 'data-flow-status': true });
  const runInfo = h('span', { class: 'text-sm text-gray-600 dark:text-gray-400', 'data-flow-run': true });
  const undoBtn = h('button', { type: 'button', class: BTN, onclick: () => announce(store.undo()) }, 'Undo');
  const redoBtn = h('button', { type: 'button', class: BTN, onclick: () => announce(store.redo()) }, 'Redo');
  const presetSel = h('select', { id: 'flow-preset', class: `${INPUT} w-auto`, onchange: () => loadPreset(presetSel.value) },
    ...PRESETS.map((p) => h('option', { value: p.id }, p.title)));
  const importInput = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'flow-import', onchange: () => void importFile() });
  const toolbar = h('div', { class: `${CARD} p-3 mb-4 flex flex-wrap items-center gap-2` },
    h('label', { for: 'flow-preset', class: 'text-sm font-medium text-gray-900 dark:text-white' }, 'Example'), presetSel,
    undoBtn, redoBtn,
    h('button', { type: 'button', class: BTN, onclick: () => dispatch({ type: 'graph.load', doc: layout(store.graph, reg) }, 'editor') }, 'Auto layout'),
    h('button', { type: 'button', class: BTN, onclick: () => setZoom(zoom / 1.25), 'aria-label': 'Zoom out' }, '−'),
    h('button', { type: 'button', class: BTN, onclick: () => setZoom(zoom * 1.25), 'aria-label': 'Zoom in' }, '+'),
    h('button', { type: 'button', class: BTN, onclick: () => fit() }, 'Fit'),
    h('button', { type: 'button', class: BTN, onclick: () => void copyLink() }, 'Copy link'),
    h('button', { type: 'button', class: BTN, onclick: () => exportJson() }, 'Export JSON'),
    h('label', { for: 'flow-import', class: `${BTN} cursor-pointer` }, 'Import JSON'), importInput,
    runInfo);

  const search = h('input', { type: 'search', id: 'flow-search', class: INPUT, placeholder: 'Search nodes', oninput: () => renderPalette() });
  const paletteList = h('div', { class: 'mt-3 space-y-4 max-h-72 2xl:max-h-[34rem] overflow-y-auto', tabindex: 0, role: 'region', 'aria-label': 'Node list' });
  const paletteCard = h('section', { class: `${CARD} p-4`, 'aria-labelledby': 'flow-palette-title' },
    h('h2', { id: 'flow-palette-title', class: 'mb-3 text-base font-semibold text-gray-900 dark:text-white' }, 'Nodes'),
    h('label', { for: 'flow-search', class: 'sr-only' }, 'Search nodes'), search, paletteList);

  const edgesSvg = s('svg', { class: 'absolute inset-0 pointer-events-none', 'aria-hidden': 'true' });
  const nodeLayer = h('div', { class: 'absolute inset-0' });
  const inner = h('div', { class: 'relative origin-top-left' }, edgesSvg as unknown as Node, nodeLayer);
  const canvas = h('div', {
    class: 'order-first 2xl:order-none md:col-span-2 2xl:col-span-1 relative overflow-auto h-[30rem] lg:h-[40rem] bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 touch-pan-x touch-pan-y',
    role: 'region', 'aria-label': 'Graph canvas', tabindex: 0, 'data-flow-canvas': true,
  }, inner);
  const inspector = h('section', { class: `${CARD} p-4`, 'aria-labelledby': 'flow-inspector-title', 'data-flow-inspector': true });

  const coverageCard = coveragePanel();

  const root = h('div', { class: 'flow-studio', 'data-flow': true },
    toolbar, status,
    h('div', { class: 'grid gap-4 md:grid-cols-2 2xl:grid-cols-[15rem_minmax(0,1fr)_19rem] items-start' }, paletteCard, canvas, inspector),
    coverageCard);
  host.replaceChildren(root);

  // ---- catalogue coverage (derived on each open, never stored) ---------------------------------
  function coveragePanel(): HTMLElement {
    const rows = coverage(DECLARED, ADAPTERS);
    const t = tally(rows);
    const list = h('ul', { class: 'space-y-1 text-sm', 'data-flow-coverage-list': true });
    const scroller = h('div', { class: 'mt-3 max-h-96 overflow-y-auto', tabindex: 0, role: 'region', 'aria-label': 'Entries by level' }, list);
    const filter = h('select', { id: 'flow-coverage-level', class: `${INPUT} w-auto`, onchange: () => fill() },
      ...(['inferred', 'derived', 'declared'] as Level[]).map((l) => h('option', { value: l }, `${l[0].toUpperCase()}${l.slice(1)} (${t[l]})`)));
    function fill() {
      const level = filter.value as Level;
      list.replaceChildren(...rows.filter((r) => r.level === level).map((r) => h('li', { class: 'py-1 border-b border-gray-100 dark:border-gray-700', 'data-flow-coverage': r.level },
        h('a', { href: `#/p/${r.id}`, class: 'font-medium text-primary-700 hover:underline dark:text-primary-500' }, r.title),
        h('span', { class: 'ms-2 text-xs text-gray-600 dark:text-gray-400' }, `${r.engine} engine`),
        h('span', { class: 'block text-xs text-gray-700 dark:text-gray-300' }, r.node ? `${r.reason} (node ${r.node})` : r.reason),
        r.proposal ? h('span', { class: 'block text-xs text-gray-600 dark:text-gray-400' }, `Proposed: ${r.proposal}`) : '')));
    }
    const details = h('details', { class: `${CARD} p-4 mt-4`, 'data-flow-coverage-panel': true, ontoggle: () => { if (details.open && !list.childElementCount) fill(); } },
      h('summary', { class: 'cursor-pointer text-base font-semibold text-gray-900 dark:text-white' }, 'Catalogue coverage'),
      h('p', { class: 'mt-2 text-sm text-gray-700 dark:text-gray-300' },
        'Every live entry of the catalogue, at the level the flow can run it. Nodes are derived from the catalogue by one adapter per engine; an entry no adapter runs is inferred, with the reason.'),
      h('ul', { class: 'mt-2 flex flex-wrap gap-2' }, ...(['declared', 'derived', 'inferred'] as Level[]).map((l) =>
        h('li', { class: `text-xs font-medium px-2 py-0.5 rounded-sm ${LEVEL[l]}`, title: LEVEL_TEXT[l], 'data-flow-tally': l }, `${l}: ${t[l]}`))),
      h('div', { class: 'mt-3 flex items-center gap-2' }, h('label', { for: 'flow-coverage-level', class: 'text-sm font-medium text-gray-900 dark:text-white' }, 'Level'), filter),
      scroller);
    return details;
  }

  // ---- store → view ----------------------------------------------------------------------------
  function announce(r: { ok: true } | { ok: false; reason: string }, ok = '') {
    status.textContent = r.ok ? ok : `Refused: ${r.reason}`;
    status.dataset.refused = r.ok ? '' : 'true';
  }

  function dispatch(it: Intent, origin: Origin, txn?: string, ok = '') {
    const r = store.dispatch(it, { origin, txn });
    announce(r, ok);
    return r;
  }

  let linkTimer = 0;
  const unsubscribe = store.subscribe((c: Commit) => {
    undoBtn.disabled = !store.canUndo;
    redoBtn.disabled = !store.canRedo;
    const structural = !(c.intent.startsWith('node.intent') || c.intent === 'param.set');
    if (structural) renderGraph();
    else renderEdges();
    if (store.computeRevision === c.revision) void execute();
    renderInspector();
    window.clearTimeout(linkTimer);
    linkTimer = window.setTimeout(() => opt.writeLink(`g=${encodeGraph(store.graph)}`), 300);
  });

  let pending = false;
  let inFlight: Promise<void> | null = null;
  /** Run the latest revision; a run started while one is in flight supersedes it. */
  async function execute() {
    if (inFlight) { pending = true; runtime.cancel(); }
    const t0 = performance.now();
    const doc = store.graph;
    const job = (async () => {
      const x = await runtime.run(doc);
      if (!x || disposed || doc !== store.graph) return;
      exec = x;
      runMs = performance.now() - t0;
      renderResults();
    })();
    inFlight = job;
    await job;
    if (inFlight === job) inFlight = null;
    if (pending && !inFlight) { pending = false; void execute(); }
  }

  // ---- palette ---------------------------------------------------------------------------------
  function renderPalette() {
    const term = search.value.trim().toLowerCase();
    const groups: Category[] = ['provider', 'processor', 'sink'];
    paletteList.replaceChildren(...groups.map((g) => {
      const defs = [...reg.values()].filter((d) => d.category === g && `${d.title} ${d.summary}`.toLowerCase().includes(term));
      if (!defs.length) return '';
      return h('div', {},
        h('h3', { class: 'mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400' }, CAT[g]),
        h('ul', { class: 'space-y-2' }, ...defs.map((d) => h('li', {},
          h('button', {
            type: 'button', class: 'w-full p-2 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700',
            onclick: () => addNode(d), 'data-flow-add': d.type,
          },
          h('span', { class: 'block text-sm font-medium text-gray-900 dark:text-white' }, h('span', { class: 'sr-only' }, 'Add '), d.title),
          h('span', { class: 'block text-xs text-gray-600 dark:text-gray-400' }, d.summary),
          d.origin ? h('span', { class: `mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-sm ${LEVEL.derived}`, 'data-flow-derived': d.origin.entries.length },
            `Derived from the catalogue: ${d.origin.entries.length} kernels`) : '')))));
    }));
  }

  function addNode(d: AnyNodeDef) {
    let k = 1;
    while (store.graph.nodes.some((n) => n.id === `${d.type}${k === 1 ? '' : `-${k}`}`)) k++;
    const id = `${d.type}${k === 1 ? '' : `-${k}`}`;
    const right = Math.max(24, ...store.graph.nodes.map((n) => n.at[0] + NODE_W + 72));
    const top = Math.min(...store.graph.nodes.map((n) => n.at[1]), 24);
    const n = { ...instance(reg, id, d.type), at: [right, top] as [number, number] };
    if (dispatch({ type: 'node.add', node: n }, 'editor', undefined, `${d.title} added as ${id}.`).ok) {
      selected = id;
      renderGraph();
      renderInspector();
      canvas.scrollTo({ left: right * zoom - 40, top: 0 });
    }
  }

  // ---- graph -----------------------------------------------------------------------------------
  const portY = (n: NodeInstance, i: number) => n.at[1] + HEAD + i * ROW + ROW / 2;
  const outIndex = (d: AnyNodeDef, port: string) => d.outputs.findIndex((p) => p.id === port);
  const inIndex = (d: AnyNodeDef, port: string) => d.inputs.findIndex((p) => p.id === port);
  const previews = new Map<string, HTMLElement>();
  const badges = new Map<string, HTMLElement>();
  const reasons = new Map<string, HTMLElement>();

  function bounds(): [number, number] {
    const w = Math.max(800, ...store.graph.nodes.map((n) => n.at[0] + NODE_W + 48));
    const hgt = Math.max(560, ...store.graph.nodes.map((n) => n.at[1] + cardHeight(reg, n.type) + 48));
    return [w, hgt];
  }

  function setZoom(z: number) {
    zoom = Math.min(1.6, Math.max(0.4, z));
    const [w, hgt] = bounds();
    inner.style.transform = `scale(${zoom})`;
    inner.style.width = `${w}px`;
    inner.style.height = `${hgt}px`;
    // the scroll area follows the scaled size
    inner.style.marginRight = `${w * (zoom - 1)}px`;
    inner.style.marginBottom = `${hgt * (zoom - 1)}px`;
  }

  function fit() {
    const [w, hgt] = bounds();
    // never so small that a port falls under WCAG 2.5.8's 24 px target; the canvas scrolls instead
    setZoom(Math.max(MIN_FIT, Math.min(canvas.clientWidth / w, canvas.clientHeight / hgt, 1)));
    canvas.scrollTo({ left: 0, top: 0 });
  }

  function typeOfOut(node: string, port: string): PortType | undefined {
    return check(store.graph, reg).types.get(node)?.[port];
  }

  function portButton(n: NodeInstance, d: AnyNodeDef, p: PortDecl, dir: 'in' | 'out', i: number): HTMLElement {
    const t = dir === 'out' ? typeOfOut(n.id, p.id) ?? p.type : p.type;
    const isArmed = armed && armed.node === n.id && armed.port === p.id && dir === 'out';
    let compat = '';
    let why = '';
    if (armed && dir === 'in') {
      const r = canConnect(store.graph, { from: armed, to: { node: n.id, port: p.id } }, reg);
      compat = r.ok ? 'ok' : 'no';
      why = r.ok ? 'compatible' : r.reason;
    }
    const label = `${dir === 'in' ? 'Input' : 'Output'} ${p.label} of ${d.title} (${n.id}), ${show(t)}${why ? `: ${why}` : ''}`;
    const ring = compat === 'ok' ? 'ring-2 ring-green-500' : compat === 'no' ? 'opacity-40' : '';
    const dot = h('span', {
      class: `inline-block w-3 h-3 border-2 border-gray-500 dark:border-gray-300 ${p.type.kind === 'points' ? 'rotate-45' : 'rounded-full'} ${isArmed ? 'bg-primary-600' : 'bg-white dark:bg-gray-800'}`,
      'aria-hidden': 'true',
    });
    return h('button', {
      type: 'button',
      class: `absolute flex items-center gap-1 h-7 text-xs text-gray-700 dark:text-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 ${ring} ${dir === 'in' ? 'left-0 -translate-x-1.5 pr-2' : 'right-0 translate-x-1.5 pl-2 flex-row-reverse'}`,
      style: `top:${i * ROW}px`,
      'aria-label': label, title: `${show(t)}${why ? ` — ${why}` : ''}`,
      'aria-pressed': dir === 'out' ? String(Boolean(isArmed)) : undefined,
      'data-port': `${n.id}.${p.id}`, 'data-dir': dir, 'data-compat': compat || undefined,
      onclick: (e: Event) => { e.stopPropagation(); onPort(n.id, p.id, dir); },
    }, dot, h('span', {}, p.label));
  }

  function onPort(node: string, port: string, dir: 'in' | 'out') {
    if (dir === 'out') {
      armed = armed && armed.node === node && armed.port === port ? null : { node, port };
      status.textContent = armed ? `Connecting from ${node}.${port}: choose an input, or press Escape.` : '';
      renderGraph();
      focusPort(`${node}.${port}`, 'out');
      return;
    }
    if (!armed) {
      const e = store.graph.edges.find((x) => x.to.node === node && x.to.port === port);
      status.textContent = e ? `${node}.${port} is fed by ${e.from.node}.${e.from.port}; remove it in the inspector.` : 'Choose an output first.';
      selected = node;
      renderInspector();
      return;
    }
    const edge: Edge = { from: armed, to: { node, port } };
    const r = dispatch({ type: 'edge.add', edge }, 'editor', undefined, `Connected ${edgeKey(edge)}.`);
    if (r.ok) armed = null;
    renderGraph();
    focusPort(`${node}.${port}`, 'in');
  }

  function focusPort(key: string, dir: string) {
    nodeLayer.querySelector<HTMLElement>(`[data-port="${CSS.escape(key)}"][data-dir="${dir}"]`)?.focus();
  }

  function renderGraph() {
    if (disposed) return;
    const g = store.graph;
    previews.clear(); badges.clear(); reasons.clear();
    nodeLayer.replaceChildren(...g.nodes.map((n) => {
      const d = reg.get(n.type) as AnyNodeDef;
      const rows = Math.max(d.inputs.length, d.outputs.length);
      const badge = h('span', { class: `shrink-0 whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded ${BADGE.idle}`, 'data-flow-badge': true }, 'not run');
      const reason = h('p', { class: 'px-3 pb-2 text-xs text-gray-700 dark:text-gray-300 break-words' });
      const preview = h('div', { class: 'px-3 pb-3' });
      badges.set(n.id, badge); reasons.set(n.id, reason); previews.set(n.id, preview);
      const head = h('div', {
        class: 'flex items-center justify-between gap-2 px-3 h-11 border-b border-gray-200 dark:border-gray-700 cursor-grab select-none',
        onpointerdown: (e: Event) => startDrag(e as PointerEvent, n.id),
      },
      h('h3', { class: 'text-sm font-semibold text-gray-900 dark:text-white truncate' },
        h('span', { class: 'sr-only' }, `${CAT[d.category]}: `), d.title),
      badge);
      const card = h('section', {
        class: `absolute ${CARD} ${selected === n.id ? 'ring-2 ring-primary-500' : ''}`,
        style: `left:${n.at[0]}px;top:${n.at[1]}px;width:${NODE_W}px`,
        'aria-label': `${d.title} (${n.id})`, 'data-node': n.id,
        onclick: () => { selected = n.id; renderInspector(); highlightSelected(); },
      },
      head,
      h('div', { class: 'relative', style: `height:${rows * ROW + 8}px` },
        ...d.inputs.map((p, i) => portButton(n, d, p, 'in', i)),
        ...d.outputs.map((p, i) => portButton(n, d, p, 'out', i))),
      reason, preview,
      h('button', {
        type: 'button', class: 'sr-only focus:not-sr-only focus:m-2 text-xs underline',
        onclick: (e: Event) => { e.stopPropagation(); selected = n.id; renderInspector(); inspector.querySelector<HTMLElement>('h2')?.focus(); },
      }, `Inspect ${n.id}`));
      return card;
    }));
    setZoom(zoom);
    renderEdges();
    renderResults();
  }

  function highlightSelected() {
    for (const c of nodeLayer.querySelectorAll<HTMLElement>('[data-node]')) {
      c.classList.toggle('ring-2', c.dataset.node === selected);
      c.classList.toggle('ring-primary-500', c.dataset.node === selected);
    }
  }

  function renderEdges() {
    const g = store.graph;
    const [w, hgt] = bounds();
    edgesSvg.setAttribute('width', String(w));
    edgesSvg.setAttribute('height', String(hgt));
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const types = check(g, reg).types;
    edgesSvg.replaceChildren(...g.edges.map((e) => {
      const a = byId.get(e.from.node) as NodeInstance;
      const b = byId.get(e.to.node) as NodeInstance;
      const da = reg.get(a.type) as AnyNodeDef;
      const db = reg.get(b.type) as AnyNodeDef;
      const x1 = a.at[0] + NODE_W + 4; const y1 = portY(a, outIndex(da, e.from.port));
      const x2 = b.at[0] - 4; const y2 = portY(b, inIndex(db, e.to.port));
      const dx = Math.max(40, Math.abs(x2 - x1) / 2);
      const up = exec?.nodes.get(e.from.node)?.status;
      const kind = types.get(e.from.node)?.[e.from.port]?.kind ?? 'series';
      const path = s('path', {
        d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
        fill: 'none', 'stroke-width': 2, 'stroke-dasharray': DASH[kind],
        class: up === 'error' || up === 'blocked' ? 'stroke-red-500' : 'stroke-gray-500 dark:stroke-gray-400',
        'data-edge': edgeKey(e),
      });
      return path;
    }));
  }

  let drag: { id: string; dx: number; dy: number; el: HTMLElement } | null = null;
  function startDrag(e: PointerEvent, id: string) {
    const el = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const n = store.graph.nodes.find((x) => x.id === id);
    if (!n || e.button !== 0) return;
    const r = inner.getBoundingClientRect();
    drag = { id, dx: (e.clientX - r.left) / zoom - n.at[0], dy: (e.clientY - r.top) / zoom - n.at[1], el };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!drag) return;
      const rr = inner.getBoundingClientRect();
      const x = Math.max(0, Math.round((ev.clientX - rr.left) / zoom - drag.dx));
      const y = Math.max(0, Math.round((ev.clientY - rr.top) / zoom - drag.dy));
      drag.el.style.left = `${x}px`;
      drag.el.style.top = `${y}px`;
      drag.el.dataset.x = String(x); drag.el.dataset.y = String(y);
    };
    const up = () => {
      const d = drag;
      drag = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (d && d.el.dataset.x) dispatch({ type: 'node.move', id: d.id, at: [Number(d.el.dataset.x), Number(d.el.dataset.y)] }, 'editor');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---- results: badges, reasons and the renderer adapters ------------------------------------
  function inputValue(node: string, port: string): Value | undefined {
    const e = store.graph.edges.find((x) => x.to.node === node && x.to.port === port);
    return e ? exec?.nodes.get(e.from.node)?.outputs[e.from.port] : undefined;
  }

  function renderResults() {
    const total = exec ? [...exec.nodes.values()] : [];
    runInfo.textContent = exec
      ? `Revision ${store.revision} · ${total.filter((t) => !t.cached && t.status === 'done').length} ran, ${total.filter((t) => t.cached).length} reused · ${runMs.toFixed(1)} ms`
      : '';
    for (const n of store.graph.nodes) {
      const t = exec?.nodes.get(n.id);
      const badge = badges.get(n.id);
      const reason = reasons.get(n.id);
      if (badge) {
        const st = t?.status ?? 'idle';
        badge.className = `shrink-0 whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded ${BADGE[st]}`;
        badge.textContent = !t ? 'not run' : t.status === 'done' ? (t.cached ? 'reused' : `ran ${t.ms.toFixed(1)} ms`) : t.status;
        badge.dataset.status = st;
      }
      if (reason) reason.textContent = t?.reason ?? '';
      const d = reg.get(n.type) as AnyNodeDef;
      const pv = previews.get(n.id);
      if (!pv || !d.view) continue;
      if (t?.status !== 'done') { pv.replaceChildren(); continue; }
      if (d.view === 'chart') void drawChart(n, pv);
      else if (d.view === 'scatter') drawScatter(n, pv);
      else if (d.view === 'readout') drawReadout(n, pv);
      else if (d.view === 'export') drawExport(n, pv);
    }
    renderEdges();
    // the inspector's summary follows the run; an open node's controls are never rebuilt under the reader
    if (!selected) renderInspector();
    else {
      const t = exec?.nodes.get(selected);
      const el = inspector.querySelector<HTMLElement>('[data-flow-trace-text]');
      if (el) el.textContent = traceText(selected, t);
    }
  }

  function traceText(id: string, t: NodeTrace | undefined): string {
    return t ? `${t.status}${t.cached ? ', reused' : t.status === 'done' ? `, ${t.ms.toFixed(2)} ms` : ''}, ran ${runtime.runs.get(id) ?? 0} time(s) so far${t.reason ? `. ${t.reason}` : ''}` : 'not run';
  }

  function expandButton(target: HTMLElement, label: string) {
    return h('button', {
      type: 'button', class: 'mt-2 text-xs font-medium text-primary-700 hover:underline dark:text-primary-500',
      onclick: (e: Event) => { e.stopPropagation(); void target.requestFullscreen?.(); }, 'aria-label': `Full screen: ${label}`,
    }, 'Full screen');
  }

  async function drawChart(n: NodeInstance, pv: HTMLElement) {
    const a = inputValue(n.id, 'a') as SeriesValue | undefined;
    const b = inputValue(n.id, 'b') as SeriesValue | undefined;
    if (!a) return;
    const pts = (sv: SeriesValue) => Array.from(sv.values, (v, i) => [sv.index.start + i * sv.index.step, v] as [number, number]);
    const c: Chart = {
      title: n.id,
      x: { label: `axis (${a.index.unit})` },
      y: { label: `value (${a.unit})`, log: n.params.logy === true },
      series: [{ name: a.label, points: pts(a) }, ...(b ? [{ name: b.label, points: pts(b) }] : [])],
    };
    let el = pv.querySelector<HTMLElement>('[data-flow-chart]');
    if (!el) {
      el = h('div', { class: 'w-full h-40 bg-white dark:bg-gray-800', 'data-flow-chart': true, role: 'img', 'aria-label': `Chart of ${a.label}` });
      pv.replaceChildren(el, expandButton(el, `chart ${n.id}`));
    }
    el.setAttribute('aria-label', `Chart of ${c.series.map((x) => x.name).join(' and ')}, ${a.values.length} values in ${a.unit} along ${a.index.unit}`);
    const { renderChart } = await chartModule();
    if (!disposed && el.isConnected) renderChart(el, c, opt.theme());
  }

  function drawReadout(n: NodeInstance, pv: HTMLElement) {
    const r = inputValue(n.id, 'in') as RecordValue | undefined;
    if (!r) return;
    pv.replaceChildren(h('div', { class: 'max-h-52 overflow-y-auto', tabindex: 0, role: 'region', 'aria-label': `Readouts of ${n.id}` }, h('table', { class: 'w-full text-xs text-left text-gray-700 dark:text-gray-300', 'data-flow-readout': n.id },
      h('tbody', {}, ...r.rows.map((x) => h('tr', { class: 'border-b border-gray-100 dark:border-gray-700' },
        h('th', { scope: 'row', class: 'py-1 pr-2 font-medium text-gray-900 dark:text-white' }, x.label),
        h('td', { class: 'py-1 text-right tabular-nums', 'data-value': String(x.value) }, fmt(x.value)),
        h('td', { class: 'py-1 pl-1 text-gray-600 dark:text-gray-400' }, x.unit === '1' ? '' : x.unit)))))));
  }

  function drawExport(n: NodeInstance, pv: HTMLElement) {
    const v = inputValue(n.id, 'in') as SeriesValue | undefined;
    if (!v) return;
    pv.replaceChildren(h('button', {
      type: 'button', class: BTN_PRIMARY,
      onclick: (e: Event) => {
        e.stopPropagation();
        const url = URL.createObjectURL(new Blob([seriesCsv(v)], { type: 'text/csv' }));
        const a = h('a', { href: url, download: `${n.id}.csv` });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = `Saved ${v.values.length} rows as ${n.id}.csv on this device.`;
      },
    }, `Save ${v.values.length} rows as CSV`));
  }

  // The scatter view: a renderer adapter that owns nothing. A drag sends move intents to the
  // node that owns the points (PointsValue.owner); the store validates them; the runtime
  // recomputes the fit; this view redraws from the new values. Arrow keys do the same.
  const SC = { w: 208, h: 180, pad: 10 };
  function drawScatter(n: NodeInstance, pv: HTMLElement) {
    const p = inputValue(n.id, 'points') as PointsValue | undefined;
    const curve = inputValue(n.id, 'curve') as PointsValue | undefined;
    if (!p) return;
    const theme = opt.theme();
    const g = GROUNDS[theme];
    const pal = palette('ember');
    const sx = (x: number) => SC.pad + ((x - POINT_BOX.x[0]) / (POINT_BOX.x[1] - POINT_BOX.x[0])) * (SC.w - 2 * SC.pad);
    const sy = (y: number) => SC.h - SC.pad - ((y - POINT_BOX.y[0]) / (POINT_BOX.y[1] - POINT_BOX.y[0])) * (SC.h - 2 * SC.pad);
    const ix = (px: number) => POINT_BOX.x[0] + ((px - SC.pad) / (SC.w - 2 * SC.pad)) * (POINT_BOX.x[1] - POINT_BOX.x[0]);
    const iy = (py: number) => POINT_BOX.y[0] + ((SC.h - SC.pad - py) / (SC.h - 2 * SC.pad)) * (POINT_BOX.y[1] - POINT_BOX.y[0]);
    let svg = pv.querySelector<SVGSVGElement>('svg[data-flow-scatter]');
    if (!svg) {
      svg = s('svg', { viewBox: `0 0 ${SC.w} ${SC.h}`, class: 'w-full rounded touch-none', 'data-flow-scatter': n.id, role: 'group' });
      const hint = h('p', { class: 'mt-1 text-xs text-gray-600 dark:text-gray-400' }, p.owner ? 'Drag a point, or focus it and use the arrow keys.' : 'These points are a result; only a source\'s points can be moved.');
      pv.replaceChildren(svg as unknown as Node, hint, expandButton(pv, `scatter ${n.id}`));
      attachScatter(svg, n.id, ix, iy);
    }
    svg.setAttribute('aria-label', `Scatter of ${p.xs.length} points${curve ? ` and ${curve.label}` : ''}`);
    const kids: SVGElement[] = [s('rect', { x: 0, y: 0, width: SC.w, height: SC.h, fill: rgb(g.bg) })];
    kids.push(s('line', { x1: sx(0), x2: sx(0), y1: SC.pad, y2: SC.h - SC.pad, stroke: rgb(g.fg), 'stroke-opacity': 0.2 }));
    kids.push(s('line', { x1: SC.pad, x2: SC.w - SC.pad, y1: sy(0), y2: sy(0), stroke: rgb(g.fg), 'stroke-opacity': 0.2 }));
    if (curve) {
      const d = Array.from(curve.xs, (x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(Math.max(POINT_BOX.y[0] * 2, Math.min(POINT_BOX.y[1] * 2, curve.ys[i]))).toFixed(1)}`).join('');
      kids.push(s('path', { d, fill: 'none', stroke: rgb(g.fg), 'stroke-width': 1.5 }));
    }
    for (let i = 0; i < p.xs.length; i++) {
      const c = s('circle', {
        cx: sx(p.xs[i]), cy: sy(p.ys[i]), r: 5, fill: rgb(ramp(pal, 0.35 + (0.5 * i) / Math.max(1, p.xs.length - 1))),
        stroke: rgb(g.fg), 'stroke-width': 1, 'data-i': i,
        ...(p.owner ? { tabindex: 0, role: 'button', 'aria-label': `Point ${i + 1} at x ${fmt(p.xs[i])}, y ${fmt(p.ys[i])}; arrow keys move it`, class: 'cursor-grab focus:outline-none' } : {}),
      });
      kids.push(c);
    }
    const act = document.activeElement;
    const focused = act && svg.contains(act) ? (act as SVGElement).dataset.i : undefined;
    svg.replaceChildren(...kids);
    if (focused !== undefined) svg.querySelector<SVGElement>(`circle[data-i="${focused}"]`)?.focus();
    svg.dataset.owner = p.owner ?? '';
  }

  function attachScatter(svg: SVGSVGElement, viewId: string, ix: (px: number) => number, iy: (py: number) => number) {
    let txn = '';
    let idx = -1;
    let raf = 0;
    let last: [number, number] | null = null;
    const toLocal = (e: PointerEvent): [number, number] => {
      const r = svg.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * SC.w, ((e.clientY - r.top) / r.height) * SC.h];
    };
    const clampBox = (x: number, y: number): [number, number] => [
      Number(Math.min(POINT_BOX.x[1], Math.max(POINT_BOX.x[0], x)).toFixed(3)),
      Number(Math.min(POINT_BOX.y[1], Math.max(POINT_BOX.y[0], y)).toFixed(3)),
    ];
    const send = (i: number, x: number, y: number, t: string) => {
      const owner = svg.dataset.owner;
      if (!owner) return;
      dispatch({ type: 'node.intent', node: owner, name: 'move', payload: { i, x, y } }, 'view', t);
    };
    svg.addEventListener('pointerdown', (e) => {
      const c = (e.target as SVGElement).closest('circle[data-i]') as SVGElement | null;
      if (!c || !svg.dataset.owner) return;
      e.stopPropagation();
      idx = Number(c.dataset.i);
      txn = `drag:${viewId}:${Date.now()}`;
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (idx < 0) return;
      const [px, py] = toLocal(e);
      last = clampBox(ix(px), iy(py));
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (last && idx >= 0) send(idx, last[0], last[1], txn);
        });
      }
    });
    const end = () => {
      if (idx >= 0 && last) send(idx, last[0], last[1], txn);
      idx = -1; last = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('keydown', (e) => {
      const c = (e.target as SVGElement).closest('circle[data-i]') as SVGElement | null;
      const owner = svg.dataset.owner;
      if (!c || !owner) return;
      const step = e.shiftKey ? 0.2 : 0.05;
      const dir: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      const m = dir[e.key];
      if (!m) return;
      e.preventDefault();
      const i = Number(c.dataset.i);
      const node = store.graph.nodes.find((x) => x.id === owner);
      const pt = (node?.state as PointSet | undefined)?.pts[i];
      if (!pt) return;
      const [x, y] = clampBox(pt[0] + m[0], pt[1] + m[1]);
      send(i, x, y, `key:${viewId}:${i}`);
    });
  }

  // ---- inspector ---------------------------------------------------------------------------------
  function control(n: NodeInstance, p: ParamDef): HTMLElement {
    const id = `flow-p-${n.id}-${p.key}`;
    const set = (value: string | number | boolean) => dispatch({ type: 'param.set', node: n.id, key: p.key, value }, 'control', `p:${n.id}:${p.key}`);
    if (p.kind === 'range') {
      const out = h('output', { for: id, class: 'text-sm tabular-nums text-gray-700 dark:text-gray-300' }, `${n.params[p.key]}${p.hint && /^[A-Za-z]+$/.test(p.hint) ? ` ${p.hint}` : ''}`);
      return h('div', {},
        h('div', { class: 'flex justify-between' }, h('label', { for: id, class: LABEL }, p.label), out),
        h('input', {
          id, type: 'range', min: p.min, max: p.max, step: p.step, value: Number(n.params[p.key]),
          class: 'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700',
          oninput: (e: Event) => { const v = Number((e.target as HTMLInputElement).value); out.textContent = String(v); set(v); },
        }),
        p.hint && !/^[A-Za-z]+$/.test(p.hint) ? h('p', { class: 'mt-1 text-xs text-gray-600 dark:text-gray-400' }, p.hint) : '');
    }
    if (p.kind === 'select') {
      const sel = h('select', { id, class: INPUT, onchange: (e: Event) => set((e.target as HTMLSelectElement).value) },
        ...p.options.map((o) => h('option', { value: o.value, selected: o.value === n.params[p.key] }, o.label)));
      return h('div', {}, h('label', { for: id, class: LABEL }, p.label), sel);
    }
    return h('div', { class: 'flex items-center' },
      h('input', { id, type: 'checkbox', checked: n.params[p.key] === true, class: 'w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600', onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }),
      h('label', { for: id, class: 'ml-2 text-sm font-medium text-gray-900 dark:text-gray-300' }, p.label));
  }

  /** Every output in the graph that canConnect accepts into this input. */
  function sourcesFor(node: string, port: string): { edge: Edge; ok: boolean; reason: string }[] {
    const g = store.graph;
    const current = g.edges.find((e) => e.to.node === node && e.to.port === port);
    const base: GraphDoc = current ? { ...g, edges: g.edges.filter((e) => e !== current) } : g;
    const out: { edge: Edge; ok: boolean; reason: string }[] = [];
    for (const m of g.nodes) {
      if (m.id === node) continue;
      for (const p of (reg.get(m.type) as AnyNodeDef).outputs) {
        const edge = { from: { node: m.id, port: p.id }, to: { node, port } };
        const r = canConnect(base, edge, reg);
        out.push({ edge, ok: r.ok, reason: r.ok ? '' : r.reason });
      }
    }
    return out;
  }

  function connections(n: NodeInstance, d: AnyNodeDef): HTMLElement {
    const g = store.graph;
    const rows = d.inputs.map((p) => {
      const id = `flow-in-${n.id}-${p.id}`;
      const current = g.edges.find((e) => e.to.node === n.id && e.to.port === p.id);
      const opts = sourcesFor(n.id, p.id);
      const sel = h('select', {
        id, class: INPUT, 'data-flow-input': `${n.id}.${p.id}`,
        onchange: (e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          const g2 = store.graph;
          const cur = g2.edges.find((x) => x.to.node === n.id && x.to.port === p.id);
          const next = v ? { from: { node: v.split('.')[0], port: v.split('.')[1] }, to: { node: n.id, port: p.id } } : null;
          // replacing a connection is one change: both edges in one graph, validated whole
          const edges = [...g2.edges.filter((x) => x !== cur), ...(next ? [next] : [])];
          dispatch({ type: 'graph.load', doc: { ...g2, edges } }, 'editor', undefined, next ? `Connected ${edgeKey(next)}.` : `Disconnected ${p.label}.`);
        },
      },
      h('option', { value: '' }, 'Not connected'),
      ...opts.map((o) => h('option', {
        value: `${o.edge.from.node}.${o.edge.from.port}`, disabled: !o.ok,
        selected: Boolean(current && current.from.node === o.edge.from.node && current.from.port === o.edge.from.port),
      }, `${o.edge.from.node}.${o.edge.from.port}${o.ok ? '' : ` — ${o.reason}`}`)));
      return h('div', {}, h('label', { for: id, class: LABEL }, `${p.label}: ${show(p.type)}${p.required ? '' : ' (optional)'}`), sel);
    });
    const outs = d.outputs.map((p) => {
      const t = typeOfOut(n.id, p.id) ?? p.type;
      const to = g.edges.filter((e) => e.from.node === n.id && e.from.port === p.id);
      return h('li', { class: 'text-sm text-gray-700 dark:text-gray-300' },
        h('span', { class: 'font-medium text-gray-900 dark:text-white' }, p.label), ` ${show(t)} → `,
        to.length ? to.map((e) => `${e.to.node}.${e.to.port}`).join(', ') : 'nothing');
    });
    return h('div', { class: 'space-y-3' },
      h('h3', { class: 'text-sm font-semibold text-gray-900 dark:text-white' }, 'Connections'), ...rows,
      outs.length ? h('ul', { class: 'space-y-1' }, ...outs) : '');
  }

  function csvPanel(n: NodeInstance): HTMLElement {
    const side = sides.get(n.id);
    const ta = h('textarea', { id: `flow-csv-${n.id}`, rows: 4, class: INPUT, placeholder: 'time,value\n0,1.5\n1,2.25' });
    const file = h('input', { type: 'file', id: `flow-csv-file-${n.id}`, accept: '.csv,text/csv', class: 'block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600' });
    const attach = async (text: string, name: string) => {
      if (utf8Length(text) > 256 * 1024) { status.textContent = 'Refused: the table is over 256 KB.'; return; }
      sides.set(n.id, { text, digest: sha256Hex(text), name });
      const inf = inferSchema(text);
      if (typeof inf === 'string') status.textContent = `Attached, but: ${inf}`;
      else { proposal = { ...proposal, [n.id]: inf }; status.textContent = `Attached ${name}. Check the proposed units, then approve the schema.`; }
      renderInspector();
      void execute();
    };
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      if (f.size > 256 * 1024) { status.textContent = 'Refused: the file is over 256 KB and was not read.'; return; }
      await attach(await f.text(), f.name);
    });
    const schema = proposal[n.id] ?? (n.state as Schema | null);
    const unitInputs = (schema?.columns ?? []).map((c, i) => {
      const id = `flow-unit-${n.id}-${i}`;
      return h('div', { class: 'flex items-center gap-2' },
        h('label', { for: id, class: 'w-24 text-sm text-gray-900 dark:text-white truncate' }, c.key),
        h('input', { id, class: INPUT, value: c.unit, 'data-key': c.key, 'aria-label': `Unit of ${c.key}` }));
    });
    const approve = h('button', {
      type: 'button', class: BTN_PRIMARY,
      onclick: () => {
        const columns = [...inspector.querySelectorAll<HTMLInputElement>(`input[id^="flow-unit-${CSS.escape(n.id)}-"]`)].map((x) => ({ key: x.dataset.key as string, unit: x.value.trim() }));
        const r = dispatch({ type: 'node.intent', node: n.id, name: 'schema', payload: { columns } }, 'control', undefined, 'Schema approved.');
        if (r.ok) { const { [n.id]: _, ...rest } = proposal; void _; proposal = rest; }
      },
    }, 'Approve schema');
    return h('div', { class: 'space-y-3' },
      h('h3', { class: 'text-sm font-semibold text-gray-900 dark:text-white' }, 'Your table'),
      h('p', { class: 'text-xs text-gray-600 dark:text-gray-400', 'data-flow-privacy': true }, 'Read in this tab only, never sent or stored. A copied link carries the graph and the approved schema, not your data.'),
      h('label', { for: `flow-csv-file-${n.id}`, class: LABEL }, 'CSV file'), file,
      h('label', { for: `flow-csv-${n.id}`, class: LABEL }, 'Or paste CSV'), ta,
      h('button', { type: 'button', class: BTN, onclick: () => void attach(ta.value, 'pasted text') }, 'Attach pasted text'),
      side ? h('p', { class: 'text-xs text-gray-700 dark:text-gray-300' }, `Attached: ${side.name}, digest ${side.digest.slice(0, 12)}`) : '',
      schema ? h('div', { class: 'space-y-2' },
        h('p', { class: 'text-sm text-gray-900 dark:text-white' }, proposal[n.id] ? 'Proposed from the header (inferred; units are yours to declare):' : 'Approved schema:'),
        ...unitInputs, approve) : '');
  }

  function pointsPanel(n: NodeInstance): HTMLElement {
    const st = n.state as PointSet;
    return h('div', { class: 'flex flex-wrap gap-2' },
      h('button', { type: 'button', class: BTN, onclick: () => dispatch({ type: 'node.intent', node: n.id, name: 'add', payload: { x: 0, y: 0 } }, 'control', undefined, 'Point added at the origin.') }, 'Add a point'),
      h('button', { type: 'button', class: BTN, onclick: () => dispatch({ type: 'node.intent', node: n.id, name: 'remove', payload: { i: st.pts.length - 1 } }, 'control', undefined, 'Last point removed.') }, 'Remove the last point'));
  }

  function renderInspector() {
    if (disposed) return;
    const n = store.graph.nodes.find((x) => x.id === selected);
    if (!n) {
      const log = store.log.slice(-8).reverse();
      inspector.replaceChildren(
        h('h2', { id: 'flow-inspector-title', class: 'mb-3 text-base font-semibold text-gray-900 dark:text-white', tabindex: -1 }, 'Graph'),
        h('p', { class: 'text-sm text-gray-700 dark:text-gray-300' }, 'Select a node to set its parameters and connections. Choose an output port, then an input port, to connect them; incompatible inputs dim and say why.'),
        h('h3', { class: 'mt-4 mb-2 text-sm font-semibold text-gray-900 dark:text-white' }, 'Order of execution'),
        h('ol', { class: 'text-sm list-decimal list-inside text-gray-700 dark:text-gray-300' }, ...(exec?.order ?? []).map((id) => h('li', {}, id))),
        h('h3', { class: 'mt-4 mb-2 text-sm font-semibold text-gray-900 dark:text-white' }, 'Recent changes'),
        log.length ? h('ul', { class: 'text-xs text-gray-700 dark:text-gray-300 space-y-1', 'data-flow-log': true },
          ...log.map((c) => h('li', {}, `#${c.revision} ${c.intent} (${c.origin})`))) : h('p', { class: 'text-xs text-gray-600 dark:text-gray-400' }, 'None yet.'));
      return;
    }
    const d = reg.get(n.type) as AnyNodeDef;
    const t = exec?.nodes.get(n.id);
    const linked = d.entry ?? (d.origin ? String(n.params[d.origin.param]) : undefined);
    const e = linked ? entry(linked) : undefined;
    inspector.replaceChildren(
      h('div', { class: 'flex items-start justify-between gap-2 mb-2' },
        h('h2', { id: 'flow-inspector-title', class: 'text-base font-semibold text-gray-900 dark:text-white', tabindex: -1 }, `${d.title} (${n.id})`),
        h('button', { type: 'button', class: BTN, onclick: () => { selected = null; renderInspector(); highlightSelected(); } }, 'Close')),
      h('p', { class: 'mb-2 text-sm text-gray-700 dark:text-gray-300' }, d.summary),
      e ? h('p', { class: 'mb-3 text-sm' }, 'Runs the code of ', h('a', { href: `#/p/${e.id}`, class: 'font-medium text-primary-700 hover:underline dark:text-primary-500' }, e.title), '.') : '',
      h('div', { class: 'space-y-4' },
        ...d.params.map((p) => control(n, p)),
        n.type === 'csv' ? csvPanel(n) : '',
        n.type === 'points' ? pointsPanel(n) : '',
        connections(n, d),
        h('div', { class: 'text-xs text-gray-700 dark:text-gray-300', 'data-flow-trace': true },
          h('h3', { class: 'mb-1 text-sm font-semibold text-gray-900 dark:text-white' }, 'Last run'),
          h('p', { 'data-flow-trace-text': true }, traceText(n.id, t))),
        h('button', {
          type: 'button', class: `${BTN} text-red-700 dark:text-red-400`,
          onclick: () => { if (dispatch({ type: 'node.remove', id: n.id }, 'editor', undefined, `${n.id} removed.`).ok) { selected = null; renderInspector(); } },
        }, 'Remove node')));
  }

  // ---- whole-graph actions -----------------------------------------------------------------------
  function loadPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    selected = null; armed = null;
    dispatch({ type: 'graph.load', doc: p.build(reg) }, 'editor', undefined, `${p.title}: ${p.summary}`);
    fit();
  }

  async function copyLink() {
    const url = `${location.origin}${location.pathname}#/flow?g=${encodeGraph(store.graph)}`;
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = sides.size ? 'Link copied. It carries the graph, not the table you attached.' : 'Link copied.';
    } catch {
      status.textContent = 'The clipboard is not available here; the address bar holds the link.';
    }
  }

  function exportJson() {
    const url = URL.createObjectURL(new Blob([serialiseGraph(store.graph)], { type: 'application/json' }));
    h('a', { href: url, download: 'graph.algoglyph-flow.json' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Saved the graph as graph.algoglyph-flow.json on this device.';
  }

  async function importFile() {
    const f = importInput.files?.[0];
    importInput.value = '';
    if (!f) return;
    if (f.size > 64 * 1024) { status.textContent = 'Refused: the document is over 64 KB and was not read.'; return; }
    const r = parseGraph(await f.text(), reg);
    if (!r.ok) { status.textContent = `Refused: ${r.errors.slice(0, 3).join('; ')}`; return; }
    selected = null; armed = null;
    dispatch({ type: 'graph.load', doc: r.doc }, 'import', undefined, `Imported ${f.name}.`);
    fit();
  }

  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const typing = target.closest('input, select, textarea');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      announce(e.shiftKey ? store.redo() : store.undo());
    } else if (e.key === 'Escape' && armed) {
      armed = null;
      status.textContent = 'Connection cancelled.';
      renderGraph();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !typing && target.closest('[data-node]')) {
      e.preventDefault();
      if (dispatch({ type: 'node.remove', id: selected }, 'editor', undefined, `${selected} removed.`).ok) { selected = null; renderInspector(); }
    }
  };
  root.addEventListener('keydown', onKey);
  const onTheme = () => renderGraph();
  document.addEventListener('dark-mode', onTheme);

  // canvas pan by dragging the background
  canvas.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas && e.target !== inner && e.target !== nodeLayer) return;
    const sx = e.clientX; const sy = e.clientY; const l = canvas.scrollLeft; const t = canvas.scrollTop;
    const mv = (ev: PointerEvent) => { canvas.scrollLeft = l - (ev.clientX - sx); canvas.scrollTop = t - (ev.clientY - sy); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });

  if (notice) status.textContent = notice;
  undoBtn.disabled = true;
  redoBtn.disabled = true;
  presetSel.value = PRESETS.find((p) => serialiseGraph(p.build(reg)) === serialiseGraph(initial))?.id ?? presetSel.value;
  renderPalette();
  renderGraph();
  renderInspector();
  requestAnimationFrame(() => fit());
  void execute();

  return {
    unmount() {
      disposed = true;
      runtime.cancel();
      unsubscribe();
      window.clearTimeout(linkTimer);
      document.removeEventListener('dark-mode', onTheme);
      sides.clear();
      host.replaceChildren();
    },
  };
}
