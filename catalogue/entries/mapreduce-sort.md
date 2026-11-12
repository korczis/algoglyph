---
id: mapreduce-sort
title: Sorting with MapReduce
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: dean-2004
    ref: the model, its ordering guarantee and the sort benchmark
  - id: omalley-2008
    ref: TeraSort, the range-partitioned realisation
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
tags:
  - sorting
  - parallel
  - mapreduce
complexity: n log n in every case; extra space n
related:
  - k-way-merge-sort
  - parallel-samplesort
---

In MapReduce sorting is almost free: map emits each record under its key, reduce copies its input unchanged, and the framework does the work, because within one partition it hands the intermediate pairs to reduce in increasing key order.

The catch is the partition function. By default it is a hash of the key modulo R, which makes every output file sorted but leaves the whole unsorted. A globally sorted result needs partitions by key range, and for a general sort the model's authors recommend a preliminary pass that samples the keys and computes the split points from their distribution. A reducer sorts all of its intermediate data by key, falling back to an external sort when it does not fit in memory.

The plate runs the map and reduce steps one after another and counts total work: order n log n comparisons in the reducers plus linear work for the maps, the spill and the shuffle, in which every record crosses the network once. Start with Random permutation at n = 256 and compare it with TeraSort, the same pipeline with a sampled range partitioner.

The 2004 paper sorted 10^10 records of 100 bytes, about a terabyte, with fewer than 50 lines of user code on roughly 1800 machines in 891 seconds, its partitioner knowing the key distribution in advance. It is not stable: the ordering guarantee covers keys, not the order of values with equal keys. It fits data that already live in a distributed file system and do not fit on one machine; for data that do, a parallel sort on that one machine avoids the framework's overhead.
