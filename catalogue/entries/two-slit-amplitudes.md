---
id: two-slit-amplitudes
title: Two Slits, One Amplitude Each
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 1, §1-4 to §1-8 (electrons, watching them, the uncertainty principle); the same chapter as Vol. I, ch. 37'
    purpose: further-reading
  - id: englert-duality
    purpose: proof
  - id: abramowitz-stegun
    ref: 'Chapters 7 (erf) and 9 (J₀): the reference values the special functions are tested against'
    purpose: implementation
  - id: griffiths-qm
    ref: 'Chapter 1 (the statistical interpretation) and §3.5 (the uncertainty principle)'
    purpose: further-reading
tags:
  - two-slit experiment
  - wave function
  - Born rule
  - which-way information
  - detector resolution
  - uncertainty principle
complexity: O(log cells) per particle; the wall's grid O(n log n) once per setting
interaction: The experiment menu switches between four apparatus; every knob restarts the run.
motivation: The one experiment from which the rules of quantum mechanics can be read off.
relations:
  - type: compares_with
    target: two-slit-classical
    reason: The same counting apparatus with bullets, whose curves add where these interfere.
  - type: related_to
    target: ripple-tank
    reason: Water waves through two slits interfere the way these amplitudes do, but arrive as a continuous intensity, not as lumps.
  - type: related_to
    target: quantum-tunnelling
    reason: The same wave function, there evolved in time through a barrier.
pedagogy:
  difficulty: intermediate
  objectives:
    - Add amplitudes, then square, and see why P₁₂ is not P₁ + P₂ for electrons although each arrives as one lump.
    - Turn an arrival density into discrete events by sampling and judge them against the density with a Kolmogorov–Smirnov distance.
    - Relate the fringe contrast left by a which-way probe to the overlap of the states the probe is left in.
    - Tell fringes that are hidden by a coarse detector from fringes that are absent because the path is marked.
    - Read the recoiling-wall argument as a quantitative trade between distinguishability and visibility.
  misconceptions:
    - A coarse detector does not destroy interference; the particles still arrive in fringes, and a finer detector shows them again.
    - Watching with light does not lower the fringes steadily as the light gets bluer; the overlap J₀(kd) oscillates, reversing the fringes between its zeros.
    - Sorting hits by whether a photon was scattered is not sorting them by slit; only when the photon's overlap is near zero do the two coincide.
    - The uncertainty relation is not a statement about clumsy apparatus; it bounds the spreads of any state of the wall.
  questions:
    - Why does the centre bin of N₁₂ hold almost twice what N₁ + N₂ holds there, and what makes it less than twice?
    - With half the electrons scattering a photon of short wavelength, what fraction of the contrast survives, and in which hits?
    - At what photon wavelength do the fringes vanish completely for in-plane scattering, and what happens just beyond it?
    - Why can a heavy bullet's interference never be seen, though it is there?
    - Why does D² + V² stay below 1 for a momentum reading of the wall, and what measurement would reach 1?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  invariants:
    - Every density sampled is non-negative and the sampler's cumulative ends at 1.
    - The detector kernel's weights are non-negative and sum to 1.
    - The wall's state stays normalised on its grid.
  limitations:
    - Far field only (L ≫ a²/λ), paraxial angles, a monochromatic and spatially coherent source; a finite source size lowers the contrast (van Cittert–Zernike) and an energy spread washes out the higher orders, neither modelled.
    - Non-relativistic scalar electrons, one at a time; no spin, no space charge.
    - The which-way photon is illuminated along the beam axis and scattered either uniformly in the plane (γ = J₀(kd)) or isotropically in space (γ = sin(kd)/kd); a dipole pattern would give yet another overlap.
    - The fine-fringe check runs on a grid that resolves the fringe period, with the single-slit envelope taken as flat across the detector's reach; at a bullet's scale no grid can, and the closed form is shown for display only.
    - The recoiling wall is heavy enough that its packet does not spread while the particle passes (σₚτ/M ≪ σₓ), the slits are point-like and the illumination a plane wave.
experiments:
  - id: watched-reversed
    title: Fringes reversed by the light
    params: { scenario: watched, eta: 1, photon: 3.62, scatter: plane }
    observe: The visibility is negative; bright and dark have swapped, and J₀(kd) explains it.
  - id: watched-blue
    title: Light short enough to tell the slits apart
    params: { scenario: watched, eta: 1, photon: 2.3, scatter: sphere }
    observe: The hits add up to P₁ + P₂; the fringes are gone.
  - id: watched-dim
    title: Dim light
    params: { scenario: watched, eta: 0.5, photon: 2.3, scatter: sphere }
    observe: Half the electrons scatter no photon and keep their fringes; the rest lose them.
  - id: resolution-electron
    title: An electron and a coarse Gaussian detector
    params: { scenario: resolution, mass: -30.04, speed: 1000, width: -1 }
    observe: The detector reads a tenth of the contrast the particles arrive with.
  - id: recoil-sharp-position
    title: A wall pinned in place
    params: { scenario: recoil, spread: 1 }
    observe: Its momentum is so uncertain that the kick reveals nothing, and the fringes stay.
claims:
  - id: de-broglie-wavelength-at-50-ev
    statement: >-
      A units check: an electron of 50 eV has the de Broglie wavelength 1.2264/√50 nm = 0.17344 nm,
      the non-relativistic h/√(2mₑE) with the CODATA constants.
    readout: electron wavelength λ
    expect: { value: 0.17344, tolerance: 0.00002 }
    setup:
      params: { rate: 3.3 }
  - id: centre-bin-matches-its-integral
    statement: >-
      With 60,000 electrons per run the centre bin holds N₁₂/(N₁ + N₂) within 0.18 (four standard
      errors of the counts) of the closed-form ratio for that bin, 1 + sinc(πw/Λ) weighted by the
      envelope: amplitudes added, then squared.
    readout: centre bin N₁₂ / (N₁ + N₂)
    expect: { against: 'centre bin ratio expected, 1 + sinc(πw/Λ) on the envelope', tolerance: 0.18 }
    setup:
      params: { rate: 3.3, n: 60000 }
  - id: centre-bin-is-not-additive
    statement: >-
      The same ratio is above 1.5, where adding probabilities would give 1: the electrons do not
      behave like the bullets.
    readout: centre bin N₁₂ / (N₁ + N₂)
    expect: { above: 1.5 }
    setup:
      params: { rate: 3.3, n: 60000 }
  - id: born-sampling-passes-ks
    statement: >-
      The both-slit hits are a sample of |ψ₁ + ψ₂|²: their Kolmogorov–Smirnov distance from a Simpson
      cumulative of the closed form is under the 95 % bound 1.36/√N. The sampler's own discretisation
      is under a tenth of that bound (test/two-slit.test.ts); at a fixed seed the check is
      deterministic, and about one seed in twenty would fail it by chance.
    readout: KS distance of the hits from p(x)
    expect: { against: 'KS 95 % bound, 1.36/√N', below: 0 }
    setup:
      params: { rate: 3.3, n: 60000 }
  - id: electron-fringes-full-contrast
    statement: >-
      Unwatched, the hits show the full contrast the amplitude model predicts, a visibility of 1
      within 0.016 (four standard errors at 60,000 electrons).
    readout: visibility from the both-slit hits
    expect: { value: 1, tolerance: 0.016 }
    setup:
      params: { rate: 3.3, n: 60000 }
  - id: in-plane-photon-matches-j0
    statement: >-
      Every electron scatters one photon of 4,169 nm in the plane (kd = 3.77): the hits' visibility,
      drawn from per-event phase kicks with no overlap formula in the sampler, agrees with
      γ = J₀(kd) within 0.04, four standard errors.
    readout: visibility from all hits
    expect: { against: 'γ_eff = (1 − η) + η·γ', tolerance: 0.04 }
    setup:
      params: { rate: 3.3, scenario: watched, eta: 1, photon: 3.62, scatter: plane }
  - id: in-plane-photon-reverses-fringes
    statement: >-
      Between the first two zeros of J₀ the overlap is negative, and so is the measured visibility:
      the light swaps the bright and dark fringes rather than merely fading them.
    readout: visibility from all hits
    expect: { below: -0.3 }
    setup:
      params: { rate: 3.3, scenario: watched, eta: 1, photon: 3.62, scatter: plane }
  - id: short-light-erases-fringes
    statement: >-
      Photons of 200 nm scattered isotropically (kd = 78.7, sin(kd)/kd = −0.002) leave a visibility
      within 0.04 of zero: the hits add up to P₁ + P₂.
    readout: visibility from all hits
    expect: { range: [-0.04, 0.04] }
    setup:
      params: { rate: 3.3, scenario: watched, eta: 1, photon: 2.3, scatter: sphere }
  - id: dim-light-keeps-half
    statement: >-
      When only half the electrons scatter such a photon, the visibility of all hits agrees with
      γ_eff = (1 − η) + η·γ ≈ 0.5 within 0.04.
    readout: visibility from all hits
    expect: { against: 'γ_eff = (1 − η) + η·γ', tolerance: 0.04 }
    setup:
      params: { rate: 3.3, scenario: watched, eta: 0.5, photon: 2.3, scatter: sphere }
  - id: unscattered-electrons-keep-fringes
    statement: >-
      In the same dim light, the hits of electrons that scattered no photon keep a visibility of 1
      within 0.04: nothing marked their path.
    readout: visibility, hits with no photon
    expect: { value: 1, tolerance: 0.04 }
    setup:
      params: { rate: 3.3, scenario: watched, eta: 0.5, photon: 2.3, scatter: sphere }
  - id: gaussian-detector-on-the-grid
    statement: >-
      A Gaussian detector a third of a fringe wide (σ/Λ = 0.344), applied by numerical convolution on
      a grid of 64 cells per fringe, leaves the contrast exp(−2π²σ²/Λ²) to within 1e−5.
    readout: contrast as the detector reads it, read on the grid
    expect: { against: 'contrast factor, closed form', tolerance: 0.00001 }
    setup:
      params: { rate: 3.3, scenario: resolution, mass: -30.04, speed: 1000, width: -1, detector: gaussian }
  - id: box-detector-on-the-grid
    statement: >-
      A box detector 1.37 fringes wide, convolved on the same grid, leaves the signed contrast
      sinc(πw/Λ) to within 1e−3, the grid error of the box's edges.
    readout: contrast as the detector reads it, read on the grid
    expect: { against: 'contrast factor, closed form', tolerance: 0.001 }
    setup:
      params: { rate: 3.3, scenario: resolution, mass: -30.04, speed: 1000, width: -0.4, detector: box }
  - id: box-detector-reverses-fringes
    statement: >-
      That box reads the fringes reversed, a contrast below −0.15: it averages more of the
      neighbouring dark fringes than of the bright one it sits on.
    readout: contrast as the detector reads it, read on the grid
    expect: { below: -0.15 }
    setup:
      params: { rate: 3.3, scenario: resolution, mass: -30.04, speed: 1000, width: -0.4, detector: box }
  - id: detector-kernel-normalised
    statement: >-
      A numerics check: the box kernel's cell weights, each the share of the cell the box covers,
      sum to 1 to rounding.
    readout: kernel weights − 1, numerics
    expect: { value: 0, tolerance: 0.000000000001 }
    setup:
      params: { rate: 3.3, scenario: resolution, mass: -30.04, speed: 1000, width: -0.4, detector: box }
  - id: detector-keeps-every-particle
    statement: >-
      A numerics check: the detector's reading holds as many particles as arrived, to rounding;
      blurring moves them, it does not remove them.
    readout: reading total − arrival total, numerics
    expect: { value: 0, tolerance: 0.000000001 }
    setup:
      params: { rate: 3.3, scenario: resolution, mass: -30.04, speed: 1000, width: -1, detector: gaussian }
  - id: gaussian-wall-minimum-uncertainty
    statement: >-
      A numerics check: the Gaussian wall's spreads, computed on its grid and from the FFT of its
      state, multiply to ħ/2 within 1e−6.
    readout: σₓσₚ / (ħ/2), from the grid
    expect: { value: 1, tolerance: 0.000001 }
    setup:
      params: { rate: 3.3, scenario: recoil }
  - id: chirped-wall-above-minimum
    statement: >-
      A numerics check: the chirped wall's spreads multiply to (ħ/2)√5 = 2.2360680·ħ/2 within 1e−4,
      a state above the minimum.
    readout: σₓσₚ / (ħ/2), from the grid
    expect: { value: 2.236068, tolerance: 0.0001 }
    setup:
      params: { rate: 3.3, scenario: recoil, wall: chirped }
  - id: overlap-equals-smeared-fringe
    statement: >-
      A numerics check: the overlap of the two kicked wall states, summed on the wall's grid, equals
      the contrast fitted to the fringe pattern convolved with the wall's position density, within
      1e−6.
    readout: visibility, overlap of the kicked wall states |γ|
    expect: { against: 'visibility, fitted to the smeared pattern', tolerance: 0.000001 }
    setup:
      params: { rate: 3.3, scenario: recoil }
  - id: overlap-matches-closed-form
    statement: >-
      For a Gaussian wall the numerical overlap agrees with exp(−Δq²σₓ²/2ħ²) within 2e−6.
    readout: visibility, overlap of the kicked wall states |γ|
    expect: { against: 'visibility, closed form exp(−Δq²σₓ²/2ħ²)', tolerance: 0.000002 }
    setup:
      params: { rate: 3.3, scenario: recoil }
  - id: chirp-costs-visibility
    statement: >-
      The chirped wall, with the same momentum spread, is wider in position, and its numerical
      overlap still follows the closed form within 2e−6, at a visibility far below the Gaussian's.
    readout: visibility, overlap of the kicked wall states |γ|
    expect: { against: 'visibility, closed form exp(−Δq²σₓ²/2ħ²)', tolerance: 0.000002 }
    setup:
      params: { rate: 3.3, scenario: recoil, wall: chirped }
  - id: momentum-reading-distinguishes
    statement: >-
      Reading the wall's momentum tells the paths apart with the total-variation distance
      erf(Δq/2√2σₚ), computed on the FFT grid within 2e−3 of the closed form.
    readout: distinguishability D, reading the wall’s momentum
    expect: { against: 'D, closed form erf(Δq/2√2σₚ)', tolerance: 0.002 }
    setup:
      params: { rate: 3.3, scenario: recoil }
  - id: duality-is-strict-for-a-momentum-reading
    statement: >-
      With σₚ = Δq/2 the momentum reading and the fringes share less than the whole: D² + V² is below
      0.9, under Englert's bound of 1, which only the optimal measurement reaches.
    readout: D² + V²
    expect: { below: 0.9 }
    setup:
      params: { rate: 3.3, scenario: recoil }
  - id: chirped-wall-is-further-from-the-bound
    statement: >-
      The chirped wall gives the same distinguishability and much less visibility, so its D² + V²
      is below 0.6.
    readout: D² + V²
    expect: { below: 0.6 }
    setup:
      params: { rate: 3.3, scenario: recoil, wall: chirped }
  - id: hits-show-the-wall-overlap
    statement: >-
      Sixty thousand electrons, each meeting the wall at a position drawn from its state, land with
      a visibility within 0.02 (four standard errors) of the wall's overlap.
    readout: visibility from the hits
    expect: { against: 'visibility, overlap of the kicked wall states |γ|', tolerance: 0.02 }
    setup:
      params: { rate: 3.3, scenario: recoil, n: 60000 }
  - id: pinned-wall-keeps-fringes
    statement: >-
      A wall with momentum spread ten times the kick (pinned in position) keeps the fringes, a
      visibility above 0.99.
    readout: visibility, overlap of the kicked wall states |γ|
    expect: { above: 0.99 }
    setup:
      params: { rate: 3.3, scenario: recoil, spread: 1 }
  - id: free-wall-erases-fringes
    statement: >-
      A wall with momentum spread a twentieth of the kick, so sharp in momentum that the kick shows
      which slit was used, keeps a visibility below 0.001.
    readout: visibility, overlap of the kicked wall states |γ|
    expect: { below: 0.001 }
    setup:
      params: { rate: 3.3, scenario: recoil, spread: -1.3 }
  - id: free-wall-tells-the-path
    statement: >-
      That same wall's momentum tells the paths apart almost surely, D above 0.99.
    readout: distinguishability D, reading the wall’s momentum
    expect: { above: 0.99 }
    setup:
      params: { rate: 3.3, scenario: recoil, spread: -1.3 }
---

Electrons fired one at a time at two slits arrive as single lumps, yet pile up into fringes. Four apparatus share one amplitude model: plain electrons, electrons watched by a light, fringes too fine for a detector, and a slit wall free to recoil.

**The model.** Through slit j alone the amplitude at screen position x is ψⱼ = √(a/2λL) · sinc(πax/λL) · e^{∓iπdx/λL}, for slits of width a, centres ±d/2, a screen at distance L in the far field. Each slit alone gives half the single-slit envelope e(x); both give |ψ₁ + ψ₂|² = e(x)(1 + cos(2πx/Λ)), with fringe period Λ = λL/d. Densities are per emitted electron: with a slit shut, half the electrons stop at it, so N₁ + N₂ and N₁₂ compare at the same flux. Each hit is drawn from the envelope's table and kept with probability (1 + cos(2πx/Λ + θ))/2, so the fringes in the hits come from the acceptance alone; the Kolmogorov–Smirnov distance judges them against a finer Simpson cumulative of the closed form. Electrons are drawn as hits, never as paths: nothing in the model says which slit an unwatched electron used.

**Electrons.** Three runs, as with #/p/two-slit-classical: slit 2 shut, slit 1 shut, both open. The centre bin of N₁₂ holds about twice the centre of N₁ + N₂, less by the bin's width: the closed form for a bin of width w is 1 + sinc(πw/Λ), weighted by the envelope, and the readout computes it for the bin actually used.

**Watched.** A light behind the slits scatters a photon off each electron with probability η. The photon's direction kicks a phase θ = k·d·sin φ into the second path (k·d·nₓ for scattering isotropic in space), drawn afresh for every electron; illumination is along the beam, so the incident photon adds no phase. Averaged over the photon, the cross term is multiplied by γ = J₀(kd) in the plane or sin(kd)/kd in space, and over all electrons by γ_eff = (1 − η) + η·γ. The visibility measured from the hits is compared with that closed form. J₀ oscillates: between kd = 2.405 and 5.520 it is negative and the fringes come back reversed, and beyond that they revive before fading slowly. The plate sorts hits by whether a photon was scattered, never by slit: the hits with no photon keep full fringes, and those with one carry γ.

**Fine fringes.** A particle of mass m and speed v has the wavelength h/mv; for a 10 g bullet at 300 m/s through slits micrometres apart the fringes are about 10⁻²⁸ m apart, and any real detector averages across 10²⁵ of them. A Gaussian response multiplies the contrast by exp(−2π²σ²/Λ²) and a box by sinc(πw/Λ), which turns negative between one and two fringe widths. The check is made on a grid that resolves the fringes, 64 cells per period, convolving numerically; at the bullet's scale the closed form is shown for display only. The particles still arrive in fringes: this is the detector smoothing them, not decoherence, and a finer detector would show them again.

**The recoiling wall.** If the wall holding the slits is free, an electron reaching a point on the screen through one slit or the other leaves it with momenta differing by Δq = pd/L. The wall's two final states overlap by γ = ⟨φ|e^{iΔqX/ħ}|φ⟩, which is also the contrast of the fringe pattern smeared by the wall's position spread; both are computed numerically, from the wall's state on an FFT grid, and compared with the closed form exp(−Δq²σₓ²/2ħ²) for a Gaussian wall. Reading the wall's momentum distinguishes the paths by D = erf(Δq/2√2σₚ), and Englert's inequality D² + V² ≤ 1 holds, with equality only for the optimal measurement, which a momentum reading is not. A chirped wall, above the minimum σₓσₚ = ħ/2, has the same D and less V. The spreads here are standard deviations, bounded by σₓσₚ ≥ ħ/2; the lecture's ΔxΔp ≈ h is an order-of-magnitude statement, and its heuristic estimate of the surviving contrast (about e^{−1/8} at the minimum) is a heuristic, not this calculation.
