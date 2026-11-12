---
id: bpe-tokenisation
title: Byte-pair encoding
taxonomy: strings/compression
status: live
engine: string
sources:
  - id: practice-systems
tags:
  - tokenisation
  - compression
  - merges
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "O(k n) for k merges over n characters as written here"
related:
  - huffman-coding
  - lzw-compression
---

Merge the most frequent adjacent pair, again and again, until a vocabulary of tokens remains.

Every adjacent pair of tokens is counted, the most frequent pair (the first to occur on a tie) becomes a new token, and its occurrences are replaced from left to right. The merge chips list the learned pairs with the number of times each occurred; learning stops when the merge budget is spent or no pair occurs twice.

The chart plots the tokens left after each merge. Early merges join the most frequent letter pairs, often a space with the letter beside it; later merges build on earlier tokens and can assemble whole frequent words, and each one removes fewer tokens than the last.
