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
  - Keep, for each of b·r seeded mixing functions, the minimum over a document's hashed 3-shingles.
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
---

Signatures whose agreement estimates Jaccard similarity, banded so that only likely pairs are compared.

Each document is its set of word 3-shingles hashed to 32 bits. For each of the b·r seeded mixing functions the signature keeps the minimum over the set, coloured in the table; two signatures agree in a position with probability equal to the sets' Jaccard similarity. The chart plots the share of agreeing positions against the exact Jaccard similarity of every pair.

The signature is cut into b bands of r rows; documents whose band is identical share a bucket and become a candidate pair, which happens with probability 1 − (1 − s^r)^b for similarity s. Raise r to make the threshold sharper and the candidates fewer; raise b to catch more of the less similar pairs.
