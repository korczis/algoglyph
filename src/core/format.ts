// Counts shown in readouts, with en-US digit grouping. One formatter, made once:
// Number.prototype.toLocaleString('en-US') builds a new Intl.NumberFormat on every call, and an
// engine's lab formats every pane's counts each frame (12 ms of a 45 ms frame of the sorting lab
// with 123 panes, measured by a CPU profile of that frame). The output is the same string.
const EN = new Intl.NumberFormat('en-US');

export const count = (x: number): string => EN.format(x);
