---
id: lamport-clocks
title: Lamport clocks
taxonomy: systems/time
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - logical clocks
  - happened before
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(1) per event; one integer per message
related:
  - vector-clocks
relations:
  - { type: related_to, target: transitive-closure, reason: "Happened-before is the transitive closure of program order and messages, checked by graph search." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Advance one counter per event and, on a receipt, jump one past the larger of the worker's own counter and the one the message carried.
    - State the implication the timestamps keep, that a happened before b gives a smaller timestamp, and turn them into a total order every worker agrees on by breaking ties on worker number.
    - Explain why the converse fails, so that a smaller timestamp says nothing about causality, and what telling concurrent events apart costs with vector clocks.
claims:
  - id: one-integer-per-message
    statement: >-
      A Lamport clock costs one integer per message: every send carries only the sender's
      counter, so the clock integers carried equal the messages sent, an identity whose
      difference is exactly 0.
    readout: Clock integers carried
    expect: { against: Messages, tolerance: 0 }
  - id: happened-before-gives-a-smaller-timestamp
    statement: >-
      If a happened before b then a's timestamp is smaller: recounted over every pair of events
      against a happened-before built from program order and messages, the causal pairs whose
      timestamps are out of order number exactly 0.
    readout: Causal pairs out of order
    expect: { value: 0, tolerance: 0 }
  - id: the-converse-fails
    statement: >-
      The converse fails, so a smaller timestamp says nothing about causality: some pairs of
      events are concurrent, neither happened before the other, yet their timestamps still
      order them, so the concurrent pairs given an order are above 0.
    readout: Concurrent pairs given an order
    expect: { above: 0 }
  - id: one-integer-per-message-mostly-local
    statement: >-
      With 60% of the steps local, fewer messages are sent but each still carries only the
      sender's counter: the clock integers carried equal the messages sent, an identity whose
      difference is exactly 0.
    readout: Clock integers carried
    expect: { against: Messages, tolerance: 0 }
    setup:
      params: { localShare: 60 }
  - id: happened-before-gives-a-smaller-timestamp-mostly-local
    statement: >-
      With 60% of the steps local, happened-before still gives a smaller timestamp: the causal
      pairs whose timestamps are out of order number exactly 0.
    readout: Causal pairs out of order
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { localShare: 60 }
  - id: no-message-when-every-step-is-local
    statement: >-
      With every step local (100%), the draw that picks a local step is below 1 every time, so
      no worker ever sends: exactly 0 messages, a count with no margin.
    readout: Messages
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { localShare: 100 }
  - id: happened-before-gives-a-smaller-timestamp-all-local
    statement: >-
      With every step local only program order is left, and each worker's counter rises by one
      per step, so the causal pairs whose timestamps are out of order number exactly 0.
    readout: Causal pairs out of order
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { localShare: 100 }
  - id: the-converse-fails-all-local
    statement: >-
      With every step local no message links two workers, so every pair of events on different
      workers is concurrent, yet the timestamps order it: all pairs minus those on one worker.
      Each of the 4 workers takes its first step within 160 ms, long before the workload stops at
      2,700 ms, so there are at least C(4, 2) = 6 such pairs: above 5.
    readout: Concurrent pairs given an order
    expect: { above: 5 }
    setup:
      params: { localShare: 100 }
---

A counter on every process, advanced past every message received: a total order consistent with causality.

Every dot is an event labelled with its timestamp: a local step, a send (an arrow leaves) or a receipt (an arrow lands). A send carries the sender's counter; the receiver jumps to one past the larger of its own counter and the one it was sent, which is why counters leap forward when a message arrives from a busier worker.

If a happened before b — through program order and messages, transitively — then a's timestamp is smaller. The harness checks that implication on every pair of events, against a happened-before computed independently by graph search. Breaking ties by worker number turns the timestamps into a total order every worker agrees on.

The converse fails: a smaller timestamp says nothing about causality. The result line counts how many pairs were concurrent yet still received an order; telling those apart needs vector clocks, at the cost of one integer per worker in every message.
