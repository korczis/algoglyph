---
id: tag-sort
title: Tag sort
taxonomy: sorting/special
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2 Internal sorting: address table sorting"
  - id: cormen-2022
    ref: satellite data and sorting pointers
tags:
  - sorting
  - special-purpose
  - indirect sorting
  - permutation
complexity: n log n comparisons with a comparison sort on the tags; at most n plus the number of cycles record moves; extra space n
related:
  - counting-sort
  - cycle-sort
  - external-merge-sort
  - mergesort-top-down
  - topological-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-top-down]
  objectives:
  - 'Run Reversed at 64 keys: 192 comparisons sort the tags, then 64 array writes move every record exactly once.'
  - 'Run Already sorted: no array write at all, since the sorted tags already point at every record''s own place.'
  - 'Read Auxiliary writes: n for the tag array, plus one for every tag the sort moved, as many as the records the last phase writes.'
  misconceptions:
  - 'Sorting by tags saves comparisons; it makes exactly the comparisons of the merge sort on the tags, at most n⌈lg n⌉ − 2^⌈lg n⌉ + 1. What it saves is record moves: at most one write per record.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (the merge sort of the tags, reading the records'' keys in place), array writes (records moved by the cycle walk; the record held aside per cycle is a read) and auxiliary writes (the tag array, drawn before and after its sort)'
  best: 'no array write on Already sorted'
  average: 'array writes equal the records out of place in the stable order, at most n, and n − (n mod 2) on Reversed; auxiliary writes n more than the array writes'
  worst: 'at most n⌈lg n⌉ − 2^⌈lg n⌉ + 1 comparisons, reached at every n up to 8'
claims:
  - id: every-record-moves-once
    statement: >-
      On Reversed at 64 keys tag sort makes 64 array writes: no record is in its place, and the cycle walk writes each one exactly once.
    readout: Array writes
    expect: { value: 64 }
    setup:
      params: { shape: reversed, n: 64 }
---

Sort a table of tags, small pairs of key and record address, instead of the records themselves; then either read the records through the sorted tags or rearrange them once by following the cycles of the permutation.

The point is size. When records are long and keys short, every exchange of whole records costs far more than swapping a pair of tags; Knuth calls this address table sorting, and Cormen and colleagues note that large records with satellite data are usually sorted by permuting pointers to them. Ties broken by the record's index make any tag sort stable.

The plate builds the tag array in the auxiliary strip, sorts it with a stable merge whose comparisons read the records' keys in place, and finally rearranges the records cycle by cycle. Start with Random permutation at n = 64 and compare the Array writes of the last phase with the Auxiliary writes of the tag sort before it: each record is written at most once, 64 times on Reversed at 64 keys, and the record held aside at the start of each cycle is read, not written.

It pays when records are large or must not move, or when several orders of the same file are needed at once, each just another tag array. It does not pay for small records such as bare numbers, where a tag is as large as the record, and reading through tags later visits memory or disk in scattered order, which can cost more than sorting the records directly.
