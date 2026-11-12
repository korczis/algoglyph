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
---

Cut one rod of spaghetti to the length of each key, stand the bundle on the table, and lower a hand onto it: the first rod it touches is the longest. Take it out and lower the hand again until the bundle is gone.

On the analogue machine, finding the maximum is one physical motion rather than n − 1 comparisons, because geometry and gravity compare every length at once. That is why the thought experiment, from Dewdney's Computer Recreations column, sorts in a linear number of steps without contradicting the n log n lower bound: that bound holds for decision trees, where each comparison looks at two keys, and the hand looks at all of them.

The cost hides in the assumptions. Cutting and measuring have limited precision, so ever finer differences need ever more physical work, and a bundle of a million rods cannot be grasped in constant time. Dewdney offered it as an illustration of analogue computation, not as a tool.

A computer has to pay for the hand: the plate simulates each lowering by comparing all remaining rods, so the readouts show selection sort's quadratic comparisons, with the rods laid down from the right, longest first. Start with Random permutation at n = 64 and set it beside selection sort in the lab; replace the hand by a heap and the same steps become heapsort.
