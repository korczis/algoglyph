---
id: bogobogosort
title: Bogobogosort
taxonomy: sorting/esoteric
status: live
engine: custom
sources:
  - id: morgan-mar-2013
    ref: the definition, readers' estimates and timings
  - id: gruber-2007
    ref: the analysed bogosort it parodies
  - id: lerma-2014
    ref: slower deterministic sorts
tags:
  - sorting
  - esoteric
  - randomized
  - recursion
complexity: n² best, unknown average, unbounded worst; extra space n²
related:
  - bogosort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [bogosort]
  objectives:
  - 'Read the this-run readout of a finished run: its comparisons are always its swaps plus n − 1.'
  - 'Read shuffles by prefix length: a shuffle of a prefix of m keys costs m − 1 swaps, and every failure of a longer prefix sends the shorter ones back to be shuffled again.'
  - 'Watch the mean shuffles per run approach Σ m! over the prefixes whose last key is not their largest: n! − 1 = 119 averaged over the inputs of five keys.'
  misconceptions:
  - 'Nested random tests make the plate''s bogobogosort shuffle more than bogosort; its kernel, which skips the copy, expects n! − 1 shuffles averaged over the inputs, as bogosort does. The explosion Morgan-Mar measured comes from the comparison with the original that the kernel omits.'
algorithm:
  paradigm: randomized
  properties:
    stable: false
bounds:
  model: 'per run: shuffles (by prefix length), comparisons (one check of a prefix''s last key per attempt) and swaps (a shuffle of a prefix of m keys is m − 1 swaps)'
  best: 'Already sorted: n − 1 comparisons and no shuffle on the plate''s kernel, which skips the copies; quadratic in Morgan-Mar''s definition'
  average: 'Σ m! expected shuffles over the prefixes whose last key is not their largest, n! − 1 averaged over the inputs of n distinct keys (test/plate-bogobogosort.test.ts); for Morgan-Mar''s full definition unknown'
  worst: 'unbounded; in every run the comparisons are exactly the swaps plus n − 1'
---

Bogosort with a recursive sortedness test: to decide whether a list is sorted, copy it, bogobogosort all but the last element of the copy, shuffle the copy until its last element exceeds the rest, and only then ask whether the copy matches the original.

Morgan-Mar wrote it as a parody of bogosort, whose linear test he calls "too efficient". Every level of the test repeats random shuffles inside the random shuffles of the level above, so the expected cost multiplies with each element. On Already sorted every level succeeds at once, but each still copies and compares its list, which gives the quadratic best case and the quadratic memory for the copies.

Nobody knows the expected running time. The author offers only a guess, and the two reader estimates printed on his page contradict each other; neither is peer reviewed, so the average case is recorded as unknown. His own measurements show the explosion directly: six elements took minutes on average, and seven did not finish overnight.

This is a bespoke plate: no input at the array engine's sizes would ever finish. The plate runs the compiled kernel's algorithm step by step on n from 2 to 8 distinct keys, dims the keys beyond the prefix being checked, and counts the shuffles spent on each prefix length and the comparisons as they happen. The kernel simplifies the definition: it sorts the array itself and leaves out the final comparison with the original, and it gives up after 2 000 shuffles in all, reporting the run as truncated; the plate leaves its runs uncut.

The simplification changes the growth, and the plate shows by how much. A call on a prefix of m keys first sorts the m − 1 before it, which never moves the m-th key, so it fails exactly when that key is smaller than one before it; after a failure the prefix is a fresh uniform shuffle, its last key is the largest with probability 1/m, and the expected shuffles T_m of a call on a shuffled prefix satisfy T_m = T_(m−1) + (1 − 1/m)(1 + T_m), which gives 1 + T_m = m!. On a given input the expected shuffles are therefore the sum of m! over the prefixes whose last key is not their largest, and n! − 1 on average over random inputs: no more shuffles than bogosort, though each one is spent deeper in the recursion. The chart sets the running mean of the measured shuffles against that sum for the same inputs; the explosion Morgan-Mar measured comes from the comparison with the original that the kernel omits.

It is useful in teaching as an exercise in setting up a recurrence for nested random repetitions and in finding which step of a contested estimate fails. Bogosort, by contrast, has exact expectations derived by elementary means, and Lerma's worstsort shows that even bogobogosort is not a ceiling on slowness.
