---
id: vector-clocks
title: Vector clocks
taxonomy: systems/time
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - vector clocks
  - causality
  - concurrency
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(n) per event and per message for n workers
related:
  - lamport-clocks
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - lamport-clocks
  objectives:
    - Keep one counter per worker, increment the worker's own entry for each event and, on a receipt, take the entrywise maximum with the vector that arrived first.
    - Decide causality exactly by comparing vectors, a happened before b when a's vector is at most b's in every entry and they differ, and concurrent when each is larger somewhere.
    - Weigh what a whole vector in every message costs against the concurrency a single Lamport counter hides, on the same workload message for message.
claims:
  - id: concurrency-counted-outright
    statement: >-
      On the workload the Lamport clocks run on, the vectors detect pairs of events that are
      concurrent, which a single counter would still put in an order: more than 0 such pairs,
      a one-sided claim, since the note predicts that concurrency exists, not how much.
    readout: Pairs detected concurrent
    expect: { above: 0 }
  - id: live-count-matches-recount
    statement: >-
      The concurrent pairs counted as each event happens equal the full pairwise comparison of
      every finished vector that the result line reports (its first number), an identity whose
      difference is exactly 0.
    readout: Pairs detected concurrent
    expect: { against: Result, tolerance: 0 }
---

One counter per process, so that concurrent events are visibly concurrent.

Each label is a worker's vector after the event: entry i counts the events of worker i it knows of. A worker increments its own entry for each event and, on receipt, first takes the entrywise maximum with the vector that arrived. The chart sums each vector: how much of the history each worker has heard about.

Comparing two vectors decides causality exactly: a happened before b when a's vector is at most b's in every entry and they differ, and two events whose vectors are each larger somewhere are concurrent. The harness checks that this classification matches an independently computed happened-before on every pair of every run.

For one seed the workload is the same one Lamport timestamps are shown on, message for message, so the two read side by side: here every message carries a whole vector instead of one number, and the concurrency a single counter hides is counted outright.
