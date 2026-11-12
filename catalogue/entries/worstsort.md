---
id: worstsort
title: Worstsort
taxonomy: sorting/esoteric
status: live
engine: custom
sources:
  - id: lerma-2014
    ref: the construction and its lower bounds
  - id: gruber-2007
    ref: the bogosort analysis it builds on
tags:
  - sorting
  - esoteric
  - deterministic
  - permutations
  - computability
complexity: (n!^(f(n)))² in every case; extra space depending on f
related:
  - bogobogosort
  - bogosort
  - bubble-sort
  - permutation-generation
  - slowsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [bubble-sort, permutation-generation]
  objectives:
  - 'Read items bubble-sorted: n! at the kernel''s one level for 3 to 5 keys, 120 at five.'
  - 'Choose Already sorted at four keys: 23 lexicographic comparisons and no swap, n! − 1, since the permutations are listed in order.'
  - 'Choose Reversed at four keys: 276 lexicographic comparisons and 276 swaps, n!(n! − 1)/2, since the list arrives reversed.'
  misconceptions:
  - 'The slowest reasonable sort costs the same on every input; the plate''s bubble sort stops after a pass without a swap, so Already sorted costs n! − 1 list comparisons where Reversed costs n!(n! − 1)/2.'
algorithm:
  properties:
    stable: true
claims:
  - id: sorted-input-costs-n-factorial-minus-one
    statement: >-
      On Already sorted keys at n = 4 and one level, a completed run makes n! − 1 = 23
      lexicographic comparisons: the 24 permutations are listed in order, so the bubble sort's
      first pass finds nothing to swap and stops.
    readout: last completed run
    expect: { value: 23 }
    setup:
      params: { n: 4, shape: sorted, levels: '1', runs: 3 }
bounds:
  model: 'lexicographic comparisons and swaps of the bubble sort over the permutation list, and the key comparisons inside them, counted live'
  best: 'Already sorted: n! − 1 lexicographic comparisons and no swap, at the kernel''s level for 3 to 5 keys'
  average: 'the bubble sort''s swaps equal the inversions of the permutation list, and its comparisons are what the list determines (test/plate-worstsort.test.ts)'
  worst: 'Reversed: n!(n! − 1)/2 lexicographic comparisons and as many swaps; with an increasing computable f(n) levels, slower than f itself (Lerma)'
---

Sort a list by listing all its permutations, sorting that list of lists lexicographically with the same method one level down, and taking its first element; worstsort picks the number of levels from the length of the input.

Lerma's question was how inefficient a sort can be without cheating: no idle loops, no artificial delays, every step aimed at the sorted result. His building block is a deterministic bogosort. Level 0 is bubble sort; level k builds the list of all permutations, sorts it with level k − 1, and copies out the first permutation, which is necessarily the sorted input. Comparing lists is lexicographic, down to comparisons of the keys themselves.

Bubble sort of m items costs on the order of m² comparisons, so one level over n! permutations costs at least about (n!)², two levels at least about ((n!)!)², and so on. Choosing the level by an increasing computable function f makes the running time exceed f itself: there is no computable ceiling on how slow a reasonable sort can be. Unlike bogosort, whose best case is linear, every input pays for the whole permutation list, and the lists really are built, so memory explodes with time; the plate's bubble sort stops after a pass without a swap, so its cost still varies with the input, from n! − 1 list comparisons on Already sorted to n!(n! − 1)/2 on Reversed.

This is a bespoke plate: the kernel refuses inputs longer than five keys, while the array engine starts at n = 8. The plate lets the reader choose n from 2 to 5 and the number of levels where it is still feasible, shows the list of permutations being bubble-sorted, one row per permutation, and counts every key comparison inside the lexicographic ones, so the reader can watch the counts jump by factorials from one n to the next. At the kernel's own choice of levels (two for n ≤ 2, one for 3 ≤ n ≤ 5) it runs the kernel's algorithm step by step and shows the compiled kernel's count for the same input beside its own; a level whose list would be too long to build is refused and named. The chart sets the counted lexicographic comparisons and swaps of the bubble sort against what the list itself determines: its swaps are its inversions, and it runs one pass more than the largest number of greater items standing before any item.

Lerma links the question to computability: worstsort is itself computable, so busy-beaver functions still outgrow it, but any fixed computable bound can be beaten. Slowsort is the gentler cousin, deliberately slow and deterministic but with a fixed subexponential cost.
