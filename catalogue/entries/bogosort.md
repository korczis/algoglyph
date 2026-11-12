---
id: bogosort
title: Bogosort
taxonomy: sorting/esoteric
status: live
engine: custom
sources:
  - id: gruber-2007
    ref: the exact expected counts of comparisons and swaps
  - id: lerma-2014
    ref: the deterministic variant that enumerates permutations
  - id: morgan-mar-2013
    ref: the recursive variant
tags:
  - sorting
  - esoteric
  - in-place
  - randomized
  - shuffling
complexity: n best, n·n! average, unbounded worst; extra space 1
related:
  - permutation-generation
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [permutation-generation]
  objectives:
  - 'Read the this-run readout: every shuffle is n − 1 swaps, so a run''s swaps are always n − 1 times its shuffles.'
  - 'Choose Already sorted: no shuffle, no swap and n − 1 comparisons, and the expected-on-this-input readout says 0.'
  - 'Watch the mean shuffles per run approach the mean theory expects for the same inputs: n!/Πmᵢ! for each unsorted input, 120 for five distinct keys.'
  misconceptions:
  - 'Repeated keys make bogosort slower; they make more arrangements sorted, so the expected shuffles fall to n!/Πmᵢ!: 6 instead of 24 for four keys of two values, two of each.'
algorithm:
  paradigm: randomized
  properties:
    stable: false
  postconditions:
    - A run that ends leaves the keys ascending; it ends with probability 1, after no fixed number of shuffles.
bounds:
  model: 'per run (the this-run readout): shuffles, comparisons (the sortedness check stops at the first descent) and swaps (a shuffle of n keys is n − 1 swaps)'
  best: 'Already sorted: n − 1 comparisons, no shuffle and no swap'
  average: 'n!/Πmᵢ! expected shuffles from an unsorted input with key multiplicities mᵢ, n! for distinct keys (test/plate-bogosort.test.ts), hence (n − 1) times as many swaps; about (e − 1)·n! comparisons (Gruber, Holzer and Ruepp)'
  worst: 'unbounded; in every run the swaps are n − 1 times the shuffles, and the comparisons lie between shuffles + n − 1 and (n − 1)(shuffles + 1)'
---

Check whether the array is sorted; if it is not, shuffle it uniformly at random and check again, forgetting everything the previous attempts revealed.

Each shuffle succeeds with probability 1/n!, so the number of shuffles is geometric with mean n!. Gruber, Holzer and Ruepp work out the exact expectations: (n − 1)·n! swaps on an unsorted input, and only about (e − 1)·n! comparisons, because the sortedness test on a random permutation usually stops after one or two neighbours. Already sorted is the best case: n − 1 comparisons and no swap.

It is a correct sort in a narrow sense: when it stops, the output is the sorted input, and it stops with probability 1. It is never guaranteed to stop, since no number of steps bounds a single run. That gap between "almost surely" and "always" is exactly what makes it a good first exercise in geometric distributions and linearity of expectation.

This is a bespoke plate, not an array-engine one: expected work of order n·n! means only a handful of keys ever finish, while the array engine starts at n = 8 and its harness sorts far larger inputs. The plate runs the compiled kernel's own algorithm step by step, with the kernel's seeded shuffle, on n from 2 to 9 keys; its tests prove that for the same seed and input it ends exactly where the kernel ends, with the same counts. Run follows run, and the chart sets the running mean of the shuffles against the mean theory expects for the same inputs: none for an input already sorted, otherwise n!/(m₁!·m₂!·…) when keys repeat with multiplicities mᵢ, which is n! for distinct keys. The kernel gives up after 10 000 shuffles and reports the run as truncated, never as sorted; the plate does not stop a run, so every run it counts ends sorted, and at n = 9 that takes a few seconds even at the highest speed.

The origin is hacker folklore with no dated author; the first detailed analysis we can cite is the 2007 paper. Its relatives change one part each: bozosort swaps two random positions instead of shuffling, bogobogosort makes the sortedness test recursive, and Lerma's deterministic version walks through all n! permutations instead of drawing them, the seed of worstsort.
