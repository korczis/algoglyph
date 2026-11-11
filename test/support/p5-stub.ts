// A p5 that draws nothing: every property is a no-op function that returns itself, so a plate
// runs its own computation exactly as in the browser while drawing costs nothing. Numeric
// reads (constants, width) come back as NaN through the same proxy; plates read sizes from ctx.
const handler: ProxyHandler<() => void> = {
  get(_t, key) {
    if (key === Symbol.toPrimitive) return () => NaN;
    if (key === 'then') return undefined;
    if (key === 'pixels') return new Uint8ClampedArray(4);
    return stub;
  },
  apply() { return stub; },
  set() { return true; },
};
const stub: unknown = new Proxy(function noop() {}, handler);

export function p5Stub(): never {
  return stub as never;
}

/**
 * The few browser surfaces plates use outside p5 (src/core/raster.ts's offscreen canvas,
 * Path2D), as no-ops with real pixel buffers, so a node test measures the plate's own work.
 */
export function installBrowserStubs(): void {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => new Proxy({}, {
          get: (_t, key) => (key === 'createImageData'
            ? (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) })
            : () => undefined),
        }),
      }),
    };
  }
  if (!g.Path2D) g.Path2D = class { moveTo() {} lineTo() {} rect() {} arc() {} closePath() {} };
}
