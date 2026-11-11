---
id: exchange-sort
title: Exchange sort
taxonomy: sorting/elementary
status: planned
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2.2 Sorting by exchanging"
  - id: astrachan-2003
    ref: the unsettled naming of early exchange sorts
tags:
  - sorting
  - quadratic
  - in-place
  - exchange
complexity: n² in every case; extra space 1
related:
  - bubble-sort
  - insertion-sort
  - selection-sort
---

For each position i, compare the key there with every key to its right and exchange the two whenever the right one is smaller; after the inner loop, position i holds the minimum of the rest.

The name is not settled: early papers used "sorting by exchange" for what is now called bubble sort, and Knuth uses exchange sorting for the whole class of methods that keep exchanging inverted pairs until none remains. Here it names the naive variant that also exchanges distant pairs. An exchange of a distant inverted pair can create new inversions with the keys between them, but it always lowers the total by at least one, which is why the method terminates.

Both loops always run to the end, so every input costs n(n − 1)/2 comparisons; only the number of exchanges depends on the data, from none on Already sorted to as many as the comparisons. Start with Random permutation at n = 32 and compare the writes with selection sort, which makes the same comparisons but a single exchange per position.

It is not stable: exchanging the key at i with a smaller key far away can carry it past an equal key. Restricting the exchanges to neighbours gives bubble sort, which is stable; replacing the running exchanges by one exchange with the minimum gives selection sort.
