---
id: stern-gerlach-analyzers
title: Stern–Gerlach Analysers
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - Stern-Gerlach apparatus
  - spin filters
  - Wigner d-matrix
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 5 (spin one: filtering atoms with analysers in series) and ch. 6 (spin one-half: rotations of the base states)'
    purpose: further-reading
  - id: gerlach-stern-1922
    purpose: history
  - id: wigner-1931
    ref: 'The closed formula for the rotation matrices of angular momentum j'
    purpose: implementation
  - id: griffiths-qm
    ref: 'Chapter 4: spin, and the Stern–Gerlach experiment'
    purpose: further-reading
  - id: abramowitz-stegun
    ref: 'Table 26.8: percentage points of the χ² distribution'
    purpose: implementation
tags:
  - Stern–Gerlach
  - spin
  - angular momentum
  - rotation matrix
  - Wigner d-matrix
  - Born rule
  - projective measurement
  - χ² test
complexity: O((2j + 1)³ log θ) for each rotation matrix, then O(1) per particle
interaction: Choose the spin, how far the middle and last analysers are turned, which channel the middle one lets through (or all of them), and how many particles the source sends.
motivation: Three magnets in a row hold most of quantum mechanics; a beam splits into 2j + 1 beams, a filter turned through an angle passes a share fixed by a rotation matrix, and an analyser that lets every channel through changes nothing at all, because amplitudes, not probabilities, recombine.
relations:
  - type: related_to
    target: two-slit-amplitudes
    reason: An open middle analyser is two slits left unwatched; the channel amplitudes add and the beam comes out as it went in, as the slit amplitudes add to fringes.
  - type: related_to
    target: additive-congruential
    reason: The same χ² test of counts against expected shares judges a generator's uniformity there and Born's rule here.
pedagogy:
  difficulty: intermediate
  prerequisites: [spin-precession]
  objectives:
    - Predict the share of a beam that passes an analyser turned through θ from the rotation matrix d^j(θ), and check it against counted particles.
    - Compute the rotation matrix two ways, by exponentiating the generator Jy and by Wigner's formula, and find them equal to round-off.
    - See that a fully open analyser changes nothing, and that blocking one channel of it does.
    - Judge simulated counts against Born's rule with a χ² test at a stated significance.
  misconceptions:
    - An analyser with every channel open is not the same as no analyser only by accident; the channels' amplitudes add back up to the state that went in.
    - Turning an analyser through 180° does not leave the beam unchanged; it exchanges the top and bottom channels.
    - The shares through a turned analyser are not cos²θ in general; they are squares of the d-matrix, which for spin one are (1 ± cos θ)²/4 and sin²θ/2.
    - A spin-½ state is not returned to itself by a turn of 2π; its rotation matrix is −1, a sign no single analyser can see.
  questions:
    - For spin one with the middle analyser at 90° passing its second channel, why does the last analyser along z never count a particle in its middle channel?
    - What share of a spin-3/2 beam in its top state passes an analyser turned by 120° set to its third channel?
    - Why does the χ² test lose its power when one channel's expected count falls to a handful?
    - How would the counts change if the source were polarised along z instead of unpolarised?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Every analyser is turned about the same axis, perpendicular to the beam, so the three rotation matrices commute.
  invariants:
    - Each rotation matrix is orthogonal to round-off; its rows are the probabilities' square roots and sum in square to one.
    - Every particle that passes the first two analysers is counted in exactly one channel of the last.
  limitations:
    - The analysers are ideal; each separates the channels completely and the beam has no spatial spread.
    - The source is unpolarised and the first analyser, along z, keeps its top channel m = j.
    - Particles are drawn from the seeded generator; a link reproduces its counts exactly.
experiments:
  - id: spin-one-at-60
    title: Spin one, turned by 60°
    params: { j: '1', theta: 60, keep: '0' }
    observe: The middle analyser passes 9/16 of the beam, ((1 + cos 60°)/2)², and the last along z sorts the rest as 9/16, 6/16 and 1/16.
  - id: open-changes-nothing
    title: An open analyser in the middle
    params: { j: '1', theta: 60, keep: open }
    observe: With every channel of the middle analyser open, every particle arrives in the top channel along z, as if the middle analyser were not there.
  - id: zero-in-the-middle
    title: A zero in the middle channel
    params: { j: '1', theta: 90, keep: '1' }
    observe: The middle channel at 90° holds the state with no m = 0 part along z, so the last analyser's middle channel stays empty.
  - id: spin-half-quarter-turn
    title: Spin one-half at 90°
    params: { j: '0.5', theta: 90 }
    observe: Half the beam passes, and the last analyser along z splits it evenly again.
  - id: spin-three-halves
    title: Spin 3/2 through a turned filter
    params: { j: '1.5', theta: 120, keep: '2', phi: 30 }
    observe: Four channels everywhere; a filter on the third channel at 120° passes 27/64 of the top state.
  - id: last-analyser-turned
    title: The last analyser turned instead
    params: { j: '1', keep: open, phi: 60 }
    observe: With the middle one open, a last analyser at 60° counts 9/16, 6/16 and 1/16, the same shares the middle filter showed.
claims:
  - id: d-matrix-two-ways
    statement: >-
      For spin one at θ = 60° the rotation matrix from exponentiating −iθJy and the one from Wigner's
      closed formula agree within 1e−12 in every element.
    readout: largest |d by e^(−iθJy) − d by Wigner’s formula|
    expect: { below: 0.000000000001 }
  - id: d-matrix-two-ways-three-halves
    statement: >-
      For spin 3/2 at θ = 120° and φ = 30° the two computations again agree within 1e−12.
    readout: largest |d by e^(−iθJy) − d by Wigner’s formula|
    expect: { below: 0.000000000001 }
    setup:
      params: { j: '1.5', theta: 120, keep: '2', phi: 30 }
  - id: rotation-orthogonal
    statement: >-
      (numerics) The rotation matrix is orthogonal: RᵀR differs from the identity by less than 1e−13.
    readout: largest |RᵀR − 1| of the rotation, numerics
    expect: { below: 0.0000000000001 }
  - id: spin-one-table
    statement: >-
      For spin one the squared column of the top state is ((1 + cos θ)/2)², sin²θ/2 and ((1 − cos θ)/2)²
      within 1e−14.
    readout: 'largest gap to the spin-1 table (1 ± cos θ)²/4, sin²θ/2'
    expect: { below: 0.00000000000001 }
  - id: middle-share-binomial
    statement: >-
      The share of particles the middle analyser passes lies within four binomial standard errors of
      |d₁₁(60°)|² = 9/16, at every seed of 1 to 5.
    readout: middle analyser, measured share in binomial standard errors from |d|²
    expect: { range: [-4, 4] }
    setup:
      seeds: [1, 2, 3, 4, 5]
  - id: born-rule-chi2
    statement: >-
      The last analyser's counts pass a χ² test against Born's rule at the 99.9 % point for their degrees
      of freedom, at every seed of 1 to 5.
    readout: χ² of the last analyser’s counts against Born’s rule
    expect: { against: 'χ² 99.9 % point for the channels reached less one', below: 0 }
    setup:
      seeds: [1, 2, 3, 4, 5]
  - id: born-rule-chi2-three-halves
    statement: >-
      Twenty thousand spin-3/2 particles through a filter at 60° on its top channel also pass the χ² test
      at the 99.9 % point, at every seed of 1 to 5.
    readout: χ² of the last analyser’s counts against Born’s rule
    expect: { against: 'χ² 99.9 % point for the channels reached less one', below: 0 }
    setup:
      params: { j: '1.5', particles: 20000 }
      seeds: [1, 2, 3, 4, 5]
  - id: open-analyser
    statement: >-
      With every channel of the middle analyser open no particle reaches a channel other than the top one
      of the last analyser along z: amplitudes recombine.
    readout: counts in channels of zero probability
    expect: { value: 0, tolerance: 0.5 }
    setup:
      params: { keep: open }
      seeds: [1, 2, 3]
  - id: zero-in-the-middle
    statement: >-
      Spin one through the second channel of an analyser at 90° never lands in the middle channel along z,
      since d₀₀(90°) = cos 90° = 0.
    readout: counts in channels of zero probability
    expect: { value: 0, tolerance: 0.5 }
    setup:
      params: { theta: 90, keep: '1' }
      seeds: [1, 2, 3]
---

Three Stern–Gerlach analysers in a row, for spin ½, 1 or 3/2: the middle and last ones turned about the beam, the middle one passing one channel or all of them, and every particle's path drawn by Born's rule from rotation matrices computed two independent ways.

**What an analyser does.** A Stern–Gerlach magnet sorts a beam of spin j into 2j + 1 beams, one for each value m of the spin along its field. The first analyser, along z, keeps the top beam, m = j. The next one is turned through θ about the beam: in its own frame the state is rotated by e^(−iθJy), and the amplitude for its channel m is the matrix element d^j_{m j}(θ), so it passes the share |d^j_{m j}(θ)|². The plate computes that matrix twice. Once as the exponential of the generator: Jy, built from the ladder formula as in #/p/spin-precession, is purely imaginary, so −iθJy is a real antisymmetric matrix, summed as a Taylor series after halving θ until it is small and squaring back. Once by Wigner's closed sum over factorials. They agree to round-off, and the rotation is orthogonal to round-off.

**Born's rule, counted.** The source sends particles of random m. Each one meets the first analyser, then the middle one with the probability of the channel it lets through, then the last, where its channel is drawn from the squared amplitudes. The middle share is held to its binomial standard error, and the last analyser's counts to a χ² test at the 99.9 % point. For spin one the shares through a filter turned by θ have the closed forms ((1 + cos θ)/2)², sin²θ/2 and ((1 − cos θ)/2)², Feynman's table for spin one.

**An open analyser changes nothing.** If the middle analyser lets every channel through, there is no record of which channel a particle took, and the amplitudes add back up: Σₘ d_{m′m}(−θ) d_{m j}(θ) is the identity. Every particle then arrives in the top channel of a last analyser along z, exactly as if the middle one were absent. Block one channel and the others appear. It is the same reason two unwatched slits in #/p/two-slit-amplitudes give fringes and watched ones do not. For spin one at 90°, the middle channel holds a state with no m = 0 part along z, so a zero appears in the last count: d₀₀(90°) = cos 90° = 0.
