// A throttle per key: `ready(key)` is true at most once every `ms` for each key, and keys never
// wait on one another. The stage throttles each chart on its own title with it, so a plate that
// publishes two charts in one frame (a run's work and its rounds) has both shown.

export function keyedThrottle(ms: number, now: () => number = () => performance.now()) {
  const last = new Map<string, number>();
  return (key: string): boolean => {
    const t = now();
    if (t - (last.get(key) ?? -Infinity) < ms) return false;
    last.set(key, t);
    return true;
  };
}
