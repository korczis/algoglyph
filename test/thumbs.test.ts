// The gallery's thumbnail queue renders only while the collection is shown (src/core/thumbs.ts):
// it stops and forgets its cards when a plate or a lab opens, keeps only the cards on the page
// when the observer is re-armed, and cuts the render in flight. Counted, never timed.
import { describe, expect, it } from 'vitest';
import { ThumbQueue } from '../src/core/thumbs';

/** A queue whose renders finish only when the test says so, and which records what it saw. */
function harness(wanted: (id: string) => boolean = () => true) {
  const started: string[] = [];
  const signals: AbortSignal[] = [];
  const finish: (() => void)[] = [];
  const q = new ThumbQueue((id, signal) => {
    started.push(id);
    signals.push(signal);
    return new Promise<void>((resolve, reject) => {
      finish.push(resolve);
      signal.addEventListener('abort', () => reject(new DOMException('cut', 'AbortError')));
    });
  }, wanted, () => Promise.resolve());
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { q, started, signals, finish, settle };
}

describe('the gallery thumbnail queue', () => {
  it('starts no render after the collection leaves the screen, and cuts the one in flight', async () => {
    const h = harness();
    for (const id of ['a', 'b', 'c', 'd', 'e']) h.q.add(id);
    await h.settle();
    expect(h.started).toEqual(['a']);
    h.q.close(); // route() to a plate or a lab
    await h.settle();
    expect(h.signals[0].aborted).toBe(true);
    expect(h.q.pending).toEqual([]);
    for (let i = 0; i < 5; i++) await h.settle();
    expect(h.started).toEqual(['a']);
    expect(h.q.started).toBe(1);
    // cards seen while away are not queued either
    h.q.add('f');
    await h.settle();
    expect(h.started).toEqual(['a']);
  });

  it('resumes on returning to the collection, one render at a time', async () => {
    const h = harness();
    h.q.close();
    h.q.resume();
    h.q.add('a');
    h.q.add('b');
    await h.settle();
    expect(h.started).toEqual(['a']);
    h.finish[0]();
    await h.settle();
    await h.settle();
    expect(h.started).toEqual(['a', 'b']);
  });

  it('drops cards no longer on the page when the observer is re-armed', async () => {
    const h = harness();
    for (const id of ['a', 'b', 'c', 'd']) h.q.add(id);
    await h.settle();
    // wing to wing: disconnect() delivers no leaving callbacks, so keep() is the only exit
    h.q.keep(new Set(['c']));
    expect(h.q.pending).toEqual(['c']);
    h.finish[0]();
    await h.settle();
    await h.settle();
    expect(h.started).toEqual(['a', 'c']);
  });

  it('skips a card that no longer wants its picture at the moment it would start', async () => {
    const gone = new Set(['b']);
    const h = harness((id) => !gone.has(id));
    for (const id of ['a', 'b', 'c']) h.q.add(id);
    await h.settle();
    h.finish[0]();
    await h.settle();
    await h.settle();
    expect(h.started).toEqual(['a', 'c']);
  });

  it('a theme change empties the queue and cuts the render, and the queue stays open', async () => {
    const h = harness();
    for (const id of ['a', 'b']) h.q.add(id);
    await h.settle();
    h.q.clear();
    await h.settle();
    expect(h.signals[0].aborted).toBe(true);
    expect(h.q.pending).toEqual([]);
    h.q.add('a');
    await h.settle();
    await h.settle();
    expect(h.started).toEqual(['a', 'a']);
  });
});
