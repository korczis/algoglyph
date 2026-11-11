---
id: raft-election
title: Raft leader election
taxonomy: systems/replication
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - raft
  - consensus
  - elections
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Randomised timeouts, terms and votes until one leader holds a majority.
