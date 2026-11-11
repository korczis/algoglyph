---
id: lamport-clocks
title: Lamport clocks
taxonomy: systems/time
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - logical clocks
  - happened before
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

A counter on every process, advanced past every message received: a total order consistent with causality.
