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
---

A lease that expires, and a token that stops a stale holder from writing after it does.

The lock service grants one lease at a time with a fixed time to live and a token one larger than the last. A worker counts its lease from the moment it asked, so its own view expires no later than the service's, and it checks the lease before every write. Bands show who believes they hold a lease, and when one is paused.

A long pause between the check and the write — a stalled process, a slow disk — lets the write arrive after the lease has run out and another worker has taken a newer one. No clock check can prevent that, because the check happened before the pause. The storage instead remembers the largest token it has accepted and refuses anything smaller; refused writes are crossed at the storage lane.

Turn the storage's check off to see the stale writes land: the readout of stale writes accepted counts writes whose token was smaller than one the storage had already accepted. The harness requires none of those with fencing on, and that leases never overlap at the service.
