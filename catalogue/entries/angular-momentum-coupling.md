---
id: angular-momentum-coupling
title: Coupling Angular Momenta
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - Clebsch–Gordan coefficients
  - addition of angular momentum
  - Breit–Rabi formula
  - hyperfine structure
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 12 (the hyperfine splitting in hydrogen, in a magnetic field) and ch. 18 (angular momentum: composition of spins)'
    purpose: further-reading
  - id: condon-shortley-1935
    ref: 'The phase convention of the coupled states'
    purpose: implementation
  - id: racah-1942
    ref: 'The closed formula for the vector-coupling coefficients'
    purpose: implementation
  - id: breit-rabi-1931
    purpose: implementation
  - id: griffiths-qm
    ref: 'Section 4.4: addition of angular momenta'
    purpose: further-reading
tags:
  - angular momentum
  - Clebsch–Gordan coefficients
  - total spin
  - hyperfine structure
  - Zeeman effect
  - Paschen–Back effect
  - diagonalisation
complexity: O(blocks × d³) for the eigenproblems, d ≤ 3 for the coupling of j₁ ≤ 3/2 with j₂ ≤ 1
interaction: Choose the experiment and the two angular momenta, or the nuclear spin and how strong the field grows.
motivation: Two spins put together make every total J from |j₁ − j₂| to j₁ + j₂, and the coefficients that say how are fixed by one matrix, J²; the same diagonalisation, with a field added, gives the hyperfine levels of an atom from the 21 cm line of hydrogen to the clocks of caesium.
relations:
  - type: uses
    target: pca-svd
    reason: Every eigenproblem here is solved by that plate's one-sided Jacobi SVD, applied to the matrix shifted to be positive definite, whose singular vectors are its eigenvectors.
  - type: related_to
    target: bound-states
    reason: That plate finds hydrogen's levels −1/2n²; the hyperfine coupling of the electron and proton spins splits the lowest of them into the two levels of the 21 cm line.
pedagogy:
  difficulty: advanced
  prerequisites: [spin-precession]
  objectives:
    - Build J² of two angular momenta in the product basis and find, by diagonalising it, which total J occur and how many states each has.
    - Fix the signs of the coupled states by the Condon–Shortley convention, and compare the coefficients with Racah's closed formula.
    - Check that the product and coupled bases have the same number of states, (2j₁ + 1)(2j₂ + 1) = Σ(2J + 1).
    - Follow the hyperfine levels of an atom from zero field, where F is good, to a strong field, where the electron's own m_S is, and hold them to the Breit–Rabi formula.
  misconceptions:
    - Two spins ½ do not simply give a spin 1; they give a triplet and a singlet, four states in all, as many as the product basis.
    - The coefficients are not arbitrary up to a phase in practice; the Condon–Shortley convention fixes every sign, and tables agree because they follow it.
    - A stronger field does not split the hyperfine levels further in the same way for ever; past x ≈ 1 the levels regroup by the electron's spin and run in parallel.
  questions:
    - How many states has 3/2 ⊗ 1, and into which J do they fall?
    - Why are the stretched states |j₁ j₁⟩|j₂ j₂⟩ coupled states already, with a coefficient of exactly 1?
    - In the Breit–Rabi diagram for I = 3/2, which levels cross, and why may they?
    - Why does the zero-field splitting equal A(I + ½)?
algorithm:
  paradigm: transform
  properties:
    deterministic: true
  preconditions:
    - j₁ is ½, 1 or 3/2 and j₂ is ½ or 1; the hyperfine experiment couples a nucleus I = j₁ to an electron S = ½.
  invariants:
    - J² and the hyperfine Hamiltonian keep M = m₁ + m₂, so each is diagonalised block by block.
    - The coupled states are orthonormal to round-off.
  limitations:
    - The nuclear magnetic moment is neglected in the field term; only the electron's b S_z is kept, so the Breit–Rabi formula is its g_I = 0 form.
    - Energies are in units of the hyperfine constant A, and the field as x = b/A(I + ½).
experiments:
  - id: one-and-a-half
    title: 1 ⊗ ½
    params: { experiment: cg, j1: '1', j2: '0.5' }
    observe: Six product states make a quartet J = 3/2 and a doublet J = ½; |½ ½⟩ is √(2/3)|1, −½⟩ − √(1/3)|0, ½⟩.
  - id: two-spins-half
    title: Two spins ½
    params: { experiment: cg, j1: '0.5', j2: '0.5' }
    observe: The triplet and the singlet; the M = 0 states are the sum and the difference of |↑↓⟩ and |↓↑⟩ over √2.
  - id: three-halves-and-one
    title: 3/2 ⊗ 1
    params: { experiment: cg, j1: '1.5', j2: '1' }
    observe: Twelve states fall into J = 5/2, 3/2 and ½, six, four and two of them.
  - id: hydrogen-hyperfine
    title: Hydrogen's ground state in a field
    params: { experiment: zeeman, j1: '0.5' }
    observe: Four levels; at zero field the triplet F = 1 lies A above the singlet, and in a strong field they regroup in two pairs.
  - id: rubidium-like
    title: A nuclear spin of 3/2
    params: { experiment: zeeman, j1: '1.5' }
    observe: Eight levels, split by 2A at zero field, F = 2 above F = 1; the two stretched levels run as straight lines.
  - id: paschen-back
    title: Into the strong field
    params: { experiment: zeeman, j1: '1.5', field: 4 }
    observe: Past x ≈ 1 the levels sort into two groups of four, by the electron's m_S = ±½, each split evenly by A m_I/2.
claims:
  - id: cg-two-ways
    statement: >-
      For 1 ⊗ ½ the coefficients from diagonalising J² with Condon–Shortley signs agree with Racah's formula
      within 1e−12.
    readout: largest |CG by diagonalising J² − CG by Racah’s formula|
    expect: { below: 0.000000000001 }
  - id: cg-two-ways-three-halves
    statement: >-
      For 3/2 ⊗ 1, twelve states in three multiplets, they agree within 1e−12 again.
    readout: largest |CG by diagonalising J² − CG by Racah’s formula|
    expect: { below: 0.000000000001 }
    setup:
      params: { j1: '1.5', j2: '1' }
  - id: coupled-orthonormal
    statement: >-
      (numerics) The coupled states found are orthonormal within 1e−13.
    readout: largest |CCᵀ − 1| of the coupled basis, numerics
    expect: { below: 0.0000000000001 }
    setup:
      params: { j1: '1.5', j2: '1' }
  - id: states-counted
    statement: >-
      The coupled multiplets hold exactly as many states as the product basis, (2j₁ + 1)(2j₂ + 1) = Σ(2J + 1).
    readout: states in the product basis, and in the coupled basis
    expect: { number: 2, against: 'states in the product basis, and in the coupled basis', against_number: 1, tolerance: 0.5 }
    setup:
      params: { j1: '1.5', j2: '1' }
  - id: breit-rabi-hydrogen
    statement: >-
      For I = ½ the hyperfine levels diagonalised at 300 fields up to x = 2.5 match the Breit–Rabi formula
      within 1e−12 A.
    readout: largest |E by diagonalisation − Breit–Rabi| over the sweep (units of A)
    expect: { below: 0.000000000001 }
    setup:
      params: { experiment: zeeman, j1: '0.5' }
  - id: breit-rabi-three-halves
    statement: >-
      For I = 3/2 up to x = 4, into the Paschen–Back regime, they match within 1e−12 A.
    readout: largest |E by diagonalisation − Breit–Rabi| over the sweep (units of A)
    expect: { below: 0.000000000001 }
    setup:
      params: { experiment: zeeman, j1: '1.5', field: 4 }
  - id: zero-field-interval
    statement: >-
      At zero field the levels of I = 3/2 span A(I + ½) = 2A within 1e−12 A, the interval between F = 2 and F = 1.
    readout: zero-field splitting, measured (units of A)
    expect: { against: 'hyperfine interval A(I + ½)', tolerance: 0.000000000001 }
    setup:
      params: { experiment: zeeman, j1: '1.5' }
---

Two angular momenta coupled into states of definite total J, their Clebsch–Gordan coefficients computed by diagonalising J² and by Racah's formula; and the hyperfine levels of a nucleus and an electron in a growing field, diagonalised and held to the Breit–Rabi formula.

**Coupling by diagonalising.** In the product basis |j₁ m₁⟩|j₂ m₂⟩ the total J² is J₁² + J₂² + 2J₁zJ₂z + J₁₊J₂₋ + J₁₋J₂₊, every element real, from the ladder formula of #/p/spin-precession. It leaves M = m₁ + m₂ unchanged, so it splits into small blocks, one per M. Each block is diagonalised by the one-sided Jacobi SVD of #/p/pca-svd applied to the block shifted to be positive definite. The eigenvalues are J(J + 1), every J from |j₁ − j₂| to j₁ + j₂ appearing once in each block it can, and the eigenvectors are the coupled states. Their signs follow Condon and Shortley: in |J J⟩ the component with m₁ = j₁ is positive, and each lower |J M⟩ has a positive overlap with J₋|J M + 1⟩. Racah's closed sum over factorials gives the same coefficients independently, and the two agree to round-off.

**Counting states.** A change of basis cannot lose a state: (2j₁ + 1)(2j₂ + 1) product states become multiplets of 2J + 1 states each, and the plate counts both. The coefficient table drawn has the coupled states as rows and the product states as columns; it is an orthogonal matrix, and every row has non-zero entries only where m₁ + m₂ = M.

**Hyperfine levels in a field.** A nucleus of spin I and an electron of spin ½ interact as A I·S, and a field adds b S_z, the nucleus's own moment neglected. At zero field the levels are those of total F = I ± ½, split by A(I + ½); in a strong field the electron's m_S takes over and the levels run in two parallel groups. Between the two, each block of m = m_I + m_S is a 2 × 2 problem whose roots are the Breit–Rabi formula, −A/4 ± (A(I + ½)/2)√(1 + 4mx/(2I + 1) + x²) with x = b/A(I + ½), and the two stretched states are straight lines AI/2 ± b/2. The plate diagonalises each block at 300 fields and draws the levels over the formula's dashed curves; for I = ½ they are the four levels of hydrogen's ground state, whose zero-field interval is the 21 cm line.
