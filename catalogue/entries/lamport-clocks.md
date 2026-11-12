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
---

A counter on every process, advanced past every message received: a total order consistent with causality.

Every dot is an event labelled with its timestamp: a local step, a send (an arrow leaves) or a receipt (an arrow lands). A send carries the sender's counter; the receiver jumps to one past the larger of its own counter and the one it was sent, which is why counters leap forward when a message arrives from a busier worker.

If a happened before b — through program order and messages, transitively — then a's timestamp is smaller. The harness checks that implication on every pair of events, against a happened-before computed independently by graph search. Breaking ties by worker number turns the timestamps into a total order every worker agrees on.

The converse fails: a smaller timestamp says nothing about causality. The result line counts how many pairs were concurrent yet still received an order; telling those apart needs vector clocks, at the cost of one integer per worker in every message.
