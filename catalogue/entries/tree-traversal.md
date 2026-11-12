---
id: tree-traversal
title: Tree traversal orders
taxonomy: foundations/recursion
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - trees
  - preorder
  - inorder
  - postorder
  - level order
complexity: "linear: each order visits every node once"
related:
  - bst-search-insert
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Visit the same tree in preorder, inorder, postorder and level order.
  - See why inorder emits a search tree's keys sorted.
  - Compare the implicit stack of the recursive orders with the explicit queue of level order.
---

Preorder, inorder, postorder and level order visiting the same tree.

The tree is grown by plain search-tree insertion from the chosen input and then traversed four times; the strip under the tree collects the keys in the order each traversal emits them, one group per order.

Inorder comes out sorted, because every key sits between its smaller left and larger right subtree. Preorder writes a node before its subtrees and postorder after them; these three recurse, using an implicit stack as deep as the tree, while level order uses an explicit queue as wide as the widest level.
