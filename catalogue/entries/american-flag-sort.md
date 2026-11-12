---
id: american-flag-sort
title: American flag sort
taxonomy: sorting/radix
status: planned
engine: array
labs:
  - sorting
sources:
  - id: mcilroy-1993
    ref: the original description
  - id: sedgewick-2011
    ref: "5.1 String sorts"
tags:
  - sorting
  - radix
  - in-place
  - msd
complexity: about n log_R n characters examined on random keys, n·w worst for w-byte keys; extra space w·R counters
related:
  - binary-quicksort
  - lsd-radix-sort
  - msd-radix-sort
  - quicksort-three-way
  - three-way-radix-quicksort
---

An in-place MSD radix sort: count how many keys fall into each of the 256 piles of the current byte, compute where the piles begin, permute the keys home by following cycles, then sort every pile on the next byte.

The name is McIlroy, Bostic and McIlroy's joke: with two piles the step is quicksort's partition, with three it is Dijkstra's Dutch national flag, so the many-striped general case is the American flag. Watch the permutation phase: a key is swapped into the next free slot of its pile, the key it displaces goes to its own pile, and the cycle runs until a key of the starting pile comes back.

Each level reads every key once to count it and moves it at most once, so the total work is the number of characters examined, the same as for MSD radix sort, but without an auxiliary array of n keys. Small piles are finished by insertion sort, as the paper recommends, because a table of 256 counters does not pay for a few keys.

Start with Random permutation at n = 256. The plate's keys are at most 512, so only the low bytes differ and the work concentrates in the last passes. The cycles do not keep equal keys in order, so it is not stable; when stability matters, LSD radix sort or a two-array MSD sort is the choice.
