---
id: terasort
title: TeraSort
taxonomy: sorting/parallel
status: planned
engine: array
labs:
  - sorting
sources:
  - id: omalley-2008
    ref: the original report and record run
  - id: apache-2024
    ref: TeraGen, TeraSort and TeraValidate
  - id: dean-2004
    ref: sorted order within a MapReduce partition
tags:
  - sorting
  - parallel
  - mapreduce
  - samplesort
complexity: n log n in every case; extra space n
motivation: Hadoop still ships it among its example programs, where it serves as a cluster benchmark.
related:
  - mapreduce-sort
  - parallel-samplesort
  - samplesort
---

Sorting on Hadoop MapReduce with a range partitioner: a sorted sample of N − 1 keys bounds the key range of each of N reducers, so every key of reducer i is smaller than every key of reducer i + 1, and the reducers' files in order are the sorted output.

It is a distributed samplesort. The sample gives the splitters, every record moves once to the reducer of its range, and each reducer sorts its range; the sorting inside a reducer comes from the framework itself, which processes the intermediate pairs of one partition in increasing key order. To make partitioning fast, the original builds a two-level trie on the first two bytes of the key that points straight into the sample list.

The plate runs the mappers' and reducers' steps one after another and counts total work: order n log n comparisons for the local sorts plus linear work to partition and shuffle. Start with Random permutation at n = 256 and watch the keys land in reducer ranges before each range is sorted; Few distinct keys shows how equal keys crowd one reducer, the imbalance that sampling has to fight.

The sample decides the balance: the record run used 100,000 sample keys and its author still found the split among reducers far from perfect. That run, reported in May 2008, sorted 10 billion rows in 209 seconds on a cluster of 910 nodes. It is not stable and needs memory and disk proportional to the data; the suite's TeraValidate checks the result by testing each output file's order and that each file's first key follows the previous file's last.
