// Whether the stage's draw loop runs. A paused or off-screen plate stops, except during a short
// burst: Reset view on a paused plate runs frames until a progressive render can finish, then
// the pause holds again.
export function shouldRun(state: { userPaused: boolean; visible: boolean; burst: number }): boolean {
  return (!state.userPaused && state.visible) || state.burst > 0;
}

/** Frames a reset on a paused plate may run (about two seconds at 60 frames per second). */
export const RESET_BURST_FRAMES = 120;
