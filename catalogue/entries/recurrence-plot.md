---
id: recurrence-plot
title: Recurrence plot and quantification
taxonomy: dynamics/time-series
status: live
engine: numeric
sources:
  - id: practice-decisions
  - id: eckmann-1987-recurrence
    purpose: history
tags:
  - recurrence
  - rqa
  - regime change
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(N²) for N states'
related:
  - takens-embedding
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - takens-embedding
  objectives:
    - Read a recurrence plot's texture, where periodic motion draws long diagonal lines, chaos short broken ones and noise isolated points.
    - See ε set so that the chosen share of pairs recur, and the texture change where the logistic series switches from period 4 to chaos.
    - Measure determinism, the share of recurrent points on diagonal lines of at least the shortest length counted, and laminarity, the share on vertical lines.
bounds:
  model: squared state distances computed (every pair for the threshold, then every pair and the main diagonal for the matrix)
  best: N²
  worst: N²
  space: N² matrix cells and N(N − 1)/2 pair distances
claims:
  - id: rate-is-the-target-on-noise
    statement: >-
      The threshold is the k-th smallest of the M = 300 · 299 / 2 = 44,850 pair distances, k =
      floor(0.08 M) = 3,588, so with no two distances tied exactly k pairs recur and the rate is
      3,588 / 44,850 = 8% exactly; Gaussian noise has no tied distances.
    readout: Recurrence rate
    expect: { value: 8 }
    setup:
      params: { series: noise }
  - id: rate-is-the-target-on-lorenz
    statement: >-
      On x(t) of the Lorenz flow no two distances tie either, so exactly floor(0.08 · 44,850) =
      3,588 of the 44,850 pairs recur: 8% exactly.
    readout: Recurrence rate
    expect: { value: 8 }
    setup:
      params: { series: lorenz }
  - id: rate-is-the-target-at-two-percent
    statement: >-
      At a 2% target k = floor(0.02 · 44,850) = 897 pairs, so on tie-free noise the rate is 897 /
      44,850 = 2% exactly.
    readout: Recurrence rate
    expect: { value: 2 }
    setup:
      params: { series: noise, rate: 2 }
  - id: ties-recur-with-the-threshold
    statement: >-
      Every pair whose squared distance equals the k-th recurs with it, so at least 3,588 pairs
      recur and the rate is at least 8%, printed 8 or more; above 7.995 even on seed 7 of the
      periodic-then-chaotic series, where states repeat exactly and many distances tie.
    readout: Recurrence rate
    expect: { above: 7.995 }
    setup:
      seed: 7
  - id: longest-line-is-the-four-cycle
    statement: >-
      After its 500-step transient the r = 3.5 half is the period-4 cycle exactly, so states i and
      i + 4 coincide for every i up to 150 (state 154 is the last made only of the first 156
      samples): a line of 151 points. The chaotic half has 145 states, too few for a longer line
      of its own.
    readout: Longest diagonal line
    expect: { value: 151 }
  - id: longest-line-is-the-sine-period
    statement: >-
      The sine has period 23, so states i and i + 23 differ by rounding only and the diagonal at
      offset 23 is recurrent along all its 300 − 23 = 277 points. No line is longer: offsets that
      are multiples of 23 hold 1,807 pairs, so the 3,588th distance falls among the 3,913 pairs at
      offsets of ±1 modulo 23, whose distance runs through the same 23 values (0.263 to 0.281)
      every 23 points; ε lies below the largest of them, so those lines break within 23 points,
      and every other offset is at least 0.52 apart.
    readout: Longest diagonal line
    expect: { value: 277 }
    setup:
      params: { series: sine }
  - id: sine-period-lines-at-lmin-23
    statement: >-
      Counting only lines of 23 points or more on the sine keeps exactly the full lines at offsets
      23j, of 300 − 23j points for j up to 12 (offset 299 holds a single point): 1,806 of the 3,588
      recurrent pairs, since every other line breaks within 23 points. Determinism is 1,806 / 3,588
      = 50.33%, 50.3 within 0.05 to the readout's three digits.
    readout: Determinism
    expect: { value: 50.3, tolerance: 0.05 }
    setup:
      params: { series: sine, lmin: 23 }
  - id: no-line-beyond-the-longest
    statement: >-
      The sine's longest line has 277 points, so counting only lines of 278 points or more counts
      none: determinism is exactly 0.
    readout: Determinism
    expect: { value: 0 }
    setup:
      params: { series: sine, lmin: 278 }
---

When the trajectory returns near where it has been, drawn as a matrix whose texture changes with regime.

The series is delay-embedded and every pair of states compared; ε is set so that the chosen share of pairs recur: it is the distance of the pair at that rank, so pairs tied with it recur as well, and on the regime series, whose periodic half repeats states exactly, the rate can read a little above the target. Periodic motion draws long diagonal lines, chaos short broken ones, noise isolated points; the logistic series that switches from period 4 to chaos halfway changes texture where the regime does.

Recurrence quantification is computed on the block revealed so far, with the main diagonal excluded: determinism is the share of recurrent points on diagonal lines of length two or more (the shortest line counted is a control), laminarity the share on vertical lines. The chart is the histogram of diagonal line lengths.
