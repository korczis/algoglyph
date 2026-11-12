---
id: ruler-drawing
title: Drawing a ruler recursively
taxonomy: foundations/recursion
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - recursion
  - divide and conquer
complexity: '2ⁿ − 1 marks; the recursive versions make 2ⁿ⁺¹ − 1 calls at depth at most n'
related:
  - towers-of-hanoi
---

Mark the middle, then each half, recursively: the ticks of a ruler are the call tree.

To mark a ruler of 2ⁿ units, mark the middle at height n, then mark each half the same way at height n − 1. Every position x from 1 to 2ⁿ − 1 gets exactly one mark, and its height is one more than the number of trailing zero bits of x.

The dots above the ruler are the recursion tree: each mark is the middle of its interval, and its two children are the middles of the halves. The variants differ only in when the mark is made. In order (left half, mark, right half) the marks appear left to right; mark-first visits the tree from the top down; the bottom-up version draws every mark of height 1, then of height 2, and needs no recursion or stack at all.

The recursive versions make 2ⁿ⁺¹ − 1 calls in all, 2ⁿ of them at height 0 returning at once. For the recursive versions the readouts count the calls, with the total once drawing ends, and the depth of the stack at each mark; the bottom-up version makes no calls, so it reports the height it is drawing instead.
