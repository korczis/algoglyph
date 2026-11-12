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
---

Peers compare what they have and send only what the other lacks.

Each replica writes into its own log, so every write has an origin and a sequence number, and a replica always holds a gap-free prefix of each origin's writes. The vector of those prefix lengths, its high-water marks, summarises everything it has in one integer per replica.

In a session a replica sends its marks to a random peer, which answers with exactly the writes above them, leaving out the asker's own writes. Answering changes nothing, so a peer answers whatever else it is doing; the asker runs one session at a time and waits at most two maximal delays for the answer, so nothing it receives was already known to it. The duplicates readout counts any write received twice; the harness requires zero, under loss and partition, and requires that the transfers total exactly the writes times the replicas that lacked them.

Lost messages and the partition only cost time: a broken session times out and a later one repeats the comparison. The chart counts the writes still missing anywhere; it falls to zero after writes stop and the partition heals.
