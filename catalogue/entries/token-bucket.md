---
id: token-bucket
title: Token bucket
taxonomy: systems/flow-control
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - rate limiting
  - token bucket
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Tokens drip in at a fixed rate; each request spends one, bursts up to the bucket's size.
