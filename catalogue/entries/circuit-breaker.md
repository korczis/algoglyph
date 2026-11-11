---
id: circuit-breaker
title: Circuit breaker
taxonomy: systems/flow-control
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - circuit breaker
  - state machine
  - resilience
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Closed, open and half-open: stop calling what keeps failing, and test it again later.
