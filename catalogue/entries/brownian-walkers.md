---
id: brownian-walkers
title: Brownian Walkers
taxonomy: physics/statistical
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 41 (the Brownian movement), ch. 43 (diffusion), ch. 46 (ratchet and pawl)'
    purpose: further-reading
tags:
  - Brownian motion
  - diffusion
  - Langevin equation
  - Einstein relation
  - Boltzmann distribution
complexity: O(walkers) per step, Euler–Maruyama
interaction: Choose the landscape, the temperature and the friction; each knob restarts the walkers.
motivation: Einstein's link between the jiggling of particles and the friction they feel, D = kT/γ, made the size of atoms measurable.
relations:
  - type: analogue_of
    target: gray-scott
    reason: The density of many independent walkers obeys the diffusion equation ∂ρ/∂t = D∇²ρ, the diffusion term of the reaction-diffusion system, with walker density for chemical concentration.
  - type: uses
    target: box-muller
    reason: Every step's Gaussian kicks are drawn by the Box–Muller transform from the seeded generator.
  - type: related_to
    target: hurst-dfa
    reason: A Brownian path is the H = ½ case the detrended fluctuation analysis measures.
  - type: related_to
    target: ising-model
    reason: Another sampler of the Boltzmann distribution, there by Metropolis flips, here by Langevin dynamics.
pedagogy:
  difficulty: introductory
  objectives:
    - Watch independent random walkers spread with a mean squared displacement that grows linearly in time, 4Dt in a plane.
    - Connect the spreading to friction and temperature through Einstein's D = kT/γ.
    - See walkers in a well settle into the Boltzmann distribution e^(−U/kT), and above a floor into the barometric law.
    - Check that an asymmetric ratchet at one temperature does not drive a current.
  misconceptions:
    - A random walker does not drift back to where it started; its typical distance grows like √t.
    - An asymmetric potential alone cannot make a net current at one temperature; that would be a machine extracting work from a single heat bath.
    - The noise and the friction are not independent; both come from the same molecular collisions, and Einstein's relation ties them.
  questions:
    - If the friction doubles at the same temperature, how does the spreading change?
    - Why does the harmonic well's measured variance sit slightly above kT/k for a finite time step?
    - What would have to differ between the two sides of the ratchet's teeth for a current to flow?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - dt·|U″|/γ is well below 1 for every preset.
  limitations:
    - Overdamped dynamics only; inertia is neglected (the velocity relaxes instantly).
    - Euler–Maruyama biases a harmonic well's stationary variance by the factor 1/(1 − k dt/2γ); the plate compares with that corrected value and says so.
    - The ratchet's force is discontinuous at its corners; the small time step keeps the scheme's error there below the run's statistical error.
experiments:
  - id: harmonic-well
    title: A harmonic well
    params: { preset: harmonic }
    observe: The cloud settles into a Gaussian of variance kT/k.
  - id: hot-and-sticky
    title: Hotter and stickier
    params: { kT: 2, gamma: 2 }
    observe: D = kT/γ is unchanged, and so is the spreading.
  - id: ratchet
    title: The ratchet at one temperature
    params: { preset: ratchet }
    observe: No drift within the run's error, however asymmetric the teeth.
claims:
  - id: einstein-spreading
    statement: >-
      Two thousand walkers in a plane spread with a mean squared displacement of 4Dt, D = kT/γ, within
      0.09 at the end of the run (four standard errors of the mean of r², 4Dt/√N).
    readout: MSD over 4Dt at the end
    expect: { value: 1, tolerance: 0.09 }
    setup:
      params: { n: 2000 }
  - id: spreading-is-linear-in-time
    statement: >-
      Over the whole run the mean squared displacement grows linearly, its least-squares slope 4D
      within 10 %.
    readout: MSD slope over 4D, fitted over the run
    expect: { value: 1, tolerance: 0.1 }
    setup:
      params: { n: 2000 }
  - id: boltzmann-in-a-well
    statement: >-
      In a harmonic well the walkers' positions are distributed as e^(−U/kT): their KS distance from the
      Gaussian of variance kT/k (with the scheme's known factor 1/(1 − k dt/2γ)) is under the 95 % bound.
    readout: KS distance from the Boltzmann distribution
    expect: { against: 'KS 95 % bound, 1.36/√N', below: 0 }
    setup:
      params: { n: 2000, preset: harmonic }
  - id: barometric-height
    statement: >-
      Above a reflecting floor under a weight mg the walkers' mean height is the scale height kT/mg
      within 0.045, four standard errors.
    readout: mean height, measured
    expect: { against: 'scale height kT/mg', tolerance: 0.045 }
    setup:
      params: { n: 2000, preset: gravity }
  - id: drift-down-a-tilt
    statement: >-
      Under a uniform force F the cloud drifts at F/γ = (D/kT)F within 0.04, four standard errors of the
      measured velocity.
    readout: drift velocity, measured
    expect: { against: 'drift velocity F/γ = (D/kT)F', tolerance: 0.04 }
    setup:
      params: { n: 2000, preset: tilt }
  - id: no-current-from-one-bath
    statement: >-
      In an asymmetric sawtooth ratchet two kT high, at one temperature, the measured drift is within
      three standard errors of zero: detailed balance forbids a current from a single heat bath.
    readout: drift in standard errors
    expect: { range: [-3, 3] }
    setup:
      params: { n: 2000, preset: ratchet }
---

Many independent walkers, each kicked about by its surroundings and held back by friction; together they spread, settle and drift exactly as the statistical mechanics of their single heat bath says.

**The walk.** Each walker moves by dx = (F(x)/γ) dt + √(2D) dW, the overdamped Langevin equation, with D = kT/γ: the noise that kicks it and the friction that slows it come from the same collisions, and Einstein's relation fixes one by the other. The steps are Euler–Maruyama, with Gaussian kicks from the Box–Muller transform of the seeded generator, small enough that the landscape barely changes over one.

**Spreading.** On flat ground in a plane the mean squared displacement grows as 4Dt, linearly in time. The dashed circle has the radius √(4Dt) and grows with the run; the chart beside it plots the measured mean squared displacement against the straight line.

**Settling.** In a harmonic well the walkers end up distributed as e^(−U/kT), a Gaussian of variance kT/k; the Kolmogorov–Smirnov distance from it is compared with the 95 % bound, using the variance the Euler–Maruyama scheme itself settles to, (kT/k)/(1 − k dt/2γ), not the continuum's. Above a reflecting floor under a weight mg they thin out exponentially with height, the barometric law, with mean height kT/mg.

**Drifting, and not.** Down a uniform tilt the cloud drifts at F/γ, which is (D/kT)F. In a sawtooth ratchet whose teeth rise slowly and fall steeply, nothing drifts: at a single temperature every jump forward is balanced by one back. The ratchet only turns, in Feynman's argument, when the pawl and the wheel sit at different temperatures. The density of many walkers obeys the diffusion equation, the diffusion half of #/p/gray-scott; a Brownian path is the H = ½ series #/p/hurst-dfa measures.
