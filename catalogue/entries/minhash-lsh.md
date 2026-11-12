---
id: minhash-lsh
title: MinHash with LSH banding
taxonomy: strings/similarity
status: live
engine: string
sources:
  - id: practice-investigation
tags:
  - near duplicates
  - minhash
  - lsh
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(N s k) hash evaluations for N documents of s shingles and k = b·r functions"
related:
  - simhash
  - source-family
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Keep, for each of b·r seeded mixing functions, the minimum over a document's hashed word shingles (three words by default).
  - See two signatures agree in a position with probability equal to the sets' Jaccard similarity.
  - Cut signatures into b bands of r rows, and see a pair of similarity s become a candidate with probability 1 − (1 − s^r)^b.
algorithm:
  paradigm: randomized
bounds:
  model: hash evaluations and bucket insertions
  best: 'k = b·r per distinct shingle of each document, N s k for N documents of s shingles; N bucket insertions per band'
  worst: 'k = b·r per distinct shingle of each document, N s k for N documents of s shingles; N bucket insertions per band'
claims:
  - id: estimate-error-within-sampling-bound
    statement: >-
      Each of the k = b·r = 32 positions agrees with probability equal to the Jaccard similarity
      J, so a pair's estimate has standard deviation √(J(1 − J)/k) ≤ 1/(2√32) ≈ 0.088, and the
      mean absolute error over the pairs stays below that.
    readout: Mean estimate error
    expect: { below: 0.0884 }
  - id: estimate-error-with-more-functions
    statement: >-
      With 16 bands of 6 rows, k = 96 functions, the same argument bounds the mean absolute
      error by 1/(2√96) ≈ 0.051.
    readout: Mean estimate error
    expect: { below: 0.0511 }
    setup:
      params: { bands: 16, rows: 6 }
  - id: error-bound-holds-for-single-words
    statement: >-
      The bound 1/(2√32) ≈ 0.088 comes from each of the 32 positions agreeing with probability
      J, whatever the sets are made of: with shingles of one word, sets of distinct words, the
      mean absolute error still stays below it.
    readout: Mean estimate error
    expect: { below: 0.0884 }
    setup:
      params: { shingle: 1 }
  - id: error-bound-holds-for-five-word-shingles
    statement: >-
      The same bound with shingles of five words: the shingle length changes J, never the
      sampling argument, so the mean absolute error stays below 1/(2√32) ≈ 0.088.
    readout: Mean estimate error
    expect: { below: 0.0884 }
    setup:
      params: { shingle: 5 }
  - id: hashes-per-distinct-word
    statement: >-
      Each of the k = 32 functions is evaluated once per distinct shingle of each document: the
      seeded eight documents hold 339 distinct words, so single-word shingles take
      32 · 339 = 10848 hash evaluations, exactly.
    readout: Hash evaluations
    expect: { value: 10848 }
    setup:
      params: { shingle: 1 }
---

Signatures whose agreement estimates Jaccard similarity, banded so that only likely pairs are compared.

Each document is its set of word shingles, three words long unless the control changes it, hashed to 32 bits. For each of the b·r seeded mixing functions the signature keeps the minimum over the set, coloured in the table; two signatures agree in a position with probability equal to the sets' Jaccard similarity. The chart plots the share of agreeing positions against the exact Jaccard similarity of every pair.

The signature is cut into b bands of r rows; documents whose band is identical share a bucket and become a candidate pair, which happens with probability 1 − (1 − s^r)^b for similarity s. Raise r to make the threshold sharper and the candidates fewer; raise b to catch more of the less similar pairs.
