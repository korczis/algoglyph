// The chart throttle is per title: a plate's second chart in the same frame is never dropped
// (one shared throttle lost the sorting plates' rounds charts).
import { describe, expect, it } from 'vitest';
import { keyedThrottle } from '../src/core/throttle';

describe('keyedThrottle', () => {
  it('lets each key through once per interval, on a clock it is given', () => {
    let t = 0;
    const ready = keyedThrottle(600, () => t);
    expect(ready('work')).toBe(true);
    expect(ready('rounds')).toBe(true);
    expect(ready('work')).toBe(false);
    t = 599;
    expect(ready('rounds')).toBe(false);
    t = 600;
    expect(ready('work')).toBe(true);
    expect(ready('rounds')).toBe(true);
  });
});
