---
id: circuit-breaker
title: Circuit breaker
taxonomy: systems/flow-control
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - circuit breaker
  - state machine
  - resilience
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(1) per call
related:
  - backoff-jitter
---

Closed, open and half-open: stop calling what keeps failing, and test it again later.

Closed, every call goes through and consecutive failures are counted; at the threshold the breaker opens and refuses calls at once, without touching the dependency. After the cooldown it turns half-open and lets a single trial through; success closes it, failure opens it again for another cooldown.

The dependency degrades for a stretch of the run and fails almost every call, then recovers. The chart shows how little reaches it while it is down: a trial per cooldown instead of every call. The state diagram counts each observed transition; the harness checks every one against the transition table and that no call is forwarded while the breaker is open.
