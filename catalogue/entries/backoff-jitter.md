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
---

Clients retrying in lockstep against clients spreading their retries at random.

Two identical cohorts of clients start their jobs together, each against its own server, and both servers go down just then. When a server comes back it serves a fixed number of requests per window and refuses the rest. Every client retries with capped exponential backoff.

The lockstep cohort sleeps exactly base times two to the attempt, so its clients stay in step: their retries arrive in one spike that overflows the window, most are refused again, and the spike repeats each round. The jitter cohort sleeps a uniform random time below the same ceiling (full jitter), which spreads the same retries over the whole interval.

The chart shows requests reaching each server per window; the readouts count the peak after recovery and when each cohort's last job succeeded. Jitter retries more often early on, during the outage, but after recovery it keeps the load near the server's capacity and finishes much sooner.
