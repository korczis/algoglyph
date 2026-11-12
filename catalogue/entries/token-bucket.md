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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Refill tokens continuously at the refill rate up to the bucket's size, let a request that finds a whole token spend it and pass, and refuse one that finds none at once.
    - State the bound the limiter keeps, at most rate × t + burst requests admitted over any interval of length t, and check it on every pair of admissions.
    - See a full bucket let a burst through at once, after which the admitted rate settles at the refill rate however hard the clients push.
claims:
  - id: never-more-than-rate-times-t-plus-burst
    statement: >-
      Over any interval of length t the limiter admits at most rate × t + burst requests: the
      largest excess over rate × t, printed to two decimals, minus the burst stays below 0.005,
      half the last printed place.
    readout: Result
    expect: { against: Result, against_number: 2, below: 0.005 }
  - id: admitted-at-most-rate-times-run-plus-burst
    statement: >-
      Over the whole 6-second run, at 12 tokens per second and a bucket of 8, the limiter admits
      at most 12 × 6 + 8 = 80 requests, however the clients bunch their arrivals.
    readout: Admitted
    expect: { range: [0, 80] }
    setup:
      params: { rate: 12, burst: 8 }
  - id: flood-admits-the-refill-rate
    statement: >-
      Under an offered load of 120 requests per second, ten times the refill rate of 12, the
      admitted rate settles at the refill rate: admissions are 80 (12 × 6 s + burst 8) minus the
      tokens left at the end, at most the burst of 8, so between 72 and 80. This assumes no
      tokens are wasted while the bucket is full, which the flood leaves no time for.
    readout: Admitted
    expect: { range: [72, 80] }
    setup:
      params: { rate: 12, burst: 8, load: 120 }
---

Tokens drip in at a fixed rate; each request spends one, bursts up to the bucket's size.

Tokens accrue continuously at the refill rate, up to the bucket's size. A request that finds a whole token spends it and passes to the backend; one that finds none is refused at once. Clients alternate quiet spells with bursts, so the offered load arrives bunched.

A full bucket lets a burst through at once; after that the admitted rate settles at the refill rate however hard the clients push. Over any interval of length t the limiter admits at most rate × t + burst requests; the harness checks that bound on every pair of admissions and replays the arrivals through an independent bucket.
