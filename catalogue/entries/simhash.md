---
id: simhash
title: SimHash
taxonomy: strings/similarity
status: live
engine: string
sources:
  - id: practice-investigation
tags:
  - near duplicates
  - fingerprints
  - hamming
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(f · 64) bit votes per document of f distinct words, O(64) to compare two fingerprints"
related:
  - minhash-lsh
  - source-family
---

A fingerprint whose Hamming distance follows the documents' cosine similarity.

Every distinct word of a document hashes to 64 bits and votes on all of them, adding its count where its bit is 1 and subtracting it where the bit is 0; the table shows the running totals. The fingerprint keeps the sign of each total, so documents built from mostly the same weighted words end up with mostly the same bits.

The chart plots the Hamming distance of every pair of fingerprints against the cosine similarity of their word counts: the distance falls as the similarity rises. The synthetic stories share common English words, so even different stories have a high cosine and lie closer than independent fingerprints would.
