---
id: trigram-similarity
title: Trigram similarity
taxonomy: strings/similarity
status: live
engine: string
labs:
  - name-similarity
sources:
  - id: practice-entity-resolution
tags:
  - similarity
  - n-grams
  - jaccard
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(|a| + |b|) trigrams and set lookups"
related:
  - jaro-winkler
  - levenshtein-matrix
  - minhash-lsh
---

Two strings compared by the overlap of their three-character slices.

Each word is lower-cased, padded with two spaces in front and one behind, and cut into overlapping three-character slices, the way PostgreSQL's pg_trgm does it (spaces are shown as dots). Shared trigrams are linked; the similarity is the number of shared trigrams over the number of distinct trigrams in either string.

A typing slip changes only the two or three trigrams that cover it, and a different word order changes none, so the measure tolerates both; dropping diacritics does change the trigrams of every letter it touches.
