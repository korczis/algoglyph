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
      While the dependency is degraded, from 1,500 to its default recovery at 4,200 ms, the breaker trips at most once
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
  - id: a-trip-per-cooldown-early-recovery
    statement: >-
      With the dependency recovering at 2,000 ms, degraded from 1,500 ms for only 500 ms, the
      same bound allows at least the first trip and at most 1 + ⌊(2,000 + 50 − 1,500) / 500⌋ = 2
      trips: one per 500 ms cooldown over the degraded stretch and the 50 ms a forwarded call can
      take to come back.
    readout: Trips (to open)
    expect: { range: [1, 2] }
    setup:
      params: { recover: 2000 }
  - id: a-trip-per-cooldown-mid-recovery
    statement: >-
      With the dependency recovering at 3,000 ms, the trips stay between the first one and
      1 + ⌊(3,000 + 50 − 1,500) / 500⌋ = 4, one per 500 ms cooldown over the degraded stretch
      and the 50 ms a forwarded call can take to come back.
    readout: Trips (to open)
    expect: { range: [1, 4] }
    setup:
      params: { recover: 3000 }
  - id: a-trip-per-cooldown-late-recovery
    statement: >-
      With the dependency recovering at 6,000 ms, the latest setting, the trips stay between the
      first one and 1 + ⌊(6,000 + 50 − 1,500) / 500⌋ = 10, one per 500 ms cooldown over the
      degraded stretch and the 50 ms a forwarded call can take to come back.
    readout: Trips (to open)
    expect: { range: [1, 10] }
    setup:
      params: { recover: 6000 }
  - id: closes-after-late-recovery
    statement: >-
      Recovering at 6,000 ms, the dependency still leaves room for a successful trial before the
      run ends: the last cooldown runs out by 6,000 + 500 = 6,500 ms, and its trial comes back
      within 50 ms more, by 6,550 ms, before the 7,000 ms horizon, so at least one recovery.
    readout: Recoveries (to closed)
    expect: { above: 0 }
    setup:
      params: { recover: 6000 }
  - id: closes-after-early-recovery
    statement: >-
      Recovering at 2,000 ms, the dependency is healthy again long before the run ends: the last
      cooldown runs out by 2,000 + 500 = 2,500 ms and its trial comes back by 2,550 ms, well
      before the 7,000 ms horizon, so at least one recovery.
    readout: Recoveries (to closed)
    expect: { above: 0 }
    setup:
      params: { recover: 2000 }
  - id: nothing-forwarded-while-open
    statement: >-
      Open, the breaker refuses every call at once without touching the dependency, so no call
      is forwarded while it is open: exactly 0, a count with no margin.
    readout: Calls forwarded while open
    expect: { value: 0, tolerance: 0 }
  - id: nothing-forwarded-while-open-late-recovery
    statement: >-
      However long the dependency stays degraded, here until 6,000 ms, an open breaker forwards
      nothing: exactly 0 calls forwarded while open, a count with no margin.
    readout: Calls forwarded while open
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { recover: 6000 }
---

Closed, open and half-open: stop calling what keeps failing, and test it again later.

Closed, every call goes through and consecutive failures are counted; at the threshold the breaker opens and refuses calls at once, without touching the dependency. After the cooldown it turns half-open and lets a single trial through; success closes it, failure opens it again for another cooldown.

The dependency degrades for a stretch of the run and fails almost every call, then recovers at the time the control sets. The chart shows how little reaches it while it is down: a trial per cooldown instead of every call. The state diagram counts each observed transition; the harness checks every one against the transition table and that no call is forwarded while the breaker is open.
