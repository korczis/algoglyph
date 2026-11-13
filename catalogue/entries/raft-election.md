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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - Trace an election, a timeout into a new term, a vote for itself and requests to every node, where a node grants one vote per term and only to a candidate whose log is at least as up to date as its own, and a majority makes a leader.
    - Derive election safety, at most one leader in any term, from one vote per node per term and majorities intersecting.
    - Tell the two ways an election fails apart, a split vote that the next randomised timeout breaks and a candidate cut off on the minority side that cannot win at all.
algorithm:
  paradigm: randomized
claims:
  - id: one-leader-per-term
    statement: >-
      At most one leader is elected in any term. The result line's first number counts the terms
      that elected a leader; with one leader per term it equals the leaders elected, an identity
      whose difference is exactly 0 (a term with two leaders would make the result line count
      those terms instead).
    readout: Result
    expect: { against: Leaders elected, tolerance: 0 }
  - id: split-votes-fewer-than-elected-terms
    statement: >-
      With message loss and a partition mid-run, the randomised timeouts keep the terms lost to a
      split vote fewer than the terms that elect a leader: split votes minus leaders elected below
      0, a one-sided claim, since the note predicts the direction, not the size.
    readout: Terms lost to a split vote
    expect: { against: Leaders elected, below: 0 }
  - id: one-leader-per-term-early-heal
    statement: >-
      With the partition healing at 40% of the run, still at most one leader per term: the terms
      that elected a leader minus the leaders elected is exactly 0, since one vote per node per
      term and intersecting majorities do not depend on when the partition heals.
    readout: Result
    expect: { against: Leaders elected, tolerance: 0 }
    setup:
      params: { heal: 40 }
  - id: one-leader-per-term-late-heal
    statement: >-
      With the partition healing at 90% of the run, still at most one leader per term: the
      difference is exactly 0, however long the minority side keeps timing out into new terms.
    readout: Result
    expect: { against: Leaders elected, tolerance: 0 }
    setup:
      params: { heal: 90 }
  - id: one-leader-per-term-at-a-600-ms-timeout
    statement: >-
      With election timeouts drawn from 150 up to 600 ms, still at most one leader per term: the
      terms that elected a leader minus the leaders elected is exactly 0, since the timeout only
      decides when a node stands, never how votes are granted or counted.
    readout: Result
    expect: { against: Leaders elected, tolerance: 0 }
    setup:
      params: { timeoutMax: 600 }
  - id: one-leader-per-term-at-a-900-ms-timeout
    statement: >-
      With election timeouts drawn from 150 up to 900 ms, the widest setting, the same identity
      holds: the difference is exactly 0.
    readout: Result
    expect: { against: Leaders elected, tolerance: 0 }
    setup:
      params: { timeoutMax: 900 }
---

Randomised timeouts, terms and votes until one leader holds a majority.

A follower that hears no leader for a randomised timeout becomes a candidate: it starts a new term, votes for itself and asks every node for its vote. A node grants one vote per term, and only to a candidate whose log is at least as up to date as its own (a later last term, or the same term and at least as long). A majority makes a leader.

The leader appends an entry for its term and sends heartbeats that also carry and repair the followers' logs; any message from a newer term turns its receiver into a follower of that term.

The readouts keep apart the two ways an election fails. A split vote is a term with rival candidates that ends without a leader although one of them gave up on it with a majority within reach. It is counted once the term is over, when no node can still stand in it, so a delayed vote that elects someone after a rival gave up does not count. The randomised timeouts keep split votes fewer than the terms that elect a leader, and the next timeout breaks each one. A candidate cut off on the minority side of the partition cannot win at all: it keeps timing out into new terms, which count as elections started but not as split votes, and when the partition heals its higher term unseats the majority's leader. A leader stranded on the minority side still believes it leads, so the time without a leader counts only leaders that reach a majority.

Leaders crash from time to time and come back as followers. The state diagram counts every observed change of role. Election safety — at most one leader in any term — follows from one vote per node per term and majorities intersecting; the harness checks it, the vote rule and the majorities over many randomised runs with message loss and partitions.
