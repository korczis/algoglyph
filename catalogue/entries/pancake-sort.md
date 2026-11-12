---
id: pancake-sort
title: Pancake sort
taxonomy: sorting/special
status: live
engine: array
labs:
  - sorting
sources:
  - id: gates-1979
    ref: the problem, the simple algorithm and the first bounds
  - id: chitturi-2009
    ref: the (18/11)n upper bound
  - id: bulteau-2015
    ref: NP-hardness of the shortest flip sequence
  - id: knuth-taocp-3
    ref: "5.2.3 Sorting by selection"
tags:
  - sorting
  - special-purpose
  - quadratic
  - in-place
  - prefix reversal
complexity: at most 2n − 3 flips; n² comparisons and moves in every case; extra space 1
related:
  - double-selection-sort
  - selection-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [selection-sort]
  objectives:
  - 'Read Comparisons at 64 keys: 2,016 on every input, n(n − 1)/2, the full search for the largest pancake left in every round, even on Already sorted.'
  - 'Run Reversed at 64 keys: one flip of the whole stack, 64 array writes, 32 exchanges.'
  - 'Read the Phase readout: it counts the flips, at most 2n − 3, and some stack of every size from 2 to 8 needs all of them.'
  misconceptions:
  - 'Fewer flips means less work; Already sorted makes no flip at all and still costs n(n − 1)/2 comparisons, as many as any other input.'
algorithm:
  paradigm: greedy
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons (the search for the largest pancake left), array writes (a flip of k pancakes is ⌊k/2⌋ exchanges, two writes each) and flips (the Phase readout''s count)'
  best: 'no flip and no array write on Already sorted; one flip and 2⌊n/2⌋ array writes on Reversed'
  average: 'n(n − 1)/2 comparisons on every input'
  worst: 'at most 2n − 3 flips by the simple method, reached at every n from 2 to 8; the bounds on the best method are the sources'' (Gates and Papadimitriou; Chitturi et al.)'
claims:
  - id: reversed-is-one-flip
    statement: >-
      On Reversed at 64 keys pancake sort makes 64 array writes: one flip of the whole stack, 32 exchanges, sorts it.
    readout: Array writes
    expect: { value: 64 }
    setup:
      params: { shape: reversed, n: 64 }
---

Sort a stack when the only move is a flip: reverse the top k items, as a spatula turns over the top k pancakes. Bring the largest unsorted pancake to the top with one flip, then flip it down to the bottom of the unsorted part with a second.

The question is the number of flips, not of comparisons. The simple method needs at most 2n − 3; Gates and Papadimitriou proved that (5n + 5)/3 always suffice and that some stacks need 17n/16, counting adjacencies because one flip creates at most one new one. Chitturi and colleagues lowered the upper bound to (18/11)n, and Bulteau, Fertin and Rusu showed that finding the shortest flip sequence for a given stack is NP-hard.

The flips are linear in number but the running time is quadratic: every round searches s keys for the maximum and a flip moves up to s of them, whatever the input, exactly like selection sort. On the plate the top of the stack is the left end of the array. Start with Random permutation at n = 32 and watch each round reverse a prefix twice; Already sorted still pays the full search in every round.

It is not stable, since a flip reverses the order of everything it touches. As a general sort it makes no sense; it models settings where a prefix reversal is the only cheap operation, and it shows how the cost of one algorithm depends on which operation you count. The problem was posed under the pseudonym Harry Dweighter, whom Gates and Papadimitriou identify as Jacob E. Goodman.
