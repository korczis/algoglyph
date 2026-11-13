---
id: source-family
title: Collapsing one story's copies
taxonomy: strings/similarity
status: live
engine: string
sources:
  - id: practice-investigation
tags:
  - provenance
  - deduplication
  - sources
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(N² s) for N documents of s shingles each"
related:
  - union-find-entity-merge
relations:
  - { type: uses, target: quick-union, reason: "Linked documents are merged by quick-union (the smaller index as root, with path halving)." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - weighted-quick-union
  objectives:
  - Compare every pair of documents by the Jaccard similarity of their word shingles, three words long by default.
  - Link a pair at the threshold (0.3 by default) or more, or when both carry the same agency credit and headline, and merge linked documents by union-find (quick-union with the smaller index as the root and path halving, not the weighted form).
  - Count the sources found against the stories the input was generated from, by pairwise precision and recall.
algorithm:
  paradigm: union-find
bounds:
  model: pairs compared and unions
  best: 'n(n − 1)/2 pairs compared for n documents'
  worst: 'n(n − 1)/2 pairs compared and at most n − 1 unions for n documents'
claims:
  - id: one-source-at-threshold-zero
    statement: >-
      Every Jaccard similarity is at least 0, so at threshold 0 every pair links and the
      documents form one source, exactly.
    readout: Sources found
    expect: { value: 1 }
    setup:
      params: { threshold: 0 }
  - id: n-minus-one-unions-at-threshold-zero
    statement: >-
      Union-find starts from n singletons and each union merges two of them; when every pair
      links they end as one, so exactly n − 1 unions: Unions minus Documents is −1.
    readout: Unions
    expect: { against: Documents, offset: -1, tolerance: 0 }
    setup:
      params: { threshold: 0 }
  - id: at-most-n-minus-one-unions
    statement: >-
      Each union lowers the number of sources by one, from n to at least 1, so there are at most
      n − 1 unions at any threshold: Unions minus Documents plus 1 is at most 0 (here at 0.6).
    readout: Unions
    expect: { against: Documents, offset: -1, below: 0.5 }
    setup:
      params: { threshold: 0.6 }
  - id: single-words-merge-different-stories
    statement: >-
      Shingles of one word are the documents' word sets, and different synthetic stories share
      enough common English words that their Jaccard similarity passes 0.3: the link graph of the
      seeded documents, built independently in test/controls-source-family.test.ts, is connected,
      so one source is found.
    readout: Sources found
    expect: { value: 1 }
    setup:
      params: { shingle: 1 }
  - id: at-most-n-minus-one-unions-with-five-word-shingles
    statement: >-
      The union bound does not depend on what is compared: with shingles of five words there are
      still at most n − 1 unions, Unions minus Documents plus 1 at most 0.
    readout: Unions
    expect: { against: Documents, offset: -1, below: 0.5 }
    setup:
      params: { shingle: 5 }
---

Several republications of one wire story are one source, not several; credits reveal the family.

Every pair of documents is compared by the Jaccard similarity of their word shingles, three words long unless the control changes it. Republications of one story keep most shingles through light edits, a trimmed ending or an added line, while different stories share almost none, so a pair is linked at 0.3 or more (the threshold control moves it: at 0 every pair links, at 1 only identical shingle sets); a pair carrying the same agency credit and the same headline is linked as well. Linked documents are merged by union-find into one source, coloured alike, and the earliest publication of each is marked as its origin.

The readouts compare the sources found with the stories the input was generated from, and count pairwise precision and recall against that truth.
