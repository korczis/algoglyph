---
id: backoff-jitter
title: Backoff with jitter
taxonomy: systems/flow-control
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - retries
  - backoff
  - thundering herd
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(log(cap / base)) attempts to reach the cap
related:
  - circuit-breaker
  - token-bucket
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Explain why clients that sleep exactly base times two to the attempt stay in step, so their retries arrive in one spike that overflows the server's window.
    - Apply full jitter, a uniform random sleep below the same capped ceiling, to spread the same retries over the whole interval.
    - Compare the two cohorts after recovery by the peak load per window and the time their last job succeeds.
algorithm:
  paradigm: randomized
claims:
  - id: lockstep-spike-overflows-the-window
    statement: >-
      After the servers recover, the lockstep cohort's retries arrive in one spike that overflows
      the window: its peak retries per 100 ms exceed the server's capacity of 6 requests per
      100 ms.
    readout: 'Lockstep: peak retries per 100 ms after recovery'
    expect: { above: 6 }
  - id: jitter-spreads-the-peak
    statement: >-
      Full jitter spreads the same retries over the whole interval, so after recovery the jitter
      cohort's peak retries per 100 ms is lower than the lockstep cohort's.
    readout: 'Jitter: peak retries per 100 ms after recovery'
    expect: { against: 'Lockstep: peak retries per 100 ms after recovery', below: 0 }
  - id: jitter-finishes-sooner
    statement: >-
      The jitter cohort's last job succeeds before the lockstep cohort's: its all-done time minus
      the lockstep cohort's is below zero.
    readout: 'Jitter: all done at'
    expect: { against: 'Lockstep: all done at', below: 0 }
---

Clients retrying in lockstep against clients spreading their retries at random.

Two identical cohorts of clients start their jobs together, each against its own server, and both servers go down just then. When a server comes back it serves a fixed number of requests per window and refuses the rest. Every client retries with capped exponential backoff.

The lockstep cohort sleeps exactly base times two to the attempt, so its clients stay in step: their retries arrive in one spike that overflows the window, most are refused again, and the spike repeats each round. The jitter cohort sleeps a uniform random time below the same ceiling (full jitter), which spreads the same retries over the whole interval.

The chart shows requests reaching each server per window; the readouts count the peak after recovery and when each cohort's last job succeeded. Jitter retries more often early on, during the outage, but after recovery it keeps the load near the server's capacity and finishes much sooner.
