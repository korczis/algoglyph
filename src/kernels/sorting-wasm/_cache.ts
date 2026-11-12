// The trace cache of the sorting kernels: a memory tier (an LRU bounded in bytes, smaller on a
// narrow screen) in front of an IndexedDB tier bounded in total bytes. Both belong to one build
// of the wasm module (its content hash and ABI layout): the database is named by it, and
// localStorage remembers which build the persistent tier belongs to, so an older build's tier
// is dropped. The caller's key carries every input of a trace.
//
// Storage is an optimisation only: every access is in try/catch, and with storage blocked
// (private mode, quota, no IndexedDB at all) the cache is memory-only and a plate renders the
// same, recomputing what it would have read. Pruning walks a small index of sizes and times,
// never the stored traces themselves.

const DB_PREFIX = 'algoglyph-sorting-traces';
const TRACES = 'traces';
const SIZES = 'sizes';
const BUILD_KEY = 'algoglyph.sorting.build';

export interface CacheLimits {
  /** Bytes the memory tier holds before it evicts the least recently used. */
  memoryBytes: number;
  /** Largest value written to the persistent tier. */
  persistBytes: number;
  /** Bytes the persistent tier holds in all; the oldest values go first. */
  persistTotal: number;
  /** Bytes read back per prefetch, newest first. */
  prefetchBytes: number;
}

function narrow(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 768px)').matches;
  } catch {
    return false;
  }
}

export function defaultLimits(): CacheLimits {
  const phone = narrow();
  return {
    memoryBytes: (phone ? 8 : 24) << 20,
    persistBytes: 2 << 20,
    persistTotal: 32 << 20,
    prefetchBytes: (phone ? 2 : 4) << 20,
  };
}

interface Held<T> { value: T; bytes: number }
interface Size { at: number; bytes: number }

function idb(): IDBFactory | undefined {
  try {
    return typeof indexedDB === 'undefined' ? undefined : indexedDB;
  } catch {
    return undefined;
  }
}

function request<R>(r: IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export class TraceCache<T> {
  private memory = new Map<string, Held<T>>();
  private held = 0;
  private db: Promise<IDBDatabase | undefined> | undefined;
  /** Bytes in the persistent tier, as its size index says. */
  private persisted = 0;

  constructor(readonly build: string, private readonly sizeOf: (v: T) => number,
    readonly limits: CacheLimits = defaultLimits()) {}

  /** The value under `key` from the memory tier (synchronous; a plate builds without waiting). */
  get(key: string): T | undefined {
    const h = this.memory.get(key);
    if (!h) return undefined;
    this.memory.delete(key);
    this.memory.set(key, h);
    return h.value;
  }

  /** Keep `value` in memory and, when it is small enough, write it through to IndexedDB. */
  put(key: string, value: T): void {
    const bytes = this.sizeOf(value);
    this.remember(key, value, bytes);
    if (bytes <= this.limits.persistBytes) void this.persist(key, value, bytes);
  }

  /** Read the newest persistent values whose key starts with `prefix` into the memory tier. */
  async prefetch(prefix: string): Promise<number> {
    const db = await this.open();
    if (!db) return 0;
    try {
      const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
      const sizes = db.transaction(SIZES, 'readonly').objectStore(SIZES);
      const [keys, metas] = await Promise.all([
        request(sizes.getAllKeys(range)), request(sizes.getAll(range)) as Promise<Size[]>,
      ]);
      const order = keys.map((k, i) => ({ k: String(k), ...metas[i] })).sort((a, b) => b.at - a.at);
      const pick: string[] = [];
      let budget = this.limits.prefetchBytes;
      for (const o of order) {
        if (o.bytes > budget) break;
        budget -= o.bytes;
        if (!this.memory.has(o.k)) pick.push(o.k);
      }
      const traces = db.transaction(TRACES, 'readonly').objectStore(TRACES);
      const values = await Promise.all(pick.map((k) => request(traces.get(k)) as Promise<T | undefined>));
      pick.forEach((k, i) => {
        const v = values[i];
        if (v !== undefined) this.remember(k, v, this.sizeOf(v));
      });
      return pick.length;
    } catch {
      return 0;
    }
  }

  /** Values and bytes in the memory tier. */
  stats(): { values: number; bytes: number; persisted: number } {
    return { values: this.memory.size, bytes: this.held, persisted: this.persisted };
  }

  private remember(key: string, value: T, bytes: number): void {
    if (bytes > this.limits.memoryBytes) return;
    const old = this.memory.get(key);
    if (old) { this.held -= old.bytes; this.memory.delete(key); }
    this.memory.set(key, { value, bytes });
    this.held += bytes;
    for (const [k, h] of this.memory) {
      if (this.held <= this.limits.memoryBytes) break;
      this.memory.delete(k);
      this.held -= h.bytes;
    }
  }

  private open(): Promise<IDBDatabase | undefined> {
    this.db ??= this.connect();
    return this.db;
  }

  private async connect(): Promise<IDBDatabase | undefined> {
    const factory = idb();
    if (!factory) return undefined;
    try {
      let previous: string | null = null;
      try {
        previous = localStorage.getItem(BUILD_KEY);
        if (previous !== this.build) localStorage.setItem(BUILD_KEY, this.build);
      } catch { /* storage blocked: keep the tier of this build only */ }
      if (previous && previous !== this.build) {
        try { factory.deleteDatabase(`${DB_PREFIX}-${previous}`); } catch { /* best effort */ }
      }
      const open = factory.open(`${DB_PREFIX}-${this.build}`, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(TRACES)) db.createObjectStore(TRACES);
        if (!db.objectStoreNames.contains(SIZES)) db.createObjectStore(SIZES).createIndex('at', 'at');
      };
      const db = await request(open);
      const metas = (await request(db.transaction(SIZES, 'readonly').objectStore(SIZES).getAll())) as Size[];
      this.persisted = metas.reduce((s, m) => s + m.bytes, 0);
      return db;
    } catch {
      return undefined;
    }
  }

  private async persist(key: string, value: T, bytes: number): Promise<void> {
    const db = await this.open();
    if (!db) return;
    try {
      const tx = db.transaction([TRACES, SIZES], 'readwrite');
      const sizes = tx.objectStore(SIZES);
      const old = (await request(sizes.get(key))) as Size | undefined;
      tx.objectStore(TRACES).put(value, key);
      sizes.put({ at: Date.now(), bytes } satisfies Size, key);
      await done(tx);
      this.persisted += bytes - (old?.bytes ?? 0);
      if (this.persisted > this.limits.persistTotal) await this.prune(db);
    } catch { /* quota or blocked: the memory tier still has it */ }
  }

  /** Drop the oldest values until the tier holds three quarters of its bound. */
  private async prune(db: IDBDatabase): Promise<void> {
    try {
      const tx = db.transaction([TRACES, SIZES], 'readwrite');
      const sizes = tx.objectStore(SIZES);
      const traces = tx.objectStore(TRACES);
      const goal = this.limits.persistTotal * 0.75;
      await new Promise<void>((resolve, reject) => {
        const cursor = sizes.index('at').openCursor();
        cursor.onerror = () => reject(cursor.error);
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c || this.persisted <= goal) { resolve(); return; }
          this.persisted -= (c.value as Size).bytes;
          traces.delete(c.primaryKey);
          c.delete();
          c.continue();
        };
      });
      await done(tx);
    } catch { /* best effort */ }
  }
}

/** FNV-1a over 32-bit words, with a second mix: the key of an input. */
export function hashWords(words: ArrayLike<number>, seed = 0x811c9dc5): string {
  let h = seed >>> 0;
  let g = 0x9e3779b9;
  for (let i = 0; i < words.length; i++) {
    const w = words[i] | 0;
    h = Math.imul(h ^ (w & 0xff), 0x01000193);
    h = Math.imul(h ^ ((w >>> 8) & 0xff), 0x01000193);
    h = Math.imul(h ^ ((w >>> 16) & 0xff), 0x01000193);
    h = Math.imul(h ^ (w >>> 24), 0x01000193);
    g = Math.imul(g ^ w, 0x85ebca6b) ^ (g >>> 13);
  }
  return `${words.length.toString(36)}-${(h >>> 0).toString(36)}-${(g >>> 0).toString(36)}`;
}
