---
id: lease-fencing
title: Leases with fencing tokens
taxonomy: systems/replication
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - leases
  - fencing
  - leader election
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(1) per grant and per write
related:
  - raft-election
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Explain why a lease checked before a write cannot stop a stale write after a long pause, because the check happened before the pause.
    - Fence the storage, which remembers the largest token it has accepted and refuses anything smaller, with a token one larger than the last at every grant.
    - Show why a worker that counts its lease from the moment it asked never believes in it longer than the lock service does.
claims:
  - id: fencing-lets-no-stale-write-land
    statement: >-
      With the storage checking fencing tokens, no write whose token is smaller than one already
      accepted lands: it refuses every such token, so the count is exactly 0.
    readout: Stale writes accepted (fencing off)
    expect: { value: 0, tolerance: 0 }
  - id: fencing-refuses-stale-writes
    statement: >-
      With a 15% chance of a long pause per write, some writes arrive after a newer lease was
      granted and the storage refuses them: more than 0 refused writes, a one-sided claim, since
      the note predicts that late writes happen, not how many.
    readout: Stale writes rejected
    expect: { above: 0 }
  - id: without-fencing-stale-writes-land
    statement: >-
      With the storage's check turned off, the same long pauses let stale writes land: more than
      0 writes accepted with a token smaller than one already accepted, a one-sided claim, since
      the note predicts that they land, not how many.
    readout: Stale writes accepted (fencing off)
    expect: { above: 0 }
    setup:
      params: { fencing: false }
  - id: no-pause-no-stale-write
    statement: >-
      Without long pauses no stale write lands even with fencing off: a worker writes only while
      its own lease, counted from when it asked, has 40 ms left, and a write takes at most 30 ms,
      so it arrives before the service's lease runs out and before any newer token exists;
      exactly 0.
    readout: Stale writes accepted (fencing off)
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { fencing: false, pause: 0 }
  - id: one-token-per-grant
    statement: >-
      Each grant carries a token one larger than the last, starting from 1, so the latest token
      equals the number of leases granted, an identity whose difference is exactly 0.
    readout: Latest token
    expect: { against: Leases granted, tolerance: 0 }
  - id: fencing-holds-at-a-1000-ms-lease
    statement: >-
      With leases of 1,000 ms, fencing still lets no stale write land: the storage refuses every
      token smaller than one it has accepted whatever the lease's length, so exactly 0.
    readout: Stale writes accepted (fencing off)
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { ttl: 1000 }
  - id: grants-bounded-by-the-lease
    statement: >-
      With leases of 1,000 ms, the service grants a new lease only after the last one, renewals
      included, has expired, so grants are at least 1,000 ms apart in the 6,000 ms run: at most
      1 + ⌊6,000 / 1,000⌋ = 7, and at least the first one, granted within 230 ms (a start within
      200 ms and a delay of at most 30 ms).
    readout: Leases granted
    expect: { range: [1, 7] }
    setup:
      params: { ttl: 1000 }
  - id: one-token-per-grant-at-the-longest-lease
    statement: >-
      With leases of 1,500 ms, the longest setting, each grant still carries a token one larger
      than the last, so the latest token equals the leases granted: a difference of exactly 0.
    readout: Latest token
    expect: { against: Leases granted, tolerance: 0 }
    setup:
      params: { ttl: 1500 }
  - id: no-pause-no-stale-write-at-the-longest-lease
    statement: >-
      Without long pauses and with fencing off, no stale write lands with leases of 1,500 ms
      either: the 40 ms a worker keeps in hand against a write's 30 ms at most does not depend on
      the lease's length, so exactly 0.
    readout: Stale writes accepted (fencing off)
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { ttl: 1500, fencing: false, pause: 0 }
---

A lease that expires, and a token that stops a stale holder from writing after it does.

The lock service grants one lease at a time, for the time to live its control sets, and a token one larger than the last. A worker counts its lease from the moment it asked, so its own view expires no later than the service's, and it checks the lease before every write. Bands show who believes they hold a lease, and when one is paused.

A long pause between the check and the write — a stalled process, a slow disk — lets the write arrive after the lease has run out and another worker has taken a newer one. No clock check can prevent that, because the check happened before the pause. The storage instead remembers the largest token it has accepted and refuses anything smaller; refused writes are crossed at the storage lane.

Turn the storage's check off to see the stale writes land: the readout of stale writes accepted counts writes whose token was smaller than one the storage had already accepted. The harness requires none of those with fencing on, and that leases never overlap at the service.
