---
id: union-find-entity-merge
title: Merging duplicates with union-find
taxonomy: strings/similarity
status: live
engine: graph
sources:
  - id: practice-entity-resolution
tags:
  - entity resolution
  - union-find
  - clusters
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(m log m) to sort the m candidate pairs, then near-constant time per union"
related:
  - connected-components
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - weighted-quick-union
  objectives:
  - Take candidate pairs from the most similar down, a match at or above the threshold becoming a union.
  - Read the components as the resolved entities.
  - See a lower threshold raise recall and tend to lower precision, as noisy names chain entities together.
algorithm:
  paradigm: union-find
bounds:
  model: candidate pairs examined and merging matches
  worst: 'each of the m candidate pairs examined once; at most n − 1 merging matches for n records, each joining two clusters into one'
---

Pairwise matches become unions, and the components are the resolved entities.

Each vertex is a record, labelled with its name on small inputs; the outer ring is the entity it truly belongs to, the fill the cluster it has been merged into. Candidate pairs (names sharing enough trigrams) are taken from the most similar down: a match that joins two clusters is drawn thick, one inside a cluster thin, and one below the threshold fades.

Lower the threshold and recall rises while precision tends to fall, as noisy names chain records of different entities together through intermediate matches; raise it and duplicates stay apart.
