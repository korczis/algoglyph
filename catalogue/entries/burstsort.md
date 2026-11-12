---
id: burstsort
title: Burstsort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: sinha-2004
    ref: the original description and experiments
  - id: sedgewick-2011
    ref: "5.1 String sorts"
  - id: mcilroy-1993
    ref: MSD radix sorting of strings
tags:
  - sorting
  - radix
  - trie
  - cache-conscious
complexity: proportional to n plus the distinguishing prefixes in practice (no proved bound), n·w worst for keys of w characters; extra space for the trie and containers
related:
  - american-flag-sort
  - msd-radix-sort
  - multiway-trie
  - quicksort-three-way
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [msd-radix-sort]
  objectives:
  - 'Read the Array writes: exactly n on every input, each key written once on the way out of the trie.'
  - 'Run Few distinct keys at 512 keys: the containers of the lowest byte hold equal keys, so their insertion sorts make m − 1 comparisons each, n − 4 = 508 in all; Random permutation at 512 keys makes none.'
  - 'Explain why up to 32 keys a single container holds the whole input and insertion sort does all the work, and why one key more makes the trie burst.'
  misconceptions:
  - 'Burstsort always ends in comparison sorts of its containers; on Random permutation at 512 keys the trie bursts down to the lowest byte, every container holds one key, and no comparison is made.'
algorithm:
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (the insertion sorts of the containers) and array writes (one per key, the output of the trie); the auxiliary writes count the cells of the drawn container strip that change'
  average: 'exactly n array writes on every input; up to 32 keys the comparisons of an exchange insertion sort of the whole input; past 32, for each block of 256 keys (keys agreeing on all but the lowest byte), m − its distinct keys when it holds m > 32 keys and an insertion sort of its keys otherwise: none on Random permutation at 512 keys, n − 4 = 508 on Few distinct keys'
claims:
  - id: equal-key-containers
    statement: >-
      On Few distinct keys at 512 keys burstsort makes n − 4 = 508 comparisons: the trie bursts down to the lowest byte, where the four containers hold equal keys and each insertion sort of m keys costs m − 1.
    readout: Comparisons
    expect: { value: 508 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

Insert every key, character by character, into a trie whose leaves are small containers of keys; when a container grows past a threshold it bursts into a new trie node one character deeper. Finally walk the trie in character order, sorting each container on the way out.

The kernel reads each key as a string of bytes, most significant first, so the trie branches on the high bytes and the containers collect keys that share a prefix. Unlike MSD radix sort or American flag sort, which create a pile for every character of the alphabet at once, burstsort creates a group only when a container actually overflows; the lower strip shows all containers in trie order.

Sinha and Zobel designed it for the memory hierarchy, not for asymptotics: their experiments on large string sets show it close to twice as fast as earlier string sorts, mainly because of fewer cache misses. The paper proves no formal bound, so the complexity line above is an estimate, not a theorem; the worst case of reading every character of every key is shared with all MSD string sorts.

The kernel bursts containers above 32 keys (the paper's hold thousands) and sorts them by insertion sort (the paper uses multikey quicksort), so the bursts are visible at the plate's sizes. Start with Random permutation at n = 512 to see containers fill and burst; for small sets of short keys the trie is pure overhead and three-way radix quicksort is the simpler choice.
