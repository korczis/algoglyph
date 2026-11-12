---
id: binary-search
title: Binary search
taxonomy: searching/elementary
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - search
  - sorted array
  - divide and conquer
complexity: 'at most ⌊lg n⌋ + 1 probes'
related:
  - interpolation-search
  - sequential-search
  - bst-search-insert
---

Halve the sorted interval that can hold the key, lg n times at most.

Keep an interval of the sorted array that must hold the key if it is present, probe its middle and discard the half that cannot hold it. At most ⌊lg n⌋ + 1 probes are needed, whether the key is found or not.

The bars are the keys, the shaded band is the interval still in play and the horizontal line is the key sought. Below, every probe ever made is placed at its position in the array and its step in the search, joined to the probe after it. A position is always probed at the same step, so the map is the implicit balanced binary search tree.

Searches look for a stored key with the chosen probability and otherwise for a key not stored; the readouts and the chart count the probes of every search from the run.
