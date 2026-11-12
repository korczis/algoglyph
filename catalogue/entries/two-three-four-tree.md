---
id: two-three-four-tree
title: Top-down 2-3-4 tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - balanced trees
  - 2-3-4
  - split
complexity: between log4 n and lg n levels; every leaf at the same depth
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Split every 4-node met on the way down, so an insertion never has to come back up.
  - See that the tree grows only at the root, which keeps every leaf at the same depth.
bounds:
  model: levels
  worst: between log₄(n+1) and lg(n+1), every leaf at the same depth
---

Split every 4-node on the way down, so an insertion never has to come back up.

Nodes are drawn as boxes of one, two or three keys with their children hanging between the keys. When the descent meets a 4-node it splits it first: the middle key moves up into the parent, which has room because it would itself have been split on the way down. A full root becomes a new root of one key, the only way the tree gets taller.

Every leaf stays at the same depth and every node branches two to four ways, so the height lies between log4 n and lg n levels. The red-black tree is the same structure encoded in binary nodes.
