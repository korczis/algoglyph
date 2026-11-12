---
id: crdt-convergence
title: CRDT convergence
taxonomy: systems/replication
status: live
engine: systems
labs:
  - replication
sources:
  - id: practice-systems
tags:
  - crdt
  - eventual consistency
  - partitions
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: merge O(size of state); state grows with tombstones
related:
  - anti-entropy
---

Replicas that accept writes during a partition and converge when it heals, by merge rules alone.

Every replica accepts writes at any time, partition or not: increments and decrements of a counter and adds and removes of labels in a set. Every so often it sends its whole state to a random peer, which merges it. Nobody coordinates and nothing is rejected.

The counter keeps one increment and one decrement total per replica, and merging takes the larger of each; the set tags every add uniquely and a remove deletes only the tags it has seen, so an add that the remover had not seen survives it. Both merges are joins — commutative, associative and idempotent — so any order of deliveries, with repeats, ends in the same state. The harness checks that on shuffled delivery orders as well as on the simulated runs.

The chart counts how many distinct states the replicas hold. It climbs while writes flow and the partition keeps the sides apart, and drops to one after writes stop and gossip has crossed the healed partition. The result line compares the converged counter with the sum of all writes ever made.
