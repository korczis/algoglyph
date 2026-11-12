---
id: burnt-pancake-sort
title: Burnt pancake sort
taxonomy: sorting/special
status: live
engine: custom
sources:
  - id: gates-1979
    ref: the burnt variant and its first bounds
  - id: cohen-1995
    ref: the improved bounds
tags:
  - sorting
  - special-purpose
  - quadratic
  - in-place
  - prefix reversal
  - signed permutation
complexity: at most 3n flips for the simple method; n² moves in every case; extra space 1
related:
  - pancake-sort
  - selection-sort
---

Pancake sorting with a burnt side: a flip reverses the top k pancakes and turns each of them over, and the stack is sorted only when it is in order and every burnt side faces down.

Formally it sorts signed permutations: pancake i is +i when it lies correctly and −i when its burnt side is up, a flip of length k reverses and negates the first k entries, and the goal is +1, +2, …, +n. The simple method works like pancake sort with one extra step: flip the largest unsorted pancake to the top, turn it over alone if the next flip would leave it burnt side up, then flip it into place, at most three flips per size.

Gates and Papadimitriou bounded the worst case between 3n/2 − 1 and 2n + 3 flips, and Cohen and Blum later tightened both bounds. The time of the simple method is still quadratic, since every round searches for the maximum and a flip moves up to s pancakes.

This one is a bespoke plate because every pancake carries an orientation as well as a size, and the keys-only array plate can neither show nor check it. The plate draws the stack with each burnt side as a dark band and the spatula under the pancakes being flipped, and lets the reader set the number of pancakes and their starting orientations: drawn at random by the kernel's own seeded generator, all burnt side up, or all down; start with a random stack of a dozen. Each stack's flips are counted and charted against 3n, the simple method's own bound, and against the bounds above on the best method. It shows how one extra bit of state per item changes the constants of the bounds, not their linear order.
