---
id: ticket-lock-semaphore
title: Ticket lock and counting semaphore
taxonomy: systems/flow-control
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - locks
  - semaphores
  - fairness
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(1) per acquire; a waiter spins once per poll
---

First come first served for one holder, and a fixed number of slots for heavy work.

A ticket lock is two shared counters. A worker draws a ticket by fetch-and-increment of the first and spins, polling the second, until it shows its ticket; releasing increments the second. Workers are therefore served strictly in the order they drew tickets, unlike a test-and-set lock, where whoever polls first after a release wins.

The counting semaphore keeps a number of free slots and a queue of waiters. Acquiring takes a slot if one is free and joins the queue otherwise; releasing hands the slot straight to the head of the queue, or returns it when nobody waits. The chart shows both queues and the slots in use; the harness checks that the lock goes out in ticket order with no overlap, that slots in use never exceed the count, and that slot waiters are served first come, first served.
