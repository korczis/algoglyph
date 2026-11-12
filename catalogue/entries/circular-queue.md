---
id: circular-queue
title: FIFO queue in a ring buffer
taxonomy: foundations/structures
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - queue
  - ring buffer
complexity: 'O(1) per enqueue and dequeue, O(capacity) space'
interaction: 'Click to enqueue an item by hand.'
related:
  - josephus-circle
---

A first-in first-out queue whose head and tail chase each other around a fixed array.

The array never moves. The head index marks the oldest item and the tail index the next free slot; both advance modulo the capacity. A count of the items held tells a full ring from an empty one, since in both cases head and tail point at the same slot.

A seeded arrival process and a service process each fire with their own chance per tick. When arrivals outpace service the ring fills and further items are refused; when service wins, polls find it empty. Items never move: each stays in the slot it was written to, keeping its colour, while the hands go round, the inner one the head and the outer one the tail.

Both operations take constant time and nothing is allocated once the ring exists, which is why ring buffers sit between producers and consumers in audio, networking and logging. The chart is the occupancy measured tick by tick.
