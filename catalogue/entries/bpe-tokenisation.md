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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Count every adjacent pair of tokens and merge the most frequent one, the first to occur on a tie.
  - Replace the merged pair's occurrences from left to right, until the budget is spent or no pair occurs twice.
  - See later merges build on earlier tokens and assemble whole frequent words.
bounds:
  model: pairs counted
  worst: 'at most k(n − 1) for a budget of k merges over n characters, every adjacent pair counted before each merge: O(k n)'
---

Merge the most frequent adjacent pair, again and again, until a vocabulary of tokens remains.

Every adjacent pair of tokens is counted, the most frequent pair (the first to occur on a tie) becomes a new token, and its occurrences are replaced from left to right. The merge chips list the learned pairs with the number of times each occurred; learning stops when the merge budget is spent or no pair occurs twice.

The chart plots the tokens left after each merge. Early merges join the most frequent letter pairs, often a space with the letter beside it; later merges build on earlier tokens and can assemble whole frequent words. The count of the pair merged never rises from one merge to the next, because a new pair occurs only where a replacement made it. The tokens a merge removes usually stay level or fall but need not: occurrences that overlap, as aa does twice in aaa, are replaced only once, so a merge can remove fewer tokens than its pair's count and the next merge more than it.
