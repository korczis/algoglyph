---
id: bst-search-insert
title: Binary search tree
taxonomy: searching/binary-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - binary search tree
  - symbol table
complexity: about 1.39 lg n compares per search on random keys, n in the worst case
related:
  - bst-delete-join
  - red-black-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Search and insert by comparing down from the root, a new key hanging where the search fell off.
  - See that the shape is the insertion order, a path of n levels on ascending or descending keys.
algorithm:
  paradigm: search
bounds:
  model: key comparisons
  average: about 2 ln n, roughly 1.39 lg n, per search on random keys
  worst: n per search, on the path of n levels that ascending or descending keys build
---

Search and insert by comparing down from the root; the shape is the insertion order.

A search compares the key with the root and goes left or right until it finds the key or falls off the tree; an insertion is the same search ending with a new leaf where it fell off. The highlighted path is the current operation's, and every comparison and node touched is counted.

On a random order the average search costs about 2 ln n, roughly 1.39 lg n, comparisons. Ascending or descending keys build a path of n levels instead, which the height curve against lg(n+1) makes plain.
