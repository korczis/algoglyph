---
id: double-selection-sort
title: Double selection sort
taxonomy: sorting/elementary
status: planned
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2.3 Sorting by selection"
  - id: cormen-2022
    ref: simultaneous minimum and maximum
  - id: sedgewick-2011
    ref: "Chapter 2: Sorting"
tags:
  - sorting
  - selection
  - quadratic
  - in-place
complexity: n² in every case; extra space 1
related:
  - heapsort
  - selection-sort
  - shaker-sort
---

Selection sort from both ends: each pass finds the smallest and the largest key of the unsorted middle, puts the minimum at its left edge and the maximum at its right edge, and the middle shrinks by two.

The sorted parts grow from both sides towards each other, so there are about half as many passes as in plain selection sort, but each pass still scans the whole middle. Finding both extremes together can be done with fewer comparisons than two separate scans by taking keys in pairs, which changes the constant and never the quadratic order.

One trap hides in the exchanges: if the maximum sat exactly at the left edge, moving the minimum there displaces it, and its index has to follow it before the second exchange. Start with Random permutation at n = 64 and watch the two bands close in; then try Already sorted, which costs just as many comparisons because nothing in the method looks at existing order.

No publication names this variant: the textbooks describe straight selection and, separately, the simultaneous minimum-and-maximum problem, so it is best read as a variant of selection sort rather than a discovery of its own. Like selection sort it is not stable, since a long exchange can carry a key past an equal one. The real speed-up of selection comes from remembering comparisons, as heapsort and tournament sort do.
