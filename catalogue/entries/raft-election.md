---
id: raft-election
title: Raft leader election
taxonomy: systems/replication
status: live
engine: systems
labs:
  - replication
sources:
  - id: practice-systems
tags:
  - raft
  - consensus
  - elections
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(n) messages per election round for n nodes
related:
  - lease-fencing
---

Randomised timeouts, terms and votes until one leader holds a majority.

A follower that hears no leader for a randomised timeout becomes a candidate: it starts a new term, votes for itself and asks every node for its vote. A node grants one vote per term, and only to a candidate whose log is at least as up to date as its own (a later last term, or the same term and at least as long). A majority makes a leader.

The leader appends an entry for its term and sends heartbeats that also carry and repair the followers' logs; any message from a newer term turns its receiver into a follower of that term. The randomised timeouts make split votes rare, and when one happens the next timeout breaks it.

Leaders crash from time to time and come back as followers. The state diagram counts every observed change of role. Election safety — at most one leader in any term — follows from one vote per node per term and majorities intersecting; the harness checks it, the vote rule and the majorities over many randomised runs with message loss and partitions.
