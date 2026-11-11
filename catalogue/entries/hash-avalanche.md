---
id: hash-avalanche
title: Avalanche Matrix
taxonomy: systems/integrity
status: live
engine: custom
tags:
  - cryptography
  - SHA-256
  - statistics
complexity: 1 hash pair per trial
---

Flip one input bit, count which output bits flip. A good hash turns the matrix into flat grey noise at exactly one half; a weak one leaves its wiring exposed.

Rows are the 256 bits of a random 32-byte message, columns the output bits of the hash. Each trial picks a message and an input bit, flips it, hashes both versions and adds the difference to that row. A cell's colour is how often that output bit flipped.

The strict avalanche criterion asks for every cell to be 1/2. The colour scale is stretched around one half (the gain), so the remaining noise for SHA-256 is sampling error, shrinking like 1/√trials, and it is reported as the largest deviation measured.

Switch to FNV-1a: a fast multiplicative hash for tables, not for security. A flip in its last byte passes through one multiplication, which only carries upwards: the output bit at the flipped position always flips, the bits below it never do, and the bottom rows turn into a hard staircase within seconds.
