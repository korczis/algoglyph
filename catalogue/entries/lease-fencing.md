---
id: lease-fencing
title: Leases with fencing tokens
taxonomy: systems/replication
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - leases
  - fencing
  - leader election
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

A lease that expires, and a token that stops a stale holder from writing after it does.
