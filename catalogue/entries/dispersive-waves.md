---
id: dispersive-waves
title: Dispersive Waves
taxonomy: physics/waves
status: live
engine: numeric
schema: algoglyph.entry/v2
aliases:
  - group velocity
  - phase velocity
  - wave packet
  - beats
  - numerical dispersion
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 48 (Beats: the sum of two waves, the modulation, and the group velocity dω/dk against the phase velocity ω/k)'
    purpose: further-reading
  - id: trefethen-1982
    purpose: algorithm-reference
tags:
  - dispersion
  - group velocity
  - phase velocity
  - wave packet
  - beats
  - leapfrog
  - finite differences
complexity: O(cells) per time step; a line of up to 1,600 cells for 480 steps, the field kept every 4 steps
interaction: Choose a packet or beats, the carrier wavenumber k₀ and the Courant number squared C²; the run replays the line and tracks the packet's centre and its crests, or the beat envelope at two probes.
motivation: Waves whose speed depends on their wavelength carry their energy at one speed and their crests at another; the leapfrog line shows both from nothing but its own stencil, and at C² = 1 shows them become one.
relations:
  - type: derived_from
    target: finite-differences
    reason: The line's Laplacian is the central second difference; its truncation turns k² into 4 sin²(k/2), and that is the whole of the dispersion measured here.
  - type: related_to
    target: ripple-tank
    reason: The same leapfrog stencil (src/plates/_shared/wave2d) on a grid; along an axis the tank's waves obey this line's dispersion, so its short ripples lag its long ones.
  - type: related_to
    target: tight-binding-chain
    reason: There an electron's packet on a lattice moves at dE/dk of a cosine band; here a wave's packet on a line of cells moves at dω/dk of the scheme, measured the same way from the packet's centre.
  - type: related_to
    target: maxwell-1d
    reason: Yee's scheme leapfrogs E and H on a line and has the same numerical dispersion, sin(ωΔt/2) = S sin(kΔx/2), with the Courant number S in the place of C.
pedagogy:
  difficulty: intermediate
  objectives:
    - Measure the group velocity as the slope of the packet centre Σx u²/Σu² against time and match it to dω/dk of the scheme.
    - Measure the phase velocity from the turning of the carrier's phase and match it to ω/k; see the crests slip backwards through a packet that moves slower than they do.
    - Read the leapfrog line's dispersion relation sin(ω/2) = C sin(k/2), and see that at C² = 1 it becomes ω = k, where group and phase velocity are equal.
    - Watch two close wavenumbers beat and match the envelope's period to 2π/|ω₁ − ω₂| and its speed to Δω/Δk.
  misconceptions:
    - The packet does not move at the speed of its crests; when short waves are slower, the crests run forward through the envelope and vanish at its front.
    - A smaller Courant number is not a more accurate wave; on a line the scheme is exact at C² = 1 and grows more dispersive as C² falls.
    - The group velocity is not ω/k at the packet's centre; it is the slope dω/dk, which on this line is smaller than ω/k at every wavenumber below C² = 1.
  questions:
    - At k₀ = 2.4 and C² = 0.5, how many cells do the crests gain on the packet over the run, and why do they not pile up at its front?
    - Why is the beat period at the probe 2π/|ω₁ − ω₂| and not 2π/|k₁ − k₂|?
    - At C² = 1 the packet keeps its shape for the whole run; what does the scheme do at C² = 1 that it does not do below?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - C² ≤ 1, the leapfrog line's stability limit, and k₀ well inside (0, π), so the carrier has several cells a wavelength.
    - The packet or the beat window starts far from both fixed ends and does not reach them within the run.
  invariants:
    - The field is stepped only by leapfrog1d of src/plates/_shared/wave2d/leapfrog.ts; the closed forms leapfrogOmega, leapfrogGroupVelocity and leapfrogPhaseVelocity are the oracle and never step the field.
    - Every measured velocity is a least-squares slope over the run so far, of the packet centre, of the carrier's unwrapped phase, or of the beat nodes at the probes.
  limitations:
    - The initial step sets the packet off to the right with its envelope moved by v_g(k₀) and its phase by ω(k₀); a small left-moving remainder of order 1/σ² is left in the field.
    - The beat period is read from the nodes of the envelope at one probe, whose amplitude the moving window changes, which biases it by a fraction of a step.
    - One dimension and no damping or sources; the tank's grid dispersion, which depends on direction, is not shown.
experiments:
  - id: packet-dispersive
    title: A packet at k₀ = 1.6, C² = 0.5
    params: { experiment: packet, k0: '1.6', c2: '0.5' }
    observe: The centre moves at 0.57 cells a step while the crests move at 0.66; in the space-time panel the crests' tracks are steeper than the centre's and cross the packet from back to front.
  - id: packet-short-waves
    title: Short waves, k₀ = 2.4, C² = 0.25
    params: { experiment: packet, k0: '2.4', c2: '0.25' }
    observe: The crests move about twice as fast as the packet, and the packet itself crawls at a fifth of a cell a step, less than half the continuum speed C = 0.5.
  - id: packet-no-dispersion
    title: The dispersion-free line, C² = 1
    params: { experiment: packet, k0: '2.4', c2: '1' }
    observe: Centre and crests move together at one cell a step, the packet keeps its width to the last digit, and the scheme's ω(k) is the continuum's straight line.
  - id: beats
    title: Beats of k₀ ∓ 0.05 at k₀ = 1.6, C² = 0.5
    params: { experiment: beats, k0: '1.6', c2: '0.5' }
    observe: The sum of the two carriers swells and vanishes in a slow envelope; at the probes its nodes arrive every 2π/|ω₁ − ω₂| steps and travel between them at the group velocity, not at the crests' speed.
claims:
  - id: group-velocity-measured
    statement: >-
      The packet centre Σx u²/Σu², fitted against time over the run at k₀ = 1.6 and C² = 0.5, moves
      at the scheme's group velocity dω/dk = C cos(k/2)/√(1 − C² sin²(k/2)) within 0.001 cells a step.
    readout: Group velocity, measured from the packet centre
    expect: { against: Group velocity dω/dk of the scheme, tolerance: 0.001 }
    setup:
      params: { experiment: packet, k0: '1.6', c2: '0.5' }
  - id: group-velocity-short-wave
    statement: >-
      At k₀ = 2.4 and C² = 0.25, where the scheme is most dispersive of the settings offered, the
      packet centre still moves at dω/dk of the scheme within 0.001 cells a step.
    readout: Group velocity, measured from the packet centre
    expect: { against: Group velocity dω/dk of the scheme, tolerance: 0.001 }
    setup:
      params: { experiment: packet, k0: '2.4', c2: '0.25' }
  - id: phase-velocity-measured
    statement: >-
      The carrier's phase, the line's Fourier transform at k₀, turns at ω(k₀) of sin(ω/2) = C sin(k/2),
      so the crests move at the phase velocity ω/k of the scheme within 0.0001 cells a step.
    readout: Phase velocity, measured from the carrier phase
    expect: { against: Phase velocity ω/k of the scheme, tolerance: 0.0001 }
    setup:
      params: { experiment: packet, k0: '1.6', c2: '0.5' }
  - id: short-waves-slower
    statement: >-
      Short waves are slow: at k₀ = 2.4 and C² = 0.5 the measured group velocity is v_g/v_p = 0.5682
      of the measured phase velocity, the closed-form ratio, within 0.005.
    readout: Group over phase velocity, measured
    expect: { value: 0.5682, tolerance: 0.005 }
    setup:
      params: { experiment: packet, k0: '2.4', c2: '0.5' }
  - id: dispersion-free-line
    statement: >-
      At C² = 1 the leapfrog line is exact and has no dispersion: even at k₀ = 2.4 the measured group
      and phase velocities are equal within 10⁻⁹ cells a step.
    readout: Group minus phase velocity, measured
    expect: { value: 0, tolerance: 1.0e-9 }
    setup:
      params: { experiment: packet, k0: '2.4', c2: '1' }
  - id: beat-period
    statement: >-
      Two carriers k₀ ∓ 0.05 at k₀ = 1.6 and C² = 0.5 beat at the probe with the period 2π/|ω₁ − ω₂| of
      the scheme's frequencies, within half a step.
    readout: Beat period at the probe, measured
    expect: { against: Beat period 2π/|ω₁ − ω₂| of the scheme, tolerance: 0.5 }
    setup:
      params: { experiment: beats, k0: '1.6', c2: '0.5' }
  - id: beat-envelope-speed
    statement: >-
      The beat envelope's nodes travel between two probes 30 cells apart at Δω/Δk of the scheme, the
      group velocity of the pair, within 0.001 cells a step.
    readout: Envelope speed between the probes, measured
    expect: { against: Envelope speed Δω/Δk of the scheme, tolerance: 0.001 }
    setup:
      params: { experiment: beats, k0: '1.6', c2: '0.5' }
---

Waves whose speed depends on their wavelength, on the plainest line there is: the leapfrog stencil itself.

**The scheme's own dispersion.** The line steps u[n+1] = 2u[n] − u[n−1] + C²(u_E + u_W − 2u) with a unit cell and a unit time step. A mode e^{i(kx − ωt)} steps exactly when sin(ω/2) = C sin(k/2). For long waves that is ω ≈ Ck, the continuum's straight line, but below C² = 1 it bends under it: short waves are slower. The plate takes this relation as its physics. It is the dispersion of the stencil the ripple tank uses, and of Yee's scheme for light on a line, so the plate shows what those plates' short waves do.

**Group and phase velocity.** A packet is a carrier cos(k₀x) under a Gaussian envelope, set off to the right. Its crests move at the phase velocity ω/k. The packet as a whole, measured as its centre Σx u²/Σu² fitted against time, moves at the group velocity dω/dk = C cos(k/2)/√(1 − C² sin²(k/2)). The crests' speed is read from the field too: the line's Fourier transform at k₀ turns at ω, and ω/k₀ is the phase velocity. Below C² = 1 the group velocity is the smaller, so crests are born at the back of the packet, run through it and die at its front. At C² = 1 the scheme is exact, ω = k, and the packet slides along unchanged.

**Beats.** Two carriers k₀ ∓ δ add to 2 cos(δx − Δω t/2) cos(k₀x − ω̄t): a fast carrier in a slow envelope. At a fixed probe the envelope's nodes arrive every 2π/|ω₁ − ω₂| steps, and between two probes they travel at Δω/Δk, the group velocity of the pair, as Feynman derives it in his chapter on beats. The measured period is compared with the closed form; it reads a little long because the moving window changes the envelope's height at the probe.

**Data.** The plate takes no data of a reader's. Its waves come from a stencil and an initial packet it builds itself, and every measurement is checked against the scheme's closed-form dispersion relation, which a reader's recording of a wave would not obey.
