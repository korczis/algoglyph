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
---

Start one thread per key; each sleeps for a time proportional to its key and then appends the key to the output, so the keys appear in the order their threads wake.

It seems to sort without a single comparison, slipping under the n log n lower bound for comparison sorts. The comparisons have only moved: to wake threads in order, the system keeps the pending timers ordered by deadline in a priority queue, and with a heap that is about log n per insertion and removal. Sleep sort is a priority-queue sort run by the scheduler, and its wall-clock time grows with the largest key rather than with n.

It is not even a correct sort. The POSIX specification of nanosleep guarantees only that a sleep is not shorter than requested; it may be longer, rounded up to the timer's resolution or delayed by other work, so two threads with close keys can wake in the wrong order. Equal keys wake "together" and the scheduler decides, so the result is neither stable nor deterministic, and the shared output list needs protection against concurrent appends.

The plate runs a simulation with a virtual clock instead of real threads: the timer queue is a heap whose comparisons are counted, the clock jumps from one deadline to the next, and the threads due at that moment append their key; equal deadlines wake in thread order here, where real threads would race. Every thread is a lane, and every deadline the clock jumps to is a phase of the readouts, so the ticks are counted as the simulation takes them. Start with Random permutation at n = 64 and watch the comparison counter, then try Few distinct keys to see many threads wake on the same tick.

Its origin is internet folklore, with no author or date that a reliable source records, and there is no peer-reviewed analysis of it. For small integer keys, counting sort does the same job with no waiting and no uncertainty, and spaghetti and bead sort hand the comparison to other physics: length and gravity.
