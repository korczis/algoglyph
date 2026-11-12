---
id: external-radix-sort
title: External radix sort
taxonomy: sorting/external
status: planned
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.4.7 External radix sorting"
  - id: vitter-2008
    ref: distribution as an external paradigm
  - id: aggarwal-1988
    ref: the I/O lower bound it cannot beat
tags:
  - sorting
  - external sorting
  - radix
  - stable
  - non-comparison
complexity: n·k digit operations for k digits in every case; 2kN/B block transfers; extra space n
related:
  - external-merge-sort
  - lsd-radix-sort
  - msd-radix-sort
---

LSD radix sort on files: every pass reads the whole file and appends each record to the bucket file of its current digit, least significant first; the bucket files, concatenated in digit order, are the input of the next pass.

It is correct because each distribution is stable: records with the same current digit keep the order the less significant digits gave them. Punched-card sorters worked exactly this way, a column at a time from the right, the operator stacking the pockets after every pass.

The plate counts no comparisons at all; the bucket buffers appear in the auxiliary strip and the file after each pass is written back to the array. Block transfers are the model in these notes: each pass costs 2N/B, and there are k passes for k digits. Start with Random permutation at n = 256 and watch the order emerge only in the last pass, as in its in-memory counterpart.

Passes depend on key length, not on N, but this does not dodge the sorting bound. Distinct keys need at least log₂ N bits, and one pass with at most M/B buckets handles at most log₂(M/B) of them, so the passes are of the same order as merging. The method wins on short fixed-length keys with many repeats; for long or variable keys, external mergesort is usually better.
