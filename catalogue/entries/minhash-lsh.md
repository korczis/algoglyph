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
---

Signatures whose agreement estimates Jaccard similarity, banded so that only likely pairs are compared.

Each document is its set of word 3-shingles hashed to 32 bits. For each of the b·r seeded mixing functions the signature keeps the minimum over the set, coloured in the table; two signatures agree in a position with probability equal to the sets' Jaccard similarity. The chart plots the share of agreeing positions against the exact Jaccard similarity of every pair.

The signature is cut into b bands of r rows; documents whose band is identical share a bucket and become a candidate pair, which happens with probability 1 − (1 − s^r)^b for similarity s. Raise r to make the threshold sharper and the candidates fewer; raise b to catch more of the less similar pairs.
