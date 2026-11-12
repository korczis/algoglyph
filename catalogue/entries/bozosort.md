---
id: bozosort
title: Bozosort
taxonomy: sorting/esoteric
status: live
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

This is a bespoke plate: expected time of order n! means the same small-n limit as bogosort, below the array engine's smallest size. The plate runs the compiled kernel's algorithm step by step on n from 2 to 8 distinct keys and draws the walk as the number of inversions after each swap, counting the swaps that removed inversions, added them or changed nothing. The kernel draws the two positions independently, so a swap of a position with itself happens and is counted. For that version the expected number of swaps is computed exactly, not estimated: the swaps move the permutation that sorts the array by a transposition, so how far it is from sorted depends only on its cycle type, and the expected hitting time of the identity solves a small linear system over the partitions of n (the tests check it against the same chain solved over all n! permutations, and against many seeded runs). The chart sets the running mean of the measured swaps against that expectation for the same inputs.

A single change makes it reasonable: swap a pair only when it is an inversion, and the number of swaps is at most n(n − 1)/2, with polynomial expected time. Every such swap removes at least one inversion, so the swaps never exceed the inversions of the input, which is what the plate's Swap rule control sets the repaired version against. Comparing the two on Random permutation at the plate's largest n shows how much the blind version wastes.
