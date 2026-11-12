---
id: worstsort
title: Worstsort
taxonomy: sorting/esoteric
status: planned
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
---

Sort a list by listing all its permutations, sorting that list of lists lexicographically with the same method one level down, and taking its first element; worstsort picks the number of levels from the length of the input.

Lerma's question was how inefficient a sort can be without cheating: no idle loops, no artificial delays, every step aimed at the sorted result. His building block is a deterministic bogosort. Level 0 is bubble sort; level k builds the list of all permutations, sorts it with level k − 1, and copies out the first permutation, which is necessarily the sorted input. Comparing lists is lexicographic, down to comparisons of the keys themselves.

Bubble sort of m items costs on the order of m² comparisons, so one level over n! permutations costs at least about (n!)², two levels at least about ((n!)!)², and so on. Choosing the level by an increasing computable function f makes the running time exceed f itself: there is no computable ceiling on how slow a reasonable sort can be. Unlike bogosort, whose best case is linear, every input costs the same, and the permutation lists really are built, so memory explodes with time.

This is a bespoke plate: the kernel refuses inputs longer than five keys, while the array engine starts at n = 8. The plate lets the reader choose n from 2 to 5 and the number of levels where it is still feasible, shows the list of permutations being bubble-sorted, and counts every key comparison inside the lexicographic ones, so the reader can watch the counts jump by factorials from one n to the next.

Lerma links the question to computability: worstsort is itself computable, so busy-beaver functions still outgrow it, but any fixed computable bound can be beaten. Slowsort is the gentler cousin, deliberately slow and deterministic but with a fixed subexponential cost.
