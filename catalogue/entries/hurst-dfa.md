---
id: hurst-dfa
title: Hurst exponent and detrended fluctuation
taxonomy: dynamics/time-series
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - hurst
  - dfa
  - long memory
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(N) per window size, O(N log N) over the logarithmic set of sizes; Θ(N²) to generate the fractional Gaussian noise by Hosking''s recursion'
related:
  - recurrence-plot
relations:
  - { type: uses, target: least-squares, reason: "Each box's trend is its least-squares line, and α is the least-squares slope of log F against log n." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - least-squares
  objectives:
    - Measure α as the slope of log F against log n, F(n) being the RMS left once each box's least-squares line is removed from the profile.
    - Tell white noise (½), persistent noise (more), anti-persistent noise (less) and a random walk (1.5) apart by their α.
    - Check the estimate against a planted answer, fractional Gaussian noise generated exactly by Hosking's recursion with the chosen Hurst exponent H.
  misconceptions:
    - The rescaled range reads H without bias; on short series it is biased, and white noise reads above ½.
claims:
  - id: white-noise-alpha-is-half
    statement: >-
      Independent samples have α = ½: the reading is within 0.130 of 0.5, four standard deviations
      of α (0.0324) over 2,000 other seeds (1 to 2,000), whose mean, 0.501, is within one of ½.
    readout: DFA exponent α so far
    expect: { value: 0.5, tolerance: 0.13 }
    setup:
      params: { series: white }
  - id: random-walk-alpha-is-three-halves
    statement: >-
      A random walk is the profile of white noise, so its own profile scales one power faster: α =
      1.5, within 0.240, four standard deviations (0.0600) over 2,000 other seeds, whose mean,
      1.483, is within one of 1.5.
    readout: DFA exponent α so far
    expect: { value: 1.5, tolerance: 0.24 }
    setup:
      params: { series: walk }
  - id: persistent-noise-alpha-is-planted
    statement: >-
      Fractional Gaussian noise generated with H = 0.8 has α = H: within 0.167 of 0.8, four
      standard deviations (0.0417) over 2,000 other seeds, whose mean, 0.796, is within one of 0.8.
    readout: DFA exponent α so far
    expect: { value: 0.8, tolerance: 0.167 }
  - id: anti-persistent-noise-alpha-is-planted
    statement: >-
      With H = 0.3 α is 0.3, within 0.095: four standard deviations (0.0236) over 2,000 other
      seeds, whose mean, 0.307, is within one of 0.3.
    readout: DFA exponent α so far
    expect: { value: 0.3, tolerance: 0.095 }
    setup:
      params: { series: fgn-0.3 }
  - id: rescaled-range-is-biased-on-short-windows
    statement: >-
      The expected rescaled range of n independent normal samples, Γ((n − 1)/2) / (√π Γ(n/2)) ·
      Σ √((n − i)/i) over i from 1 to n − 1, grows faster than √n on short windows: its log slope
      over the plate's window sizes (8 to 447) is 0.5613, not ½. White noise reads it within 0.098,
      four standard deviations (0.0243) over 2,000 other seeds.
    readout: Rescaled range H so far
    expect: { value: 0.561, tolerance: 0.098 }
    setup:
      params: { series: white }
---

Whether a series' trends persist or reverse, from how its fluctuations scale.

The profile is the cumulative sum of the series minus its mean. It is cut into boxes of n samples, each box's least-squares line is removed, and F(n) is the RMS of what remains; the slope of log F against log n is α. White noise gives ½, persistent noise more, anti-persistent noise less, and a random walk 1.5.

The fractional Gaussian noise is generated exactly by Hosking's recursion from its autocovariance, with the chosen Hurst exponent H, so the plate has a planted answer. The rescaled range R/S, measured on the same windows, is the older estimate of H and is known to be biased on short series.
