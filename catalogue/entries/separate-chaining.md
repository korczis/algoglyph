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
---

Each table slot holds a list of the keys that hash there.

A key is hashed by multiplicative (Fibonacci) hashing, h1(k) = 2654435761 · k mod 2^32, where 2654435761 is a prime close to 2^32 / φ, and the leading bits of h1 pick its chain. A search walks the chain comparing keys; those comparisons are what the readouts count and what the chart plots against the load factor α, keys per chain.

For uniform keys a successful search compares about 1 + α/2 keys and an unsuccessful one about α. The chart draws these formulas as a labelled reference beside the measured means, which come from batches of searches for present and absent keys replayed at checkpoints as the table fills and empties.

The load factor may pass 1: a chained table never fills, it only slows down in proportion to α. Choose Adversarial for h1 and every key's hash shares its leading bits, so all keys crowd into a small fraction of the chains, each far longer than α, and every search scans one of those long lists.

Deletion splices the key out of its chain and moves nothing else.
