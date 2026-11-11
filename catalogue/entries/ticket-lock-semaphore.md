---
id: ticket-lock-semaphore
title: Ticket lock and counting semaphore
taxonomy: systems/flow-control
status: planned
engine: systems
sources:
  - id: practice-systems
tags:
  - locks
  - semaphores
  - fairness
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

First come first served for one holder, and a fixed number of slots for heavy work.
