---
id: token-bucket
title: Token bucket
taxonomy: systems/flow-control
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - rate limiting
  - token bucket
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(1) per request
related:
  - backoff-jitter
---

Tokens drip in at a fixed rate; each request spends one, bursts up to the bucket's size.

Tokens accrue continuously at the refill rate, up to the bucket's size. A request that finds a whole token spends it and passes to the backend; one that finds none is refused at once. Clients alternate quiet spells with bursts, so the offered load arrives bunched.

A full bucket lets a burst through at once; after that the admitted rate settles at the refill rate however hard the clients push. Over any interval of length t the limiter admits at most rate × t + burst requests; the harness checks that bound on every pair of admissions and replays the arrivals through an independent bucket.
