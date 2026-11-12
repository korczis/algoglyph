---
id: extendible-hashing
title: Extendible hashing
taxonomy: searching/external
status: live
engine: hash
labs:
  - hashing
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - hashing
  - external search
  - directory
complexity: one directory read and one page read per search; the directory grows faster than linearly
related:
  - separate-chaining
---

A directory indexed by the leading hash bits that doubles when a page splits.

The directory has 2^g entries indexed by the leading g bits of a key's hash, and each entry points at a page holding at most b keys. A page of local depth d < g is shared by the 2^(g − d) consecutive entries that begin with its d-bit prefix; the bar along the top of each page shows d against g.

A search reads one directory entry and one page, a single access to secondary storage, then compares keys within the page in memory. The readouts count both.

Inserting into a full page splits it on its next bit: the keys with that bit set move to a new page and the upper half of the page's directory entries point at it. When d already equals g the directory doubles first. A page whose keys share more bits splits again.

For uniform keys the pages fill to about ln 2 of their space, roughly n/(b ln 2) pages, while the directory grows like (e/(b ln 2)) n^(1 + 1/b); the chart draws both, Sedgewick's estimates for uniform keys, as references beside the measured counts. Adversarial for h1 gives every key the same leading bits, so the directory must double many times before any split separates them.

Deletion removes the key from its page; in this version pages are never merged and the directory never shrinks. A run whose directory would outgrow the plate's depth limit stops there and is marked truncated, which keeps the plate light enough for a phone; the readouts say so.
