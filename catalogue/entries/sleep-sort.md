---
id: sleep-sort
title: Sleep sort
taxonomy: sorting/esoteric
status: live
engine: array
sources:
  - id: opengroup-2018
    ref: nanosleep may sleep longer than requested
  - id: cormen-2022
    ref: "Chapter 6: priority queues; Chapter 8: lower bounds for sorting"
tags:
  - sorting
  - esoteric
  - parallel
  - timers
  - concurrency
complexity: n log n + max in every case; extra space n
related:
  - bead-sort
  - counting-sort
  - heapsort
  - spaghetti-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [binary-heap]
  objectives:
  - 'Read Rounds and Lanes: 2 rounds, every thread spawned and every thread woken, and one lane per key, 64 at 64 keys.'
  - 'Run Few distinct keys at 64 keys: the Phase readout ends at t = 3 after 5 phases, the spawn and one deadline per distinct key.'
  - 'Read Comparisons: the timer heap''s, never more than Σ (⌊lg(i + 1)⌋ + 2⌊lg i⌋) over i = 1..n − 1.'
  misconceptions:
  - 'Sleep sort sorts without comparing; the plate''s timer queue makes 592 comparisons on Random permutation at 64 keys, and a real scheduler''s queue does the same work.'
algorithm:
  paradigm: simulation
  properties:
    in_place: false
bounds:
  model: 'comparisons (the timer heap''s pushes and removals), array writes (one per thread waking), rounds, lanes (one thread per key) and phases (the spawn, then each deadline of the virtual clock)'
  average: 'n array writes, 2 rounds, n lanes and 1 + d phases for d distinct keys on every input, the last at t = max − min'
  worst: 'at most Σ (⌊lg(i + 1)⌋ + 2⌊lg i⌋) comparisons over i = 1..n − 1; real time grows with the largest key, which the virtual clock replaces'
claims:
  - id: the-clock-ends-at-the-largest-key
    statement: >-
      On Few distinct keys at 64 keys the virtual clock of sleep sort ends at t = 3: the keys run from 1 to 4, and the last thread sleeps max − min ticks.
    readout: Phase
    expect: { value: 3 }
    setup:
      params: { shape: few-unique, n: 64 }
---

Start one thread per key; each sleeps for a time proportional to its key and then appends the key to the output, so the keys appear in the order their threads wake.

It seems to sort without a single comparison, slipping under the n log n lower bound for comparison sorts. The comparisons have only moved: to wake threads in order, the system keeps the pending timers ordered by deadline in a priority queue, and with a heap that is about log n per insertion and removal. Sleep sort is a priority-queue sort run by the scheduler, and its wall-clock time grows with the largest key rather than with n.

It is not even a correct sort. The POSIX specification of nanosleep guarantees only that a sleep is not shorter than requested; it may be longer, rounded up to the timer's resolution or delayed by other work, so two threads with close keys can wake in the wrong order. Equal keys wake "together" and the scheduler decides, so the result is neither stable nor deterministic, and the shared output list needs protection against concurrent appends.

The plate runs a simulation with a virtual clock instead of real threads: the timer queue is a heap whose comparisons are counted, the clock jumps from one deadline to the next, and the threads due at that moment append their key; equal deadlines wake in thread order here, where real threads would race. Every thread is a lane, and every deadline the clock jumps to is a phase of the readouts, so the ticks are counted as the simulation takes them. Start with Random permutation at n = 64 and watch the comparison counter, then try Few distinct keys to see many threads wake on the same tick.

Its origin is internet folklore, with no author or date that a reliable source records, and there is no peer-reviewed analysis of it. For small integer keys, counting sort does the same job with no waiting and no uncertainty, and spaghetti and bead sort hand the comparison to other physics: length and gravity.
