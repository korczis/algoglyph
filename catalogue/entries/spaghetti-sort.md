---
id: spaghetti-sort
title: Spaghetti sort
taxonomy: sorting/special
status: live
engine: array
labs:
  - sorting
sources:
  - id: dewdney-1984
    ref: the spaghetti computer
  - id: cormen-2022
    ref: the decision-tree lower bound it steps outside
  - id: knuth-taocp-3
    ref: "5.2.3 Sorting by selection"
tags:
  - sorting
  - special-purpose
  - analogue computing
  - thought experiment
complexity: n physical steps on the analogue machine; n² comparisons when simulated; extra space n
related:
  - bead-sort
  - counting-sort
  - selection-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [selection-sort]
  objectives:
  - 'Read Comparisons at 64 keys: 2,016 on every input, n(n − 1)/2, the price of simulating the hand by comparing every rod left.'
  - 'Read the Phase readout: n + 1 phases, cutting the bundle and then one lowering of the hand per rod.'
  - 'Compare Auxiliary writes on Already sorted and Reversed at 64 keys: 64 against 2,080, since every rod taken from the front shifts the rest of the bundle.'
  misconceptions:
  - 'Spaghetti sort beats the n log n lower bound on a computer; the plate pays n(n − 1)/2 comparisons on every input, because the hand''s parallel comparison has to be simulated.'
algorithm:
  properties:
    in_place: false
bounds:
  model: 'comparisons (each lowering of the hand compares every rod left), array writes (each rod laid down) and auxiliary writes (the bundle drawn, then every rod shifted when one is taken out)'
  best: 'n auxiliary writes on Already sorted'
  average: 'n(n − 1)/2 comparisons, n array writes and n + 1 phases on every input; a linear number of steps on Dewdney''s analogue machine, the source''s model and not the plate''s'
  worst: 'n(n + 1)/2 auxiliary writes on Reversed'
claims:
  - id: the-hand-costs-quadratic-comparisons
    statement: >-
      On Random permutation at 64 keys spaghetti sort makes 2,016 comparisons, n(n − 1)/2: every lowering of the hand is simulated by comparing all the rods left.
    readout: Comparisons
    expect: { value: 2016 }
    setup:
      params: { shape: random, n: 64 }
---

Cut one rod of spaghetti to the length of each key, stand the bundle on the table, and lower a hand onto it: the first rod it touches is the longest. Take it out and lower the hand again until the bundle is gone.

On the analogue machine, finding the maximum is one physical motion rather than n − 1 comparisons, because geometry and gravity compare every length at once. That is why the thought experiment, from Dewdney's Computer Recreations column, sorts in a linear number of steps without contradicting the n log n lower bound: that bound holds for decision trees, where each comparison looks at two keys, and the hand looks at all of them.

The cost hides in the assumptions. Cutting and measuring have limited precision, so ever finer differences need ever more physical work, and a bundle of a million rods cannot be grasped in constant time. Dewdney offered it as an illustration of analogue computation, not as a tool.

A computer has to pay for the hand: the plate simulates each lowering by comparing all remaining rods, so the readouts show selection sort's quadratic comparisons, with the rods laid down from the right, longest first. Start with Random permutation at n = 64 and set it beside selection sort in the lab; replace the hand by a heap and the same steps become heapsort.
