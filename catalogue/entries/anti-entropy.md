---
id: anti-entropy
title: Anti-entropy replication
taxonomy: systems/replication
status: live
engine: systems
labs:
  - replication
sources:
  - id: practice-systems
tags:
  - gossip
  - replication
  - high-water marks
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(r + d) per session for r replicas and d missing writes
related:
  - crdt-convergence
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Summarise everything a replica holds as one high-water mark per origin, the length of the gap-free prefix of that origin's writes it has.
    - Explain why a pull session never delivers a write twice, since the peer answers with exactly the writes above the asker's marks and leaves out the asker's own.
    - Show that lost messages and a partition only cost time, and that the replicas converge once writes stop and the partition heals.
claims:
  - id: no-write-received-twice
    statement: >-
      Under the default 5% message loss and the mid-run partition, no replica receives any write
      twice: the peer answers with exactly the writes above the asker's marks, so the count is
      exactly zero.
    readout: Duplicates received
    expect: { value: 0 }
  - id: transfers-are-the-writes-each-replica-lacked
    statement: >-
      The writes transferred total exactly the writes times the replicas that lacked them,
      (replicas − 1) × writes, the third number of the result line (its second is the 1 of
      "replicas − 1"); an exact identity, so no tolerance.
    readout: Writes transferred
    expect: { against: Result, against_number: 3, tolerance: 0 }
  - id: converges-after-the-partition-heals
    statement: >-
      The writes still missing fall to zero only after the partition heals: it cuts the replicas
      from 3,000 to 6,000 ms (0.3 to 0.6 of the 10,000 ms run) while every replica keeps writing
      until 4,000 ms at most 420 ms apart, so the two sides cannot agree before 6,000 ms, and they
      converge before the run ends at 10,000 ms.
    readout: Converged at
    expect: { range: [6000, 10000] }
  - id: converges-after-an-early-heal
    statement: >-
      Healing the partition at 45% of the run (4,500 ms) still leaves every replica writing in
      the cut from 3,000 ms, at most 420 ms apart until 4,000 ms, so nothing converges before
      max(4,500, 4,000) = 4,500 ms; they converge before the run ends at 10,000 ms.
    readout: Converged at
    expect: { range: [4500, 10000] }
    setup:
      params: { heal: 45 }
  - id: converges-after-a-late-heal
    statement: >-
      Healing the partition at 80% of the run moves convergence after 8,000 ms (0.8 of 10,000):
      the sides wrote apart from 3,000 to 4,000 ms and nothing crosses until the heal; they
      converge before the run ends at 10,000 ms.
    readout: Converged at
    expect: { range: [8000, 10000] }
    setup:
      params: { heal: 80 }
  - id: transfers-are-exact-after-the-latest-heal
    statement: >-
      With the partition healing at 90% of the run, the writes transferred are still exactly
      (replicas − 1) × writes, the result line's third number; an exact identity, no tolerance.
    readout: Writes transferred
    expect: { against: Result, against_number: 3, tolerance: 0 }
    setup:
      params: { heal: 90 }
---

Peers compare what they have and send only what the other lacks.

Each replica writes into its own log, so every write has an origin and a sequence number, and a replica always holds a gap-free prefix of each origin's writes. The vector of those prefix lengths, its high-water marks, summarises everything it has in one integer per replica.

In a session a replica sends its marks to a random peer, which answers with exactly the writes above them, leaving out the asker's own writes. Answering changes nothing, so a peer answers whatever else it is doing; the asker runs one session at a time and waits at most two maximal delays for the answer, so nothing it receives was already known to it. The duplicates readout counts any write received twice; the harness requires zero, under loss and partition, and requires that the transfers total exactly the writes times the replicas that lacked them.

Lost messages and the partition only cost time: a broken session times out and a later one repeats the comparison. The chart counts the writes still missing anywhere; it falls to zero after writes stop and the partition heals.
