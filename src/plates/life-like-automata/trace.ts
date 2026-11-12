// The fading traces both automata plates draw: one byte per cell, set to full when something
// happens there and multiplied by the fade each frame. Integers truncate, so a trace reaches
// exactly 0 in a bounded number of frames and never lingers as a tiny (subnormal) float.

export const TRACE_FULL = 255;

/** The next trace level of one cell: full when marked this frame, else faded and truncated. */
export function fadeTrace(level: number, marked: number, fade: number): number {
  return marked ? TRACE_FULL : (level * fade) | 0;
}
