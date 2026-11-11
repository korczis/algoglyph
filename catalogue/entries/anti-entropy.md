---
id: anti-entropy
title: Anti-entropy replication
taxonomy: systems/replication
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - gossip
  - replication
  - high-water marks
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Peers compare what they have and send only what the other lacks.
