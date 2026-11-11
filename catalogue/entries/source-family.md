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
  - minhash-lsh
  - simhash
  - union-find-entity-merge
---

Five republications of one wire story are one source, not five; credits reveal the family.

Every pair of documents is compared by the Jaccard similarity of their word 3-shingles. Republications of one story keep most shingles through light edits, a trimmed ending or an added line, while different stories share almost none, so a pair is linked at 0.3 or more; a pair carrying the same agency credit and the same headline is linked as well. Linked documents are merged by union-find into one source, coloured alike, and the earliest publication of each is marked as its origin.

The readouts compare the sources found with the stories the input was generated from, and count pairwise precision and recall against that truth.
