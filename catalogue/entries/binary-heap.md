---
id: binary-heap
title: Binary heap priority queue
taxonomy: sorting/priority-queues
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - heap
  - priority queue
  - sift up
  - sift down
complexity: at most lg n compares per insert and 2 lg n per remove-max
related:
  - heapsort
  - binomial-queue
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Watch an insert swim on Ascending: every new key climbs to the root, ⌊lg k⌋ comparisons for the k-th, 1,538 for all 255.'
  - 'Read Cost per insert on Descending: no key swims, so every insert after the first costs one comparison and three array accesses.'
  - 'Explain why a remove-max of m keys needs up to 2⌊lg(m − 1)⌋ comparisons, two per level it sinks, where an insert needs one per level it climbs.'
  misconceptions:
  - 'Building a heap by inserting the keys one by one is as cheap as the bottom-up construction; on Ascending the inserts cost Σ⌊lg k⌋ comparisons, of order n lg n, where heapsort builds its heap with fewer than 2n.'
bounds:
  model: 'key comparisons, and array reads and writes (the Cost per operation readouts sum the reads and writes)'
  average: 'on Descending one comparison and three array accesses for every insert after the first, n − 1 comparisons for the n inserts'
  worst: 'the k-th insert at most ⌊lg k⌋ comparisons, exactly that on Ascending (Σ_{k≤n}⌊lg k⌋ for n inserts); a remove-max of m keys at most 2⌊lg(m − 1)⌋'
claims:
  - id: descending-inserts-never-swim
    statement: >-
      On Descending at 255 keys no insert swims: every insert after the first costs three array accesses, one write and the two reads of its one comparison, so Cost per insert averages (3n − 2)/n = 2.99.
    readout: Cost per insert
    expect: { value: 2.99, tolerance: 0.005 }
    setup:
      params: { shape: descending, n: 255, speed: 2000 }
---

Insert sifts a key up, remove-max sinks the replacement down, in a complete binary tree.

The heap lives in the array strip at the bottom, positions 1 to n; the tree above is the same array read with the parent of position k at k/2. An insert starts at a new leaf and swims, a remove-max starts at the root and sinks, and the highlighted cells and nodes are the positions the operation touched.

Every key is inserted first, then the maxima are removed one by one and fill the output strip, largest first: heapsort through a priority-queue interface. Building by repeated insertion costs up to n lg n compares, where the bottom-up construction used by heapsort is linear.
