---
id: quick-find
title: Quick-find
taxonomy: foundations/connectivity
status: live
engine: tree
labs:
  - union-find
sources:
  - id: sedgewick-aic
    ref: "Part 1: Fundamentals"
tags:
  - union-find
  - connectivity
complexity: "one array access per find, n per union: quadratic for n unions"
related:
  - quick-union
---

Every object carries its component id, so a find is one look-up and a union rewrites every member of one side.

The plate draws the id array as a forest: every site hangs directly under the site whose index is its component id, so each tree is a star one level deep. The strip below the forest is the array itself, and the cells highlighted during a union are the ones the scan rewrote.

A find costs one array read, but every union reads all n entries, whatever the sizes of the two components. Each read and write is counted as performed; in the union-find lab this kernel's cost per union grows in proportion to n. Plain quick-union grows too, with the height of its trees, and only the weighted versions stay nearly flat.
