---
id: crdt-convergence
title: CRDT convergence
taxonomy: systems/replication
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - crdt
  - eventual consistency
  - partitions
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Replicas that accept writes during a partition and converge when it heals, by merge rules alone.
