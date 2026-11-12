---
id: towers-of-hanoi
title: Towers of Hanoi
taxonomy: foundations/recursion
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - recursion
  - divide and conquer
complexity: '2ⁿ − 1 moves, recursion depth n'
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
  - ruler-drawing
  objectives:
  - Solve the puzzle by moving n − 1 discs aside, the largest once and the n − 1 back.
  - Derive 2ⁿ − 1 moves from T(n) = 2T(n − 1) + 1, and why no solution uses fewer.
algorithm:
  paradigm: divide-and-conquer
bounds:
  model: disc moves
  best: 2ⁿ − 1
  worst: 2ⁿ − 1
  space: recursion depth n
---

Move n discs by moving n − 1 aside, the largest once, and the n − 1 back: 2ⁿ − 1 moves.

Moving n discs to another peg means moving the top n − 1 to the spare peg, the largest disc to the target, and the n − 1 back on top of it. The move count obeys T(n) = 2T(n − 1) + 1 with T(0) = 0, which gives 2ⁿ − 1, and no solution uses fewer.

Disc k moves 2ⁿ⁻ᵏ times, and the disc moved at move j is the height of the ruler's mark at position j. The smallest disc moves on every other move, always round the pegs in the same direction, which gives an iterative solution with no recursion; the tests check the recursive moves against it and replay every move to show that none puts a larger disc on a smaller one.

Discs are coloured by size. The readouts count the moves made, the recursion depth of the call that made the move in flight, and how often the smallest and the largest disc have moved.
