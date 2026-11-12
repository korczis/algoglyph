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
  - levenshtein-matrix
  - minhash-lsh
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Lower-case each word, pad it with two spaces in front and one behind, and cut it into three-character slices.
  - Divide the shared trigrams by the distinct trigrams in either string.
  - See why a typing slip or a different word order costs little, while dropping diacritics changes many trigrams.
bounds:
  model: trigrams sliced and set lookups
  best: '|w| + 1 trigrams for each word w of either string; one set lookup per distinct trigram of the first'
  worst: '|w| + 1 trigrams for each word w of either string; one set lookup per distinct trigram of the first'
---

Two strings compared by the overlap of their three-character slices.

Each word is lower-cased, padded with two spaces in front and one behind, and cut into overlapping three-character slices, the way PostgreSQL's pg_trgm does it (spaces are shown as dots). Shared trigrams are linked; the similarity is the number of shared trigrams over the number of distinct trigrams in either string.

A typing slip changes only the two or three trigrams that cover it, and a different word order changes none, so the measure tolerates both; dropping diacritics does change the trigrams of every letter it touches.
