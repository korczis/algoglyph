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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Trace the three states, closed counting consecutive failures, open refusing calls at once, half-open letting a single trial through after the cooldown.
    - Explain why so little reaches a failing dependency, a trial per cooldown instead of every call.
    - Explain how the breaker closes again, since a successful trial closes it and a failed one opens it for another cooldown.
claims:
  - id: a-trip-per-cooldown
    statement: >-
      While the dependency is degraded, from 1,500 to 4,200 ms, the breaker trips at most once
      per cooldown, because every trip keeps it open for the 500 ms cooldown before a trial: at
      least the first trip and at most 1 + ⌊(4,200 + 50 − 1,500) / 500⌋ = 6, the 50 ms being the
      longest a forwarded call takes to come back.
    readout: Trips (to open)
    expect: { range: [1, 6] }
  - id: closes-after-recovery
    statement: >-
      After the dependency recovers at 4,200 ms a trial succeeds and closes the breaker again
      before the run ends at 7,000 ms: at least one recovery.
    readout: Recoveries (to closed)
    expect: { above: 0 }
  - id: nothing-forwarded-while-open
    statement: >-
      Open, the breaker refuses every call at once without touching the dependency, so no call
      is forwarded while it is open: exactly 0, a count with no margin.
    readout: Calls forwarded while open
    expect: { value: 0, tolerance: 0 }
---

Closed, open and half-open: stop calling what keeps failing, and test it again later.

Closed, every call goes through and consecutive failures are counted; at the threshold the breaker opens and refuses calls at once, without touching the dependency. After the cooldown it turns half-open and lets a single trial through; success closes it, failure opens it again for another cooldown.

The dependency degrades for a stretch of the run and fails almost every call, then recovers. The chart shows how little reaches it while it is down: a trial per cooldown instead of every call. The state diagram counts each observed transition; the harness checks every one against the transition table and that no call is forwarded while the breaker is open.
