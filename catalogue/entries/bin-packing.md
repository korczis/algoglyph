---
id: bin-packing
title: Bin packing
taxonomy: systems/scheduling
status: live
engine: custom
sources:
  - id: practice-logistics
  - id: johnson-1974-packing-bounds
    ref: 'first fit decreasing within 11/9 · OPT + 4; lists on which first fit needs 17/10 · OPT'
  - id: dosa-sgall-2013-first-fit
    ref: '§3, first fit within ⌊1.7 · OPT⌋; §4, lists that reach it'
  - id: dosa-2007-ffd
    ref: 'first fit decreasing within 11/9 · OPT + 6/9, a tight additive constant'
tags:
  - bin packing
  - next fit
  - first fit decreasing
motivation: Warehouse logistics spend most of their time on exactly this.
complexity: next fit O(n); first fit O(n · bins) as scanned here, O(n log n) with a tournament tree; first fit decreasing adds an O(n log n) sort
relations:
  - { type: related_to, target: tournament-sort, reason: "A tournament tree over the free space finds the first bin that fits in O(log n)." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Pack the same items by next fit, which keeps only its newest bin open, first fit, which uses the earliest bin the item fits, and first fit decreasing, which sorts the items largest first and then runs first fit.
    - Explain why halves and crumbs cost next fit nearly twice the bins of first fit decreasing, since every half-full bin takes one crumb and then refuses the next half.
    - Judge a packing against the lower bound ⌈Σ size / capacity⌉ and against the proven bounds of first fit and first fit decreasing.
claims:
  - id: next-fit-tests-fewer-than-items
    statement: >-
      Next fit makes one fit test per item after the first, n − 1 for n items: the items minus its
      fit tests (the third number of its readout) is exactly one.
    readout: Items
    expect: { against: Next fit, against_number: 3, offset: 1, tolerance: 0 }
  - id: halves-cost-next-fit-a-bin-each
    statement: >-
      For 48 alternating halves and crumbs, every half-full bin takes one crumb and then refuses
      the next half (50 + a crumb + 50 exceeds 100), so next fit opens one bin per half: exactly
      n / 2 = 24.
    readout: Next fit
    expect: { value: 24 }
    setup:
      params: { shape: halves }
  - id: first-fit-decreasing-pairs-the-halves
    statement: >-
      For the same 48 items, first fit decreasing pairs the 24 halves into 12 full bins and puts
      the 24 crumbs, at most 3 each (the default largest crumb) and so at most 72 together, into
      one more: exactly
      n / 4 + 1 = 13, nearly half of next fit's.
    readout: First fit decreasing
    expect: { value: 13 }
    setup:
      params: { shape: halves }
  - id: no-packing-below-the-lower-bound
    statement: >-
      No packing uses fewer bins than ⌈Σ size / capacity⌉: first fit decreasing's bins minus the
      lower bound is at least 0 (whole bins, so above −1).
    readout: First fit decreasing
    expect: { against: 'Lower bound ⌈Σ size / capacity⌉', above: -1 }
  - id: optimum-not-below-the-lower-bound
    statement: >-
      On 12 items, small enough for the exact search, the optimum itself uses no fewer bins than
      ⌈Σ size / capacity⌉ (whole bins, so the difference is above −1).
    readout: Optimum (exact search)
    expect: { against: 'Lower bound ⌈Σ size / capacity⌉', above: -1 }
    setup:
      params: { n: 12 }
  - id: first-fit-not-below-the-optimum
    statement: >-
      On 12 items, first fit never uses fewer bins than the optimum the exact search finds (whole
      bins, so the difference is above −1).
    readout: First fit
    expect: { against: Optimum (exact search), above: -1 }
    setup:
      params: { n: 12 }
  - id: halves-cost-next-fit-a-bin-each-at-the-largest-crumb
    statement: >-
      With crumbs up to 49, a half and a crumb still fit one bin (50 + 49 = 99) and the next half
      still never does (50 + 1 + 50 = 101), so next fit opens one bin per half at every crumb
      setting: exactly n / 2 = 24 for 48 items.
    readout: Next fit
    expect: { value: 24 }
    setup:
      params: { shape: halves, crumb: 49 }
  - id: halves-cost-next-fit-a-bin-each-at-the-smallest-crumb
    statement: >-
      With every crumb 1 the same holds: each half takes one crumb (51) and refuses the next half
      (101), so next fit opens exactly n / 2 = 24 bins for 48 items.
    readout: Next fit
    expect: { value: 24 }
    setup:
      params: { shape: halves, crumb: 1 }
  - id: first-fit-decreasing-one-crumb-bin-while-the-crumbs-fit
    statement: >-
      First fit decreasing pairs the 24 halves into 12 full bins no crumb can enter, then packs
      the crumbs alone; at a largest crumb of 4 the 24 crumbs weigh at most 96, which fits one
      bin, so it uses exactly n / 4 + 1 = 13. The largest crumb for which this holds at 48 items
      is ⌊100 / 24⌋ = 4.
    readout: First fit decreasing
    expect: { value: 13 }
    setup:
      params: { shape: halves, crumb: 4 }
  - id: first-fit-decreasing-at-the-largest-crumb
    statement: >-
      At a largest crumb of 49 the crumbs may need several bins, but never fewer than
      ⌈Σ crumbs / 100⌉ beside the 12 bins of halves; since the halves weigh exactly 12 bins, that
      count is the lower bound ⌈Σ size / capacity⌉ itself: first fit decreasing minus the lower
      bound is at least 0 (whole bins, so above −1).
    readout: First fit decreasing
    expect: { against: 'Lower bound ⌈Σ size / capacity⌉', above: -1 }
    setup:
      params: { shape: halves, crumb: 49 }
---

Next fit, first fit and first fit decreasing filling the same bins, and how many each needs.

Every item has an integer size and every bin the same capacity. The three heuristics pack the same items side by side: next fit keeps only its newest bin open, first fit puts each item into the earliest bin it fits, and first fit decreasing sorts the items largest first and then runs first fit. The readouts count bins, how full they are, and the fit tests each heuristic makes: every placement records the fit tests it took, and the readout adds them up as the placements replay.

Next fit makes one fit test per item after the first, n − 1 for n items (the first has no bin to test), and because any two neighbouring bins together hold more than one bin's capacity it never needs as many as 2 Σ size / capacity + 1 bins. Halves and crumbs is its bad case: every half-full bin takes one crumb and then refuses the next half, so it uses nearly twice the bins of first fit decreasing, which pairs the halves.

Johnson, Demers, Ullman, Garey and Graham (1974) bounded first fit decreasing by 11/9 · OPT + 4 and gave lists on which first fit needs 17/10 · OPT bins. Dósa and Sgall (2013, §3) proved first fit never needs more than ⌊1.7 · OPT⌋ bins, and gave lists that need exactly that many for most values of OPT (§4); Dósa (2007) proved first fit decreasing never needs more than 11/9 · OPT + 6/9, a constant no smaller one can replace. This plate scans the bins in order, so its fit tests show the naive cost, which grows with the number of bins; a tournament tree over the free space finds the first bin that fits in logarithmic time.

No packing uses fewer bins than ⌈Σ size / capacity⌉, the lower bound beside the measured counts in the chart. Finding the optimum is NP-hard, so the plate searches for it exactly, by branch and bound, only on small inputs.
