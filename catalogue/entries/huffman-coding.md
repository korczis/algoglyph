---
id: huffman-coding
title: Huffman coding
taxonomy: strings/compression
status: live
engine: tree
sources:
  - id: sedgewick-aic-1990
    ref: String Processing
tags:
  - compression
  - prefix codes
  - greedy
complexity: n lg n for n symbols with a binary heap
related:
  - binary-heap
---

Merge the two rarest symbols until one tree is left: the optimal prefix code.

Each leaf is labelled with its symbol and its weight, the frequency drawn from the chosen distribution. The forest shrinks by one tree at every merge, the two lightest joined under a new parent; the queue is a binary heap of trees ordered by weight, and its comparisons are counted.

A symbol's code is its path, 0 for left and 1 for right. No code is a prefix of another because symbols sit only at leaves, and the encoded length, the sum of weight times depth, is the least of any prefix code, which the harness checks by exhaustive search on small alphabets. The readout sets it against the entropy bound, which no symbol-by-symbol code can beat; Fibonacci frequencies give the deepest possible tree.
