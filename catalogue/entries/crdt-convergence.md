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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - Merge a counter by taking the larger increment and decrement total per replica, and a set by unique add tags, so that an add the remover had not seen survives the remove.
    - Explain why merges that are commutative, associative and idempotent end in the same state whatever the order of deliveries, with repeats.
    - Read the divergence chart, which climbs while writes flow across a partition and drops to one state after writes stop and gossip crosses the healed partition.
claims:
  - id: counter-equals-the-sum-of-writes
    statement: >-
      Once converged, the counter equals the sum of all increments and decrements ever made: the
      result line's first number (the counter) minus its second (the sum of writes) is exactly 0.
    readout: Result
    expect: { against: Result, against_number: 2, tolerance: 0 }
  - id: converges-after-the-partition-heals
    statement: >-
      The replicas reach one state only after the partition heals: it cuts them from 1,800 to
      3,600 ms (0.3 to 0.6 of the 6,000 ms run) while every replica writes until 3,300 ms at most
      320 ms apart, so the two sides differ until 3,600 ms; they converge before the run ends at
      6,000 ms.
    readout: Converged at
    expect: { range: [3600, 6000] }
  - id: converges-after-an-early-heal
    statement: >-
      Healing the partition at 45% of the run (2,700 ms) does not let the replicas agree before
      the writes stop: convergence counts only once writes have stopped at 3,300 ms (0.55 of the
      6,000 ms run), so it comes at max(2,700, 3,300) = 3,300 ms or later, and before the run
      ends at 6,000 ms.
    readout: Converged at
    expect: { range: [3300, 6000] }
    setup:
      params: { heal: 45 }
  - id: converges-after-a-late-heal
    statement: >-
      Healing the partition at 80% of the run moves convergence after 4,800 ms (0.8 of 6,000):
      every replica writes at most 320 ms apart until 3,300 ms, so each side writes something the
      other lacks inside the 1,800 to 4,800 ms cut, and no message crosses until it heals; they
      converge before the run ends at 6,000 ms.
    readout: Converged at
    expect: { range: [4800, 6000] }
    setup:
      params: { heal: 80 }
  - id: counter-equals-the-sum-after-the-latest-heal
    statement: >-
      With the partition healing at 90% of the run, the converged counter still equals the sum
      of all writes: the result line's first number minus its second is exactly 0, the same
      identity as at the default.
    readout: Result
    expect: { against: Result, against_number: 2, tolerance: 0 }
    setup:
      params: { heal: 90 }
---

Replicas that accept writes during a partition and converge when it heals, by merge rules alone.

Every replica accepts writes at any time, partition or not: increments and decrements of a counter and adds and removes of labels in a set. Every so often it sends its whole state to a random peer, which merges it. Nobody coordinates and nothing is rejected.

The counter keeps one increment and one decrement total per replica, and merging takes the larger of each; the set tags every add uniquely and a remove deletes only the tags it has seen, so an add that the remover had not seen survives it. Both merges are joins — commutative, associative and idempotent — so any order of deliveries, with repeats, ends in the same state. The harness checks that on shuffled delivery orders as well as on the simulated runs.

The chart counts how many distinct states the replicas hold. It climbs while writes flow and the partition keeps the sides apart, and drops to one after writes stop and gossip has crossed the healed partition. The result line compares the converged counter with the sum of all writes ever made.
