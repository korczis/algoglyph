---
id: thermo-diagrams
title: Heat-Engine Cycles on the p–V and T–S Planes
taxonomy: physics/statistical
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - Carnot cycle
  - Otto cycle
  - Diesel cycle
  - Stirling cycle
  - indicator diagram
  - Clausius equality
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 44 (the laws of thermodynamics: reversible engines, Carnot''s cycle, the efficiency 1 − T₂/T₁, entropy)'
    purpose: further-reading
  - id: callen-1985
    ref: 'ch. 4 (reversible processes, engines and their efficiencies)'
    purpose: proof
  - id: codata-2018
    ref: 'the gas constant R'
    purpose: data
tags:
  - thermodynamics
  - heat engine
  - efficiency
  - entropy
  - ideal gas
complexity: O(4 × 2000) per change, Simpson's rule along each leg
interaction: Choose the cycle and the gas; the sliders set the reservoirs' temperatures, the volume ratio and Diesel's cutoff.
motivation: The efficiency of every engine in the textbook comes from one loop drawn twice, and integrating along the loop gives each formula without being told it.
relations:
  - type: related_to
    target: hard-disk-gas
    reason: The cycles assume the ideal gas's pV = nRT and its heat capacity; there the pressure and the temperature come out of disks colliding.
  - type: uses
    target: simpson-quadrature
    reason: Every work, heat and entropy along a leg is Simpson's rule over 2000 panels of a smooth parametrised path.
pedagogy:
  difficulty: introductory
  objectives:
  - Read the work of a cycle as the area it encloses on the p–V plane, and the heat turned into work as its area on the T–S plane.
  - See that a Carnot engine's efficiency depends only on its two temperatures, not on the gas or the volumes.
  - Compare the Otto, Diesel and Stirling cycles with the Carnot engine between their own extreme temperatures.
  misconceptions:
  - An engine does not turn all the heat it takes in into work; the second law makes it give some to the cold side, however good its design.
  - A cycle's entropy does not grow in a reversible engine; the hot reservoir's loss and the cold one's gain cancel, and ∮dQ/T is zero.
  questions:
  - Why is the Stirling cycle without a regenerator less efficient than Carnot's between the same two temperatures?
  - What compression ratio must an Otto engine with a diatomic gas have to reach 60 % efficiency?
algorithm:
  paradigm: numerical-integration
bounds:
  model: Simpson's rule, 2000 panels per leg
  worst: 'error ≈ (b − a)h⁴ max|f⁗|/180, largest on an isochore''s dT/T between 200 K and 2500 K: 2e−10 in ∮dQ/T'
experiments:
  - id: carnot
    title: Carnot between 600 K and 300 K
    params: { cycle: carnot }
    observe: Half the heat taken in at 600 K becomes work; the rest goes to the reservoir at 300 K, and the T–S diagram is a rectangle.
  - id: carnot-gas-free
    title: The gas does not matter
    params: { cycle: carnot, gas: monatomic, ratio: 6 }
    observe: A monatomic gas and a larger expansion change the loop's shape on the p–V plane, but not the efficiency, still 1 − 300/600.
  - id: otto
    title: A petrol engine, compression ratio 8
    params: { cycle: otto, ratio: 8, Th: 2000 }
    observe: The Otto efficiency is 1 − 8^(−0.4) = 56.5 %, whatever the peak temperature; a Carnot engine between its extremes would reach 85 %.
  - id: diesel
    title: A diesel engine, compression ratio 18
    params: { cycle: diesel, ratio: 18, cutoff: 2 }
    observe: The heat goes in at constant pressure while the piston moves; at ratio 18 and cutoff 2 the efficiency is 63.2 %.
  - id: stirling
    title: Stirling without a regenerator
    params: { cycle: stirling, gas: monatomic }
    observe: The isochoric heating is paid for from the hot side, so the efficiency is 24 %, not Carnot's 50 % between the same temperatures.
claims:
  - id: carnot-efficiency
    statement: >-
      Carnot between 600 K and 300 K: the work over the heat taken in, both integrated along the four
      legs, is 1 − Tc/Th = 0.5, within Simpson's error of 1e−9.
    readout: efficiency, work over heat taken in
    expect: { value: 0.5, tolerance: 1.0e-9 }
  - id: carnot-work
    statement: >-
      Its work per mole, ∮p dV integrated, is R(Th − Tc)ln 2 = 1728.943896 J: the isotherms' works,
      the adiabats' cancelling.
    readout: work per cycle ∮p dV
    expect: { value: 1728.943896, tolerance: 0.000002 }
  - id: carnot-efficiency-monatomic
    statement: >-
      Between 1200 K and 300 K with a monatomic gas and a volume ratio of 3, the efficiency is
      1 − 300/1200 = 0.75: the gas and the volumes do not enter.
    readout: efficiency, work over heat taken in
    expect: { value: 0.75, tolerance: 1.0e-9 }
    setup:
      params: { cycle: carnot, gas: monatomic, Th: 1200, ratio: 3 }
  - id: otto-efficiency
    statement: >-
      Otto at a compression ratio of 8 with a diatomic gas: 1 − 8^(1−γ) = 0.564724718, whatever the
      peak temperature.
    readout: efficiency, work over heat taken in
    expect: { value: 0.564724718, tolerance: 1.0e-8 }
    setup:
      params: { cycle: otto, ratio: 8, Th: 2000 }
  - id: diesel-efficiency
    statement: >-
      Diesel at a compression ratio of 18 and a cutoff of 2: 1 − (ρ^γ − 1)/(γr^(γ−1)(ρ − 1)) =
      0.631577531.
    readout: efficiency, work over heat taken in
    expect: { value: 0.631577531, tolerance: 1.0e-8 }
    setup:
      params: { cycle: diesel, ratio: 18, cutoff: 2 }
  - id: stirling-efficiency
    statement: >-
      Stirling without a regenerator, monatomic, between 600 K and 300 K at a volume ratio of 2:
      R(Th − Tc)ln r/(R·Th ln r + Cv(Th − Tc)) = 0.240151244.
    readout: efficiency, work over heat taken in
    expect: { value: 0.240151244, tolerance: 1.0e-8 }
    setup:
      params: { cycle: stirling, gas: monatomic }
  - id: diesel-clausius
    statement: >-
      Around the Diesel cycle, ∮dQ/T, integrated leg by leg, is 0 as Clausius's equality for a
      reversible cycle says: within 1e−11, Simpson's error on the isobar's Cp dV/V.
    readout: Clausius ∮dQ/T
    expect: { below: 1.0e-11 }
    setup:
      params: { cycle: diesel, ratio: 18, cutoff: 2 }
---

A heat engine's cycle drawn twice: on the p–V plane, where the area it encloses is the work it does, and on the T–S plane, where the area is the heat it turns into work.

One mole of an ideal gas goes around four legs. Along an isotherm its temperature stays put and the heat it takes in is the work it does; along an adiabat no heat crosses, and the work comes out of its internal energy; along an isochore no work is done, and along an isobar both happen at once. Carnot's engine uses two isotherms and two adiabats, Otto's petrol engine two adiabats and two isochores, Diesel's an isobar in place of the first isochore, and Stirling's two isotherms and two isochores.

The plate integrates along every leg, by Simpson's rule over 2000 panels of a path in closed form: the work ∮p dV, the heat each leg takes in or gives out, and ∮dQ/T. The efficiency it reads is the work over the heat taken in; the readouts compare it with each cycle's formula, computed from the controls alone. The T–S diagram's entropy is accumulated from the first state along the same path; a reversible cycle comes back to where it started.

**A still.** Nothing in the picture moves: a cycle of reversible steps has no time in it, so the diagram is redrawn when a control changes and every readout is computed from the controls alone. The state travels in the URL.

**Data.** The plate takes no data of a reader's: its inputs are two choices and four sliders, and an engine's measured indicator diagram is not among the kinds ADR 0010 can read.
