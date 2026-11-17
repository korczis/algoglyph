---
id: finite-differences
title: Finite Differences
taxonomy: numerics/differentiation
status: live
engine: numeric
schema: algoglyph.entry/v2
aliases:
  - difference quotient
  - numerical differentiation
  - five-point stencil
  - Richardson extrapolation
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 9 (Newton’s laws of dynamics: the motion found step by step, with velocity as a difference over a small interval)'
    purpose: further-reading
  - id: fornberg-1988
    purpose: implementation
tags:
  - derivative
  - difference quotient
  - order of accuracy
  - truncation error
  - round-off
  - h-halving
complexity: O(1) per estimate, two to four function values; thirty halvings of the step a run
interaction: Choose the function; the run halves the step h from 1/2 to 2⁻³⁰ and shows each scheme's error as it goes.
motivation: A derivative is the limit of a difference quotient, but a computer cannot take the limit; it takes a small step, and the step that is best is not the smallest, because truncation shrinks with h while rounding grows as 1/h.
relations:
  - type: related_to
    target: simpson-quadrature
    reason: The mirror problem, integration from function values, measured the same way; there the trapezoid's order 2 and Simpson's 4 come from halving the panel, here forward 1, central 2 and five-point 4 from halving the step.
  - type: derived_from
    target: polynomial-interpolation
    reason: Each stencil is the derivative at x₀ of the polynomial through its nodes; two nodes give the forward quotient, three about x₀ the central one, five the fourth-order stencil.
  - type: related_to
    target: bound-states
    reason: That plate's Schrödinger operator is the central second difference on a grid; its levels converge at second order in the grid step, the order measured here for the first derivative.
pedagogy:
  difficulty: introductory
  objectives:
    - Estimate f′(x₀) by forward, central and five-point differences and measure each error against the closed-form derivative.
    - Measure each scheme's order from halving the step, log₂ of the error ratio, and match it to 1, 2 and 4.
    - Find the step at which central differences are most accurate and match it to the balance of truncation h²|f‴|/6 against rounding ε|f|/h.
  misconceptions:
    - A smaller step is not always better; below the best step rounding in f(x + h) − f(x − h) dominates and the error grows as 1/h.
    - The central quotient is not the forward one averaged with luck; its symmetry cancels the h f″/2 term, so the error starts at h² f‴/6.
    - A higher-order stencil is not exact; it is exact only on polynomials up to its degree, and it reaches its best error at a larger step than a low-order one.
  questions:
    - Why does halving h divide the forward error by 2 but the five-point error by 16?
    - Why is the best step for central differences near 10⁻⁵ and not near 10⁻¹⁶?
    - On x³ the five-point error is only rounding at every step; why?
algorithm:
  paradigm: iterative-refinement
  properties:
    deterministic: true
  preconditions:
    - f is smooth near x₀ (five times differentiable for the five-point order), and f is evaluated in IEEE double precision.
  invariants:
    - Every error is measured against the derivative in closed form, never against another estimate.
    - The order is the least-squares slope of log |error| against log h over h = 2⁻² … 2⁻⁶, where truncation sets the error on every function offered.
  limitations:
    - Only first derivatives on uniform stencils; Fornberg's weights for any node set and any derivative are cited, not computed.
    - The predicted best step takes ε|f(x₀)| as the rounding in f, which is the order of magnitude, not the exact constant.
experiments:
  - id: sine-orders
    title: Orders 1, 2 and 4 on sin x
    params: { fn: sine }
    observe: Each halving divides the forward error by 2, the central by 4 and the five-point by 16, until rounding takes over near h = 2⁻¹⁷ for central and 2⁻¹¹ for five-point.
  - id: exp-orders
    title: The same orders on eˣ
    params: { fn: exp }
    observe: The orders do not depend on the function; only the constants in front of hᵖ do.
  - id: cubic-exact
    title: A cubic, where five points are exact
    params: { fn: cubic }
    observe: Central differences err by exactly h², and the five-point stencil has no truncation error at all; its error is rounding only.
  - id: atan-steep
    title: A steep arctangent
    params: { fn: atan }
    observe: The function bends on a scale of 1/4, so at h = 1/4 the halving ratios are not yet 2, 4 and 16; the orders appear only once h is small against that scale, and the larger third derivative pulls the best central step down, as (3ε|f|/|f‴|)^⅓ says.
claims:
  - id: forward-first-order
    statement: >-
      On sin x at x₀ = 1, forward differences are first order: the slope of log |error| against log h,
      measured over h = 2⁻² … 2⁻⁶ against the closed-form derivative cos 1, is 1 within 0.2.
    readout: Forward differences, measured order
    expect: { value: 1, tolerance: 0.2 }
  - id: central-second-order
    statement: >-
      Central differences on sin x at x₀ = 1 are second order: the slope measured by h-halving over
      h = 2⁻² … 2⁻⁶ is 2 within 0.2.
    readout: Central differences, measured order
    expect: { value: 2, tolerance: 0.2 }
  - id: five-point-fourth-order
    statement: >-
      The five-point stencil on sin x at x₀ = 1 is fourth order: the slope measured by h-halving over
      h = 2⁻² … 2⁻⁶ is 4 within 0.2.
    readout: Five-point differences, measured order
    expect: { value: 4, tolerance: 0.2 }
    setup:
      params: { fn: sine }
  - id: five-point-fourth-order-exp
    statement: >-
      The order belongs to the scheme, not the function: on eˣ at x₀ = 0.5 the five-point slope is 4
      within 0.2 as well.
    readout: Five-point differences, measured order
    expect: { value: 4, tolerance: 0.2 }
    setup:
      params: { fn: exp }
  - id: central-cubic-exactly-h-squared
    statement: >-
      On x³ the central quotient is 3x₀² + h² exactly, so its error is h² and the measured order is 2
      within 0.001.
    readout: Central differences, measured order
    expect: { value: 2, tolerance: 0.001 }
    setup:
      params: { fn: cubic }
  - id: round-off-past-the-best-step
    statement: >-
      Past the best step rounding takes over: on sin x the central error at h = 2⁻³⁰ is more than a
      thousand times its smallest error over the run.
    readout: Central error at the smallest step, over its smallest
    expect: { above: 1000 }
  - id: best-central-step
    statement: >-
      The best central step on sin x lies within a factor of 4 (2 in log₂) of the balance of truncation
      h²|f‴|/6 against rounding ε|f|/h, (3ε|f(x₀)|/|f‴(x₀)|)^⅓ ≈ 2⁻¹⁶·⁶.
    readout: Central differences, best step, log₂
    expect: { against: 'Central differences, predicted best step (3ε|f|/|f‴|)^⅓, log₂', tolerance: 2 }
---

A derivative from function values alone, and the step that is small enough but no smaller.

**Three quotients.** The forward quotient (f(x₀ + h) − f(x₀))/h misses f′(x₀) by about h f″/2, so halving h halves its error: first order. The central quotient (f(x₀ + h) − f(x₀ − h))/2h is symmetric, the f″ terms cancel and the error starts at h² f‴/6: second order, a quarter of the error per halving. The five-point stencil (−f(x₀ + 2h) + 8f(x₀ + h) − 8f(x₀ − h) + f(x₀ − 2h))/12h cancels the h² term too. It is Richardson's extrapolation of the central quotient, (4C(h) − C(2h))/3, and it is fourth order: a sixteenth per halving. Each stencil is the derivative at x₀ of the polynomial through its nodes, which is how Fornberg's recursion gives the weights for any nodes and any derivative.

**Orders, measured.** The run halves h thirty times, from 1/2 to 2⁻³⁰, and measures each error against the closed-form derivative. The order is not assumed. It is the slope of log |error| against log h over h = 2⁻² … 2⁻⁶, where truncation sets the error, and each step also shows log₂ of that halving's error ratio. On x³ the central quotient is 3x₀² + h² exactly, and the five-point stencil differentiates a cubic exactly, so its error is rounding alone.

**The best step.** Every quotient subtracts two nearly equal numbers and divides by h, so the rounding error in f, about ε|f| with ε = 2⁻⁵², becomes ε|f|/h in the derivative. Truncation falls as hᵖ while rounding grows as 1/h, and the total is smallest where they balance: near (3ε|f|/|f‴|)^⅓ ≈ 10⁻⁵ for central differences, and at a larger step for the five-point stencil, whose truncation falls faster. Below that step the zoomed panel turns from a parabola into noise, and the error grows again.

**Data.** The plate takes no data of a reader's. Its errors are measured against a derivative in closed form, which a reader's table does not carry, and halving the step needs the function at any point, not on a fixed grid of samples.
