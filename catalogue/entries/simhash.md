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
  - source-family
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Let every distinct word vote on 64 bits with its count, and keep the sign of each total as the fingerprint.
  - See the Hamming distance of two fingerprints fall as the cosine similarity of their word counts rises.
  - See why stories that share common English words lie closer than independent fingerprints would.
bounds:
  model: bit votes and fingerprint bits compared
  best: '64 f bit votes for a document of f distinct words; 64 bits compared per pair of fingerprints'
  worst: '64 f bit votes for a document of f distinct words; 64 bits compared per pair of fingerprints'
claims:
  - id: different-stories-closer-than-independent
    statement: >-
      Independent 64-bit fingerprints differ in 32 bits on average; the synthetic stories share
      common English words, so different stories lie closer than that.
    readout: Mean distance, different stories
    expect: { below: 32 }
  - id: different-stories-closer-than-independent-at-32-bits
    statement: >-
      The same argument at 32 bits: two independent fingerprints differ in each bit with
      probability 1/2, so in 32/2 = 16 bits on average, and the different stories lie closer.
    readout: Mean distance, different stories
    expect: { below: 16 }
    setup:
      params: { bits: '32' }
  - id: different-stories-closer-than-independent-at-16-bits
    statement: >-
      At 16 bits independent fingerprints differ in 16/2 = 8 bits on average; the different
      stories lie closer than that.
    readout: Mean distance, different stories
    expect: { below: 8 }
    setup:
      params: { bits: '16' }
  - id: distance-at-most-the-width
    statement: >-
      A Hamming distance between two 16-bit fingerprints counts differing positions, so it lies
      in [0, 16], and so does any mean of such distances.
    readout: Mean distance, copies of one story
    expect: { range: [0, 16] }
    setup:
      params: { bits: '16' }
  - id: votes-per-distinct-word
    statement: >-
      Each distinct word votes once on every bit: the seeded eight documents hold 339 distinct
      words, so a 16-bit fingerprint takes 16 · 339 = 5424 bit votes, exactly.
    readout: Bit votes
    expect: { value: 5424 }
    setup:
      params: { bits: '16' }
---

A fingerprint whose Hamming distance follows the documents' cosine similarity.

Every distinct word of a document hashes to 64 bits, or to the first 16 or 32 of them when the control narrows the fingerprint, and votes on all of them, adding its count where its bit is 1 and subtracting it where the bit is 0; the table shows the running totals. The fingerprint keeps the sign of each total, so documents built from mostly the same weighted words end up with mostly the same bits.

The chart plots the Hamming distance of every pair of fingerprints against the cosine similarity of their word counts: the distance falls as the similarity rises. The synthetic stories share common English words, so even different stories have a high cosine and lie closer than independent fingerprints would.
