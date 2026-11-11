---
id: backoff-jitter
title: Backoff with jitter
taxonomy: systems/flow-control
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - retries
  - backoff
  - thundering herd
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Clients retrying in lockstep against clients spreading their retries at random.
