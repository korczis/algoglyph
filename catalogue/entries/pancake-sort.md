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
---

Sort a stack when the only move is a flip: reverse the top k items, as a spatula turns over the top k pancakes. Bring the largest unsorted pancake to the top with one flip, then flip it down to the bottom of the unsorted part with a second.

The question is the number of flips, not of comparisons. The simple method needs at most 2n − 3; Gates and Papadimitriou proved that (5n + 5)/3 always suffice and that some stacks need 17n/16, counting adjacencies because one flip creates at most one new one. Chitturi and colleagues lowered the upper bound to (18/11)n, and Bulteau, Fertin and Rusu showed that finding the shortest flip sequence for a given stack is NP-hard.

The flips are linear in number but the running time is quadratic: every round searches s keys for the maximum and a flip moves up to s of them, whatever the input, exactly like selection sort. On the plate the top of the stack is the left end of the array. Start with Random permutation at n = 32 and watch each round reverse a prefix twice; Already sorted still pays the full search in every round.

It is not stable, since a flip reverses the order of everything it touches. As a general sort it makes no sense; it models settings where a prefix reversal is the only cheap operation, and it shows how the cost of one algorithm depends on which operation you count. The problem was posed under the pseudonym Harry Dweighter, whom Gates and Papadimitriou identify as Jacob E. Goodman.
