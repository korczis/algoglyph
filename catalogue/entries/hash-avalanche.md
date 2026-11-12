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
sources:
  - id: zhang-zheng-1995-gac
    ref: '§1: the strict avalanche criterion'
  - id: rfc-9923-fnv
    ref: FNV-1a
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - State the strict avalanche criterion, every output bit flipping with probability one half when one input bit flips, and read it off the matrix as flat grey noise.
    - Explain why the noise left for SHA-256 is sampling error that shrinks like 1/√trials, and read the largest deviation as its measure.
    - Explain FNV-1a's staircase, a flip in the last byte passing through one multiplication that only carries upwards, so the output bit at the flipped position always flips and the bits below it never do.
claims:
  - id: sha256-flips-half-the-output-bits
    statement: >-
      SHA-256 meets the strict avalanche criterion on average: over its 262,144 trials the mean
      number of output bits flipped is the ideal 256 / 2 = 128, within three standard errors. One
      trial flips 256 bits each with probability 1/2, a standard deviation of √(256 · ¼) = 8 bits,
      so the mean's standard error is 8 / √262,144 = 1/64 and three of them about 0.047; the
      readout prints two decimals, so the margin adds half its last place, 0.005: 0.052.
    readout: mean output bits flipped
    expect: { against: ideal, tolerance: 0.052 }
    setup:
      params: { fn: sha256, budget: 262144 }
---

Flip one input bit, count which output bits flip. A good hash turns the matrix into flat grey noise at exactly one half; a weak one leaves its wiring exposed.

Rows are the 256 bits of a random 32-byte message, columns the output bits of the hash. Each trial picks a message and an input bit, flips it, hashes both versions and adds the difference to that row. A cell's colour is how often that output bit flipped.

The strict avalanche criterion asks for every cell to be 1/2. The colour scale is stretched around one half (the gain), so the remaining noise for SHA-256 is sampling error, shrinking like 1/√trials, and it is reported as the largest deviation measured. A run stops after a budget of trials, so its readouts settle at a fixed sample size.

Switch to FNV-1a: a fast multiplicative hash for tables, not for security. A flip in its last byte passes through one multiplication, which only carries upwards: the output bit at the flipped position always flips, the bits below it never do, and the bottom rows turn into a hard staircase within seconds.
