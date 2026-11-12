---
id: bucket-sort
title: Bucket sort
taxonomy: sorting/distribution
status: live
engine: array
labs:
  - sorting
sources:
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
  - id: isaac-1956
    ref: the original address-calculation idea
  - id: knuth-taocp-3
    ref: "5.2.5 Sorting by distribution"
tags:
  - sorting
  - distribution
  - buckets
  - insertion sort
complexity: n + k best and average, n² worst; extra space n + k
related:
  - counting-sort
---

Divide the key range into n equal intervals, drop every key into the bucket of its interval, sort each bucket by insertion, and concatenate the buckets in order.

The order between buckets is decided by arithmetic on the key, not by comparisons; comparisons happen only inside a bucket. The lower strip shows the buckets side by side in bucket order, so the picture is already almost sorted before the first insertion runs.

The expected linear time rests on an assumption about the data: when keys are spread uniformly, each bucket holds a constant number of keys on average and the insertion sorts add up to linear work. If every key falls into one bucket, the method degenerates into insertion sort and goes quadratic. Start with Random permutation at n = 128: a permutation of 1..n is the uniform case, one key per bucket, and the comparison counter barely moves.

Few distinct keys crowds the keys into a handful of buckets, but the keys inside each bucket are equal and insertion sort leaves them where they are, so the plate's inputs never reach the quadratic case; that needs keys that cluster without being equal. Knuth files the method under sorting by distribution, and Isaac and Singleton's address calculation of 1956 is where the idea starts; counting sort is the limit with one bucket per key value.
