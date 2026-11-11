---
id: bozosort
title: Bozosort
taxonomy: sorting/esoteric
status: planned
engine: custom
sources:
  - id: gruber-2007
    ref: analysis of bozosort and its variants
  - id: flatto-1985
    ref: random transpositions on the symmetric group
tags:
  - sorting
  - esoteric
  - in-place
  - randomized
  - markov chain
complexity: n best, n! to n·n! average, unbounded worst; extra space 1
related:
  - bogobogosort
  - bogosort
---

While the array is not sorted, swap the keys at two randomly chosen positions and test again.

Unlike bogosort, bozosort remembers where it is: one swap moves it only to a permutation one transposition away, so the run is a random walk on the n! permutations and its analysis needs Markov chains and hitting times rather than a geometric distribution. Gruber, Holzer and Ruepp distinguish a version that may pick the same position twice from one that always swaps two distinct positions.

For the distinct-positions version they carry over a result of Flatto, Odlyzko and Wales on random transpositions: the expected number of swaps on an average input is n! + 2(n − 2)! plus lower-order terms. For comparisons they give only bounds between roughly n! and n·n!, and conjecture that the true order is n!; that open question is why the average is recorded as a range. The worst case has no bound at all.

This is a bespoke plate: expected time of order n! means the same small-n limit as bogosort, below the array engine's smallest size. The plate lets the reader set a small n and a seed and watch the walk: swaps that move the array closer to sorted and swaps that undo progress, with the measured swap count set against the expected one.

A single change makes it reasonable: swap a pair only when it is an inversion, and the number of swaps is at most n(n − 1)/2, with polynomial expected time. Comparing the two on Random permutation at the plate's largest n shows how much the blind version wastes.
