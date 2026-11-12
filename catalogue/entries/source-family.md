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
  - Compare every pair of documents by the Jaccard similarity of their word 3-shingles.
  - Link a pair at 0.3 or more, or when both carry the same agency credit and headline, and merge linked documents by union-find (quick-union with the smaller index as the root and path halving, not the weighted form).
  - Count the sources found against the stories the input was generated from, by pairwise precision and recall.
algorithm:
  paradigm: union-find
bounds:
  model: pairs compared and unions
  best: 'n(n − 1)/2 pairs compared for n documents'
  worst: 'n(n − 1)/2 pairs compared and at most n − 1 unions for n documents'
---

Several republications of one wire story are one source, not several; credits reveal the family.

Every pair of documents is compared by the Jaccard similarity of their word 3-shingles. Republications of one story keep most shingles through light edits, a trimmed ending or an added line, while different stories share almost none, so a pair is linked at 0.3 or more; a pair carrying the same agency credit and the same headline is linked as well. Linked documents are merged by union-find into one source, coloured alike, and the earliest publication of each is marked as its origin.

The readouts compare the sources found with the stories the input was generated from, and count pairwise precision and recall against that truth.
