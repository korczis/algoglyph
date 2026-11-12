---
id: external-radix-sort
title: External radix sort
taxonomy: sorting/external
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [lsd-radix-sort]
  objectives:
  - 'Read the Passes readout at 512 keys: 3, one per base-16 digit of max − min = 511, each writing every key to a bucket file and back, 1,536 array writes.'
  - 'Run Few distinct keys at 512 keys: one pass, since the keys 1 to 4 differ only in their last digit.'
  - 'Read the Comparisons readout: 0 on every input.'
  misconceptions:
  - 'An external sort needs more passes for more keys; this one needs one pass per digit of the key range, 3 on Random permutation at 512 keys and 1 on Few distinct keys at the same size.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: true
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes (the bucket files concatenated back into the file every pass), auxiliary writes (keys appended to the bucket files) and passes (one per digit); no comparison'
  average: 'on every input of n ≥ 2 keys d passes for the d base-16 digits of max − min (at least 1), exactly d·n array writes and d·n auxiliary writes, and no comparison; the 2N/B block transfers per pass are the I/O model''s'
claims:
  - id: passes-follow-the-key-range
    statement: >-
      On Few distinct keys at 512 keys external radix sort takes 1 pass, against 3 on Random permutation at the same size: its passes follow the base-16 digits of the key range, 1 to 4 here, not the number of keys.
    readout: Passes
    expect: { value: 1 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

LSD radix sort on files: every pass reads the whole file and appends each record to the bucket file of its current digit, least significant first; the bucket files, concatenated in digit order, are the input of the next pass.

It is correct because each distribution is stable: records with the same current digit keep the order the less significant digits gave them. Punched-card sorters worked exactly this way, a column at a time from the right, the operator stacking the pockets after every pass.

The plate counts no comparisons at all; the bucket buffers appear in the auxiliary strip and the file after each pass is written back to the array. Block transfers are the model in these notes: each pass costs 2N/B, and there are k passes for k digits. Start with Random permutation at n = 256 and watch the order emerge only in the last pass, as in its in-memory counterpart.

Passes depend on key length, not on N, but this does not dodge the sorting bound. Distinct keys need at least log₂ N bits, and one pass with at most M/B buckets handles at most log₂(M/B) of them, so the passes are of the same order as merging. The method wins on short fixed-length keys with many repeats; for long or variable keys, external mergesort is usually better.
