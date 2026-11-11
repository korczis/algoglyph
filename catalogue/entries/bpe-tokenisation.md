---
id: bpe-tokenisation
title: Byte-pair encoding
taxonomy: strings/compression
status: planned
engine: string
sources:
  - id: practice-systems
tags:
  - tokenisation
  - compression
  - merges
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Merge the most frequent adjacent pair, again and again, until a vocabulary of tokens remains.
