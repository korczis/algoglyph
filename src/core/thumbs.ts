// The gallery's thumbnail queue: cards in view render one at a time, and only while the
// collection is on screen. A render shares the main thread with the live stage, so a queue that
// outlived the collection took frames from the plate or lab opened next: route() left browse
// without emptying it, and re-observing on a wing change kept every card seen on earlier wings
// (IntersectionObserver.disconnect delivers no leaving callbacks).

/** Renders one card; resolves when the picture is stored, rejects with AbortError if cut. */
export type RenderThumb = (id: string, signal: AbortSignal) => Promise<void>;

export class ThumbQueue {
  private ids: string[] = [];
  private busy = false;
  private open = true;
  private inFlight: AbortController | null = null;
  /** Renders started since the page loaded (read by the browser gate and the tests). */
  started = 0;

  constructor(
    private readonly render: RenderThumb,
    /** Whether a card still wants its picture: its view is shown and its card is in the page. */
    private readonly wanted: (id: string) => boolean,
    private readonly pause: () => Promise<void> = () => new Promise((r) => setTimeout(r, 16)),
  ) {}

  /** The ids waiting, in render order. */
  get pending(): readonly string[] { return this.ids; }

  add(id: string): void {
    if (!this.open || this.ids.includes(id)) return;
    this.ids.push(id);
    void this.drain();
  }

  drop(id: string): void { this.ids = this.ids.filter((x) => x !== id); }

  /** Keep only the cards that are on the page now (a re-observe delivers no leaving callbacks). */
  keep(ids: ReadonlySet<string>): void { this.ids = this.ids.filter((x) => ids.has(x)); }

  /** Forget every queued card and cut the render in flight (a theme change, a route away). */
  clear(): void {
    this.ids = [];
    this.inFlight?.abort();
  }

  /** The collection left the screen: nothing renders until `resume`. */
  close(): void {
    this.open = false;
    this.clear();
  }

  resume(): void { this.open = true; }

  async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.open && this.ids.length) {
        const id = this.ids.shift() as string;
        if (!this.wanted(id)) continue;
        const ctl = new AbortController();
        this.inFlight = ctl;
        this.started++;
        try {
          await this.render(id, ctl.signal);
        } catch (err) {
          if (!ctl.signal.aborted) console.error(`thumbnail ${id}`, err);
        } finally {
          this.inFlight = null;
        }
        await this.pause();
      }
    } finally {
      this.busy = false;
    }
  }
}
