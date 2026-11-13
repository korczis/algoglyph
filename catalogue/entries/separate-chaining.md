---
id: separate-chaining
title: Hashing with separate chaining
taxonomy: searching/hashing
status: live
engine: hash
labs:
  - hashing
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - hashing
  - chaining
  - symbol table
complexity: O(1 + α) expected comparisons per operation, O(n) in the worst case
related:
  - linear-probing
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Pick a key's chain by the leading bits of its multiplicative hash, then walk the chain comparing keys.
  - 'Relate the cost to the load factor α: about 1 + α/2 keys compared for a hit and α for a miss.'
  - See why a chained table never fills and only slows down in proportion to α.
algorithm:
  paradigm: search
bounds:
  model: key comparisons
  average: about 1 + α/2 per hit and α per miss (uniform keys)
  worst: 'a miss compares every key of its chain; a hit, the keys up to its own'
claims:
  - id: six-shared-bits-two-chains
    statement: >-
      With adversarial keys sharing 6 leading hash bits and no deletions, the 96 keys at load 0.75
      get 128 chains, and a chain is picked by the hash's leading 7 bits: the 6 the keys share
      leave them 2^(7 − 6) = 2 chains, so by pigeonhole the longest holds at least 96 / 2 = 48.
    readout: Longest chain
    expect: { above: 47 }
    setup:
      params: { stream: adversarial, deletes: 0, band: 6 }
  - id: three-shared-bits-sixteen-chains
    statement: >-
      With 3 shared bits the keys reach 2^(7 − 3) = 16 of the 128 chains, so the longest holds at
      least ⌈96 / 16⌉ = 6 keys, a pigeonhole bound eight times below the 6-bit one.
    readout: Longest chain
    expect: { above: 5 }
    setup:
      params: { stream: adversarial, deletes: 0, band: 3 }
---

Each table slot holds a list of the keys that hash there.

A key is hashed by multiplicative (Fibonacci) hashing, h1(k) = 2654435761 · k mod 2^32, where 2654435761 is a prime close to 2^32 / φ, and the leading bits of h1 pick its chain. A search walks the chain comparing keys; those comparisons are what the readouts count and what the chart plots against the load factor α, keys per chain.

For uniform keys a successful search compares about 1 + α/2 keys and an unsuccessful one about α. The chart draws these formulas as a labelled reference beside the measured means, which come from batches of searches for present and absent keys replayed at checkpoints as the table fills and empties.

The load factor may pass 1: a chained table never fills, it only slows down in proportion to α. Choose Adversarial for h1 and every key's hash shares its leading bits, so all keys crowd into a small fraction of the chains, each far longer than α, and every search scans one of those long lists.

Deletion splices the key out of its chain and moves nothing else.
