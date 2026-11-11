---
id: tree-sort
title: Tree sort
taxonomy: sorting/trees
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "6.2.2 Binary tree searching"
  - id: cormen-2022
    ref: "Chapter 12: Binary search trees"
tags:
  - sorting
  - search tree
  - insertion
  - online
complexity: n log n best, n log n average, n² worst; extra space n
related:
  - bst-search-insert
  - cartesian-tree-sort
  - insertion-sort
  - quicksort
---

Insert the keys one by one into a binary search tree, each descending from the root to an empty leaf, then read them back by an in-order walk: left subtree, node, right subtree.

It is insertion sort with a better place to insert into: finding a key's position takes one comparison per level of the tree and nothing has to be shifted. The cost of the whole sort is the total depth of the nodes, and for keys arriving in random order the expected height of the tree is logarithmic, so the expected cost is n log n.

The order of arrival is everything. Run it on Random permutation at n = 64, then on Already sorted: every key becomes the right child of the one before, the tree degenerates into a list, and the comparisons climb to n(n − 1)/2. Reversed does the same on the left.

The deeper connection is with quicksort: the root plays the part of the first pivot, and a random binary search tree is the recursion tree of quicksort that partitions around the first key. Sending equal keys always to the right keeps them in arrival order in the in-order walk, so stability depends on that rule. When an n log n guarantee is needed, the tree has to be balanced, as in AVL tree sort.
