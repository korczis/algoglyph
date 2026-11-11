// The trace cache of the sorting kernels: a memory tier (an LRU bounded in bytes) in front of an
// IndexedDB tier, both keyed by the build of the wasm module (crate version + sources'
// fingerprint), so a changed kernel never replays a stale trace. localStorage remembers which
// build the persistent tier belongs to, so the tier of an older build is dropped.
//
// Storage is an optimisation only: every access is in try/catch, and with storage blocked
// (private mode, quota, no IndexedDB at all) the cache is memory-only and a plate renders the
// same, recomputing what it would have read.

const DB_PREFIX = 'algoglyph-sorting-traces';
const STORE = 'traces';
const BUILD_KEY = 'algoglyph.sorting.build';

export interface CacheLimits {
  /** Bytes the memory tier holds before it evicts the least recently used. */
  memoryBytes: number;
  /** Largest value written to the persistent tier. */
  persistBytes: number;
  /** Values the persistent tier keeps per build; the oldest go first. */
  persistCount: number;
  /** Values read back per prefetch. */
  prefetchCount: number;
}

export const DEFAULT_LIMITS: CacheLimits = {
  memoryBytes: 48 << 20,
  persistBytes: 4 << 20,
  persistCount: 256,
  prefetchCount: 24,
};

interface Held<T> { value: T; bytes: number }
interface Stored<T> { at: number; bytes: number; value: T }

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

export class TraceCache<T> {
  private memory = new Map<string, Held<T>>();
  private held = 0;
  private db: Promise<IDBDatabase | undefined> | undefined;
  private puts = 0;

  constructor(readonly build: string, private readonly sizeOf: (v: T) => number,
    readonly limits: CacheLimits = DEFAULT_LIMITS) {}

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

  /** Read the persistent values whose key starts with `prefix` into the memory tier. */
  async prefetch(prefix: string): Promise<number> {
    const db = await this.open();
    if (!db) return 0;
    try {
      const store = db.transaction(STORE, 'readonly').objectStore(STORE);
      const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
      const [keys, values] = await Promise.all([
        request(store.getAllKeys(range, this.limits.prefetchCount)),
        request(store.getAll(range, this.limits.prefetchCount)) as Promise<Stored<T>[]>,
      ]);
      keys.forEach((k, i) => {
        const s = values[i];
        if (s && !this.memory.has(String(k))) this.remember(String(k), s.value, s.bytes);
      });
      return keys.length;
    } catch {
      return 0;
    }
  }

  /** Values and bytes in the memory tier. */
  stats(): { values: number; bytes: number } {
    return { values: this.memory.size, bytes: this.held };
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
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
      };
      return await request(open);
    } catch {
      return undefined;
    }
  }

  private async persist(key: string, value: T, bytes: number): Promise<void> {
    const db = await this.open();
    if (!db) return;
    try {
      const stored: Stored<T> = { at: Date.now(), bytes, value };
      await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(stored, key));
      if (++this.puts % 16 === 0) await this.prune(db);
    } catch { /* quota or blocked: the memory tier still has it */ }
  }

  private async prune(db: IDBDatabase): Promise<void> {
    try {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const keys = await request(store.getAllKeys());
      if (keys.length <= this.limits.persistCount) return;
      const values = (await request(store.getAll())) as Stored<T>[];
      const order = keys.map((k, i) => [k, values[i]?.at ?? 0] as const).sort((a, b) => a[1] - b[1]);
      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE);
      for (const [k] of order.slice(0, keys.length - this.limits.persistCount)) tx.delete(k);
    } catch { /* best effort */ }
  }
}

/** FNV-1a over 32-bit words: the key of an input. */
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
