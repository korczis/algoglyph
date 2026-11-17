---
id: elastic-lattice
title: Elastic Lattice
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - triangular spring network
  - Poisson's ratio
  - Cauchy-Born rule
  - lattice waves
  - phonons
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 38 (elasticity: Young''s modulus and Poisson''s ratio) and ch. 39 (elastic materials: the tensor of elasticity, waves in an elastic body, elastic constants from the forces between atoms)'
    purpose: further-reading
  - id: landau-lifshitz-elasticity
    ref: '§4–§5 (the moduli of an isotropic body, Poisson''s ratio), §22 (longitudinal and transverse waves)'
    purpose: implementation
  - id: born-huang-1954
    ref: 'The elastic constants of a lattice from its interatomic forces, and the Cauchy relations they obey for central forces between neighbours'
    purpose: implementation
  - id: ashcroft-mermin-1976
    ref: 'Chapter 22: the dynamical matrix of a Bravais lattice and its normal modes'
    purpose: implementation
  - id: hestenes-stiefel-1952
    purpose: implementation
tags:
  - elasticity
  - Poisson's ratio
  - Young's modulus
  - spring network
  - lattice dynamics
  - dispersion
  - conjugate gradients
  - velocity Verlet
  - Saint-Venant's principle
complexity: O(bonds) per relaxation iteration or time step; the relaxation stops by 4n iterations, the run takes about 0.25/√(12k) per step
interaction: Choose the experiment. Pull a strip with sliding or clamped grips, its length, width and the pull; or set a periodic sheet ringing with plane waves of a chosen wavelength, or kick it at its centre. The spring constant scales every speed and modulus; the exaggeration only changes the drawing.
motivation: A sheet of equal springs on a triangular lattice is an isotropic elastic solid with one number fixed by its geometry alone, Poisson's ratio 1/3, and its two kinds of wave run at speeds in the ratio √3; both come out of the bonds of one site, so the relaxed and the ringing sheet can be held to them.
relations:
  - type: compares_with
    target: gaussian-elimination
    reason: The strip's equilibrium is the sparse, symmetric positive-definite system K u = f; elimination solves such a system directly at O(n³), the plate iterates on it by conjugate gradients, each step one pass over the bonds.
  - type: related_to
    target: verlet-cloth
    reason: Both are masses joined by springs and stepped by Verlet's scheme; there the springs are stiff links that let a cloth drape, here they are the linear bonds of a solid whose moduli and wave speeds are measured.
  - type: related_to
    target: tight-binding-chain
    reason: Both find a lattice's dispersion from the couplings of one site, ω(q) or E(q) a sum of 1 − cos(q·b) over its neighbours; there the amplitude of an electron hops, here the displacements of masses pull.
pedagogy:
  difficulty: intermediate
  objectives:
    - Pull a strip on sliding grips and measure that it narrows by a third of its stretch, whatever its size and stiffness.
    - Derive λ = μ = √3k/4 from the bonds of one site and see Poisson's ratio λ/(λ + 2μ) = 1/3 and Young's modulus 2k/√3 follow.
    - Clamp the ends and watch the narrowing vanish at the grips and recover to 1/3 a strip's width away, as Saint-Venant's principle says.
    - Measure a longitudinal and a transverse wave's frequencies and find their ratio √3 at long wavelengths, falling as the wavelength nears the spacing.
  misconceptions:
    - Poisson's ratio is not a property one picks for this sheet; with central springs between nearest neighbours it is fixed at 1/3 by the lattice's geometry.
    - The ratio of the wave speeds is not that of two springs; both waves run on the same springs, and the transverse one is slower because a bond resists a sideways shift less than a stretch.
    - The sheet narrowing everywhere by the same amount needs grips that let its ends narrow too; clamped ends hold the width there, and the strip's middle still narrows by 1/3.
    - A long-wave ratio of √3 does not hold at every wavelength; near the spacing the lattice disperses, and the ratio falls.
  questions:
    - Why does a stretch along x leave the inclined bonds unstretched, and what does that fix about the narrowing?
    - What happens to the ratio of the speeds as the wavelength approaches the spacing, and why?
    - How far from a clamped grip does the strip's narrowing return to 1/3, and on what does that distance depend?
    - Why is the kick's longitudinal front ahead of its transverse front along the direction of the kick?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Equal masses m = 1 at spacing a = 1 on a triangular lattice, each joined to its six nearest neighbours by a spring of constant k.
    - The springs are linear in the small-displacement limit; a bond's force is k·n·(u_q − u_p) along its direction n.
  invariants:
    - Conjugate gradients lower the energy on the free degrees of freedom at every step and reach equilibrium within one step per free degree of freedom in exact arithmetic.
    - At equilibrium the strain energy is half the work of the grips, U = ½Σ f·u, to the residual.
    - Velocity Verlet keeps the total momentum of the periodic sheet to round-off, and its energy without drift.
  limitations:
    - No large deformations; the springs never buckle or break, and the pull scales the displacements without changing a ratio.
    - The relaxation stops at a free residual of 1e−13 of its start, or after 4n iterations.
    - The waves' sheet is periodic, so a wave whose wavelength does not divide its width is not held; the kick's run ends before its front wraps round.
bounds:
  model: relaxation iterations or time steps, each one pass over the bonds
  best: Θ(iterations · bonds)
  average: Θ(iterations · bonds)
  worst: Θ(n · bonds), the relaxation stopping by 4n iterations
  space: Θ(n) for the displacements, velocities and the bonds
experiments:
  - id: sliding-grips
    title: A third of the stretch, everywhere
    params: { mode: stretch, grips: sliding }
    observe: Pulled by 1% on grips that let its ends narrow, the 48 × 12 strip narrows by 0.333…% along its whole length, the inclined bonds unstretched.
  - id: clamped-grips
    title: Clamped ends hold the width
    params: { mode: stretch, grips: clamped, columns: 80 }
    observe: Next to the clamps the strip narrows by less than half of a third; a few widths away it narrows by a third again.
  - id: wide-clamped
    title: A strip too short for its width
    params: { mode: stretch, grips: clamped, columns: 80, rows: 40 }
    observe: With the grips 2.3 widths apart, the middle never reaches a uniform stress; its narrowing overshoots 1/3, to about 0.342.
  - id: two-wave-speeds
    title: Two wave speeds in one solid
    params: { mode: waves, waves: 1 }
    observe: The x amplitude crosses zero about √3 times as often as the y amplitude; both waves run on the same springs.
  - id: short-waves
    title: The lattice disperses
    params: { mode: waves, waves: 12 }
    observe: Four sites to a wavelength, the ratio of the frequencies has fallen to 1.615, as the dynamical matrix says.
  - id: kick
    title: A kick sends two fronts
    params: { mode: pulse }
    observe: Along the kick the longitudinal front runs ahead; across it the transverse front follows at c_L/√3.
  - id: stiffer-springs
    title: Stiffer springs, the same ratios
    params: { mode: waves, k: 4 }
    observe: Both frequencies double and their ratio does not move.
claims:
  - id: poisson-third
    statement: >-
      Pulled on sliding grips, the strip narrows across its middle column by −ε_yy/ε_xx = λ/(λ + 2μ) = 1/3 of the bond
      sum, within 1e−9.
    readout: 'Poisson’s ratio, measured: −ε_yy/ε_xx across the middle column'
    expect: { against: 'Poisson’s ratio λ/(λ + 2μ) of the bond sum', tolerance: 0.000000001 }
  - id: poisson-uniform
    statement: >-
      Sliding grips leave the stress uniform: the column next to a grip narrows by the same 1/3 within 1e−9.
    readout: Poisson’s ratio, measured at the column next to a grip
    expect: { against: 'Poisson’s ratio λ/(λ + 2μ) of the bond sum', tolerance: 0.000000001 }
  - id: young-modulus
    statement: >-
      The grip's pull over the strip's width and the strain is Young's modulus 4μ(λ + μ)/(λ + 2μ) = 2k/√3 of the
      bond sum within 1e−9.
    readout: 'Young’s modulus, measured: the grip’s pull over the strip’s width and the strain'
    expect: { against: 'Young’s modulus 4μ(λ + μ)/(λ + 2μ) of the bond sum', tolerance: 0.000000001 }
  - id: clapeyron
    statement: >-
      (numerics) At equilibrium the springs hold half the work of the grips, |U − ½Σf·u|/U below 1e−9.
    readout: 'strain energy against half the grips’ work, |U − ½Σf·u|/U, numerics'
    expect: { below: 0.000000001 }
  - id: clamped-middle
    statement: >-
      Clamped at both ends, an 80-site strip still narrows across its middle within 0.005 of 1/3: the clamps'
      disturbance dies out within a few widths.
    readout: 'Poisson’s ratio, measured: −ε_yy/ε_xx across the middle column'
    expect: { against: 'Poisson’s ratio λ/(λ + 2μ) of the bond sum', tolerance: 0.005 }
    setup:
      params: { grips: clamped, columns: 80 }
  - id: clamped-grip
    statement: >-
      Next to a clamp the strip narrows by less than 0.2 of its stretch: the clamp holds its width.
    readout: Poisson’s ratio, measured at the column next to a grip
    expect: { below: 0.2 }
    setup:
      params: { grips: clamped, columns: 80 }
  - id: longitudinal-dispersion
    statement: >-
      The longest longitudinal wave of the 48-column sheet rings at the ω of the lattice's dynamical matrix within
      2e−6 rad/s, measured between zeros of its amplitude.
    readout: 'longitudinal ω, measured between zeros of the x amplitude (rad/s)'
    expect: { against: 'longitudinal ω of the lattice’s dispersion (rad/s)', tolerance: 0.000002 }
    setup:
      params: { mode: waves }
  - id: transverse-dispersion
    statement: >-
      The transverse wave of the same wavelength rings at the dynamical matrix's ω within 2e−6 rad/s.
    readout: 'transverse ω, measured between zeros of the y amplitude (rad/s)'
    expect: { against: 'transverse ω of the lattice’s dispersion (rad/s)', tolerance: 0.000002 }
    setup:
      params: { mode: waves }
  - id: speeds-root-three
    statement: >-
      Their ratio is the continuum's c_L/c_T = √((λ + 2μ)/μ) = √3 within 1e−3; the lattice lowers it by about
      0.028(qa)²√3 at qa = 2π/48.
    readout: 'c_L/c_T, measured as ω_L/ω_T'
    expect: { against: 'c_L/c_T = √((λ + 2μ)/μ) of the bond sum', tolerance: 0.001 }
    setup:
      params: { mode: waves }
  - id: speeds-ratio-lattice
    statement: >-
      The same ratio matches the dynamical matrix's ω_L/ω_T within 1e−5.
    readout: 'c_L/c_T, measured as ω_L/ω_T'
    expect: { against: 'ω_L/ω_T of the lattice’s dispersion', tolerance: 0.00001 }
    setup:
      params: { mode: waves }
  - id: short-wave-ratio
    statement: >-
      Twelve wavelengths across, four sites to each, the ratio has fallen to the dynamical matrix's 1.615 within 5e−4.
    readout: 'c_L/c_T, measured as ω_L/ω_T'
    expect: { against: 'ω_L/ω_T of the lattice’s dispersion', tolerance: 0.0005 }
    setup:
      params: { mode: waves, waves: 12 }
  - id: waves-energy-kept
    statement: >-
      (numerics) Velocity Verlet keeps the ringing sheet's energy within 1e−4 of its start.
    readout: 'energy, largest relative change |E − E₀|/E₀, numerics'
    expect: { below: 0.0001 }
    setup:
      params: { mode: waves }
  - id: waves-momentum-kept
    statement: >-
      (numerics) Every bond pulls its two ends equally and oppositely, so the sheet's momentum stays within 1e−12 of
      zero.
    readout: 'momentum, largest change |P − P₀|, numerics'
    expect: { below: 0.000000000001 }
    setup:
      params: { mode: waves }
  - id: kick-energy-kept
    statement: >-
      (numerics) After the kick the sheet's energy stays within 1e−4 of its start.
    readout: 'energy, largest relative change |E − E₀|/E₀, numerics'
    expect: { below: 0.0001 }
    setup:
      params: { mode: pulse }
  - id: kick-momentum-kept
    statement: >-
      (numerics) And the kick's momentum stays within 1e−11 of what it gave.
    readout: 'momentum, largest change |P − P₀|, numerics'
    expect: { below: 0.00000000001 }
    setup:
      params: { mode: pulse }
---

A sheet of equal masses, each tied to its six nearest neighbours by equal springs. Pull it by its ends and it narrows; shake it and two kinds of wave run through it, one stretching the bonds along its way, one shifting them sideways. How much it narrows and how much faster the first wave is than the second are both set by the triangle of bonds round one site, and by nothing else.

**The model.** The springs are linear: a bond of direction n pulls its two ends together with k·n·(u_q − u_p), and the energy is ½k Σ (n·Δu)². A uniform strain ε stretches a bond of direction n by n·ε·n, so the energy per area is ½(k/A) Σ (n·ε·n)² over the three directions of one site's bonds, A = √3/2 the area of a site. Read off as C_ijkl = (k/A) Σ n_i n_j n_k n_l, the sum gives C₁₁₁₁ = C₂₂₂₂ = 3C₁₁₂₂ and C₁₁₂₂ = C₁₂₁₂: the sheet is isotropic with λ = μ = √3k/4, the Cauchy relation of central forces between neighbours. Poisson's ratio in the plane is λ/(λ + 2μ) = 1/3, Young's modulus 4μ(λ + μ)/(λ + 2μ) = 2k/√3. The plate computes these from the bond directions alone and sets them beside what the sheet does.

**The strip.** The grips move their sites by the stretch ε·x and the rest of the strip is relaxed by conjugate gradients on its free degrees of freedom, one pass over the bonds a step, until the residual is 1e−13 of its start. Grips that slide sideways leave the strip under a uniform stress: the bonds along the pull carry it all, the inclined ones are not stretched, and n·ε·n = 0 for them fixes ε_yy = −ε_xx/3. Clamped grips hold the ends' width, so there the strip barely narrows; the disturbance dies out over about a width, as Saint-Venant's principle says, and the middle of a long strip narrows by a third again. The panel on the right draws the narrowing along the strip; at equilibrium the strain energy is half the grips' work.

**The waves.** On a periodic sheet a plane wave along a bond direction is an exact normal mode, longitudinal or transverse, at the frequency of the dynamical matrix D(q) = (k/m) Σ 2(1 − cos(q·b)) n nᵀ over one site's bonds. The plate starts both at once, steps the sheet by velocity Verlet and measures each frequency between the zeros of its amplitude. At long wavelengths ω/q tends to the continuum's c_L = √((λ + 2μ)/ρ) and c_T = √(μ/ρ), in the ratio √3; as the wavelength nears the spacing the bonds' cosines bend both branches and the ratio falls. A kick at the centre sends out both fronts at once; the dashed circles are c_L·t and c_T·t.

The plate takes no reader's data: its inputs are a lattice's size and a spring constant, and a reader's own network of springs would need its own geometry, not this one's.
