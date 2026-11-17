# Feynman Lab: the slice plan

The working plan the Feynman lanes build from: §5 orders the slices, §6 says what the second pass must
reach. It was kept outside the repository until 2026-11-17, when it was lost there and restored from
the integrator's reading; the solver designs (§2, S0–S14) were not recovered.
Design each solver from the shared modules already in the repository:
- src/plates/_shared/particles (S5)
- _shared/ensemble (S7a)
- _shared/quantum (S10)
- _shared/fields (S8)
- _shared/two-slit (S3: screen.ts, detector.ts)
- the ode library (S0)

## 5. Ordered slices

**Every slice:**
- declares `pace` (ADR 0008);
- may add figure records only for reviewed chapters (ADR 0009). It adds none for chapters other than
  III/1; for those it records the candidates as `experiments` presets with claims;
- is one plate (or one refactor), with tests, claims, a catalogue entry (live), relations and the
  browser gate, as in ADR 0006.

Slices 0a–24 are done and on main (1b8e009).

| # | Slice | Solver | Claims (first ones) | Budget risk | After |
|---|---|---|---|---|---|
| 25 | `spinning-bodies` | S6 rigid body | E and \|L\| constant; intermediate-axis growth; fast-top precession | low | 0b |
| 26 | `far-field-diffraction`, `crystal-diffraction` (+ hoist screen/detector) | S3 | slit zeros; grating width; Airy 1.22; bcc/fcc rules | medium (2-D FFT 256²) | 0a |
| 27 | `rate-processes` | S7c | Bateman; Einstein → Planck occupancy; BE/FD means | low | 3 |
| 28 | `string-and-sound`, `dispersive-waves` (+ hoist ripple-tank's stencil) | S2 | f_n = nc/2L; leapfrog dispersion; group velocity | low | ripple lane merged |
| 29 | `ripple-tank` B | S2 | main-lobe angle; Mach angle; f_mn | medium (existing grid) | 28 |
| 30 | small B changes | none | per §1 table | low | 0a (bootstrap: U0) |
| 31 | remaining stills | S3/S8/S10/S11 or none | one independent computation each | low | their modules |
| 32 | numeric kernels | numeric engine | measured orders 1/2/4; digit doubling | low | 0a — taken by dev-5f |
| 33 | `elastic-lattice`, `beam` | S14 | ν = 1/3, c_L/c_T = √3; cantilever FL³/3EI; Euler load | medium | 0b |
| 34 | `lattice-boltzmann` | S13 | Poiseuille; Taylor–Green; Strouhal band | high (WASM) | 0a |
| 35 | `colour-matching` (still) | none | metamer pair XYZ equal | low | data licence check |
| U1…Un | upload adoption per engine | none | as U0 | low each | U0 |
| R0 | `analogue_of` decision | none | none | none | owner |
| R1 | analogue links + "same solver" derived surface | none | none | none | R0, after slices 10, 6, 28 |
| F(ch) | figure records for chapter ch | none | the figure's own claims under its setup | none | owner's source read of ch (ADR 0009 review) |

## 6. Second pass: what "improve" means, measurably

Each target is a count derived from the catalogue or a test, never typed.

1. **Claims.** Every live plate in physics, dynamics, numerics and signals, and every new plate, has at
   least one claim whose expected value comes from an independent oracle. Target: zero live plates
   without claims in those wings.
2. **Conserved-quantity readouts** for every integrator plate, each bounded by a claim.
3. **Convergence order.** Every shared solver has an h-halving test, with the measured p within ±0.2 of
   the scheme's order.
4. **Presets.** At least 2 `experiments` per live physics plate, the Feynman candidates among them.
5. **Documentation.** physics, then dynamics and numerics, are added to `catalogue/maturity.yaml`
   `documented`.
6. **Interconnection.** No live physics entry is isolated (relation in-degree + out-degree ≥ 1). Each
   Feynman plate has at least two typed relations, one of them across wings. One-sided only.
7. **Data.** Every declared `data` input passes the fuzz, network-silence and URL round-trip tests.
8. **Pace and budget.** No pacing regression (test/pacing). Headroom at the heaviest corner is ≥ 2×
   under `frame_ms` for every new plate, measured in the full test:budget.
9. **Accessibility.** The browser gate stays clean in light and dark at 390 and 1440 px, for every
   plate and every routed figure.
10. **Figure readiness.** The number of chapters with a recorded owner review (derived from
    `catalogue/figures/*.yaml`) is the only measure of Feynman coverage that may be published.
