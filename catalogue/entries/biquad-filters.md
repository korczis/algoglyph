---
id: biquad-filters
title: Biquad filters, poles and zeros
taxonomy: signals/filters
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - filters
  - poles
  - zeros
  - frequency response
complexity: 'O(1) per sample: five multiplies'
motivation: Acoustic measurement and synthesis use it every day.
schema: algoglyph.entry/v2
relations:
  - type: related_to
    target: bound-electron-medium
    reason: Each bound electron there is a driven, damped oscillator whose susceptibility is a second-order resonance with its own ω₀ and Q, the analogue band-pass prototype; the bilinear transform turns that prototype into this section's five coefficients.
  - type: uses
    target: fft-butterfly
    reason: The response is measured by transforming the filtered unit impulse with the radix-2 FFT, 16384 samples by default, and compared bin by bin with H evaluated on the unit circle.
experiments:
  - id: resonant-low-pass
    title: A resonant low-pass
    params: { q: 5 }
    observe: At Q = 5 the low-pass rises 14 dB just below its corner; at the corner itself the gain is Q, 13.98 dB, and the poles sit close to the unit circle at the corner's angle.
  - id: narrow-band
    title: A narrow band
    params: { type: bandpass, q: 20 }
    observe: The −3 dB points close in to 1000 ± 25 Hz, Ω₂ − Ω₁ = 1/Q after the warp, and the impulse response rings for hundreds of samples.
  - id: mains-hum-notch
    title: A notch for mains hum
    params: { type: notch, f0: 50, q: 5 }
    observe: The zeros sit on the unit circle at 50 Hz and the gain there falls to the floor of the readout, while the poles just inside keep the notch 10 Hz wide.
  - id: cut-short
    title: A resonance cut short
    params: { type: bandpass, f0: 50, q: 20, irLen: '4096' }
    observe: At 50 Hz and Q = 20 the poles are so close to the circle that 4096 samples of the impulse response end long before the ringing dies; the gain measured at f0 falls about 1.3 dB short of the prototype's 0 dB, the −3 dB points move off the prototype's, and the measured response strays from H by several decibels.
pedagogy:
  difficulty: intermediate
  objectives:
  - Read the difference equation's transfer function H(z) as a ratio of quadratics with zeros and poles.
  - See poles near the unit circle make a resonance and zeros on it make a notch.
  - Measure the response by filtering a unit impulse and check it against H evaluated on the unit circle.
bounds:
  model: real multiplies of the difference equation
  best: 5 per sample
  worst: 5 per sample
claims:
  - id: measured-response-is-the-evaluated-one
    statement: >-
      The response measured from the impulse response is H evaluated on the unit circle: the
      default low-pass's poles decay long before the 16384 samples end, so the two agree to
      rounding, within 10⁻⁶ dB.
    readout: Measured against evaluated, worst
    expect: { below: 1.0e-6 }
  - id: truncation-bound-at-1024-samples
    statement: >-
      Cut to 1024 samples, the response leaves out the tail Σ_{n≥N} |h[n]|, and |h[n]| ≤ (|K1| +
      |K2|)·r^n from the residues K_i = B(p_i)/(p_i(p_i − p_j)) of the poles p_i: the tail is at
      most (|K1| + |K2|)·r^N/(1 − r). For the peaking boost at 200 Hz, Q 10, +9 dB, that is
      0.0085020·0.997666^1024/0.002334 = 0.3328, and its |H| never falls below 1, so no bin is off
      by more than −20·log10(1 − 0.3328) = 3.515 dB.
    readout: Measured against evaluated, worst
    expect: { below: 3.515 }
    setup:
      params: { type: peaking, f0: 200, q: 10, gain: 9, irLen: '1024' }
  - id: truncation-bound-at-4096-samples
    statement: >-
      At 4096 samples the same bound is 0.0085020·0.997666^4096/0.002334 = 2.539·10⁻⁴ of a
      magnitude never below 1, so no bin is off by more than −20·log10(1 − 2.539·10⁻⁴) = 2.205·10⁻³
      dB.
    readout: Measured against evaluated, worst
    expect: { below: 2.205e-3 }
    setup:
      params: { type: peaking, f0: 200, q: 10, gain: 9, irLen: '4096' }
  - id: low-pass-gain-at-the-corner-is-q
    statement: >-
      The analogue low-pass 1/(s² + s/Q + 1) has |H(j)| = Q at its corner, and the design prewarps
      the bilinear transform so that the corner lands on f0 exactly. So the gain measured at 1000 Hz
      from the impulse response is 20·log10 0.7 = −3.098039 dB, within half the readout's last digit
      and the rounding of a 16384-term sum.
    readout: Gain at f0 (measured from h)
    expect: { value: -3.098039, tolerance: 0.000002 }
  - id: low-pass-half-power-point
    statement: >-
      Its half-power point solves (1 − Ω²)² + Ω²/Q² = 2, Ω = 0.989849 at Q = 0.7, and the warp
      f = (fs/π)·atan(Ω·tan(πf0/fs)) puts it at 990.104 Hz: the crossing measured between bins is
      within 0.06 Hz of it, the readout's half digit and 0.01 Hz of interpolation.
    readout: −3 dB points (measured)
    expect: { value: 990.104, tolerance: 0.06 }
  - id: high-pass-gain-at-the-corner-is-q
    statement: >-
      The high-pass s²/(s² + s/Q + 1) has |H(j)| = Q too: at Q = 2 the gain measured at f0 is
      20·log10 2 = 6.020600 dB.
    readout: Gain at f0 (measured from h)
    expect: { value: 6.0206, tolerance: 0.000002 }
    setup:
      params: { type: highpass, q: 2 }
  - id: high-pass-half-power-point
    statement: >-
      Its half-power point is the low-pass's mirrored, Ω → 1/Ω = 0.673623 at Q = 2, warped to
      678.375 Hz, within 0.06 Hz.
    readout: −3 dB points (measured)
    expect: { value: 678.375, tolerance: 0.06 }
    setup:
      params: { type: highpass, q: 2 }
  - id: band-pass-peak-is-unity
    statement: >-
      The constant-peak band-pass (s/Q)/(s² + s/Q + 1) is exactly 1 at Ω = 1, whatever Q: at Q = 2 the
      gain measured at f0 is 0 dB, within 2e−6.
    readout: Gain at f0 (measured from h)
    expect: { value: 0, tolerance: 0.000002 }
    setup:
      params: { type: bandpass, q: 2 }
  - id: band-pass-lower-half-power-point
    statement: >-
      Its half-power points satisfy Ω₂ − Ω₁ = 1/Q and Ω₁Ω₂ = 1: Ω₁ = 0.780776 at Q = 2, warped to
      784.698 Hz, within 0.06 Hz.
    readout: −3 dB points (measured)
    expect: { value: 784.698, tolerance: 0.06 }
    setup:
      params: { type: bandpass, q: 2 }
  - id: band-pass-upper-half-power-point
    statement: >-
      And Ω₂ = Ω₁ + 1/Q = 1.280776, warped to 1270.468 Hz: the warp stretches the band above f0 more
      than below, so the two are not symmetric about 1000 Hz.
    readout: −3 dB points (measured)
    expect: { number: 2, value: 1270.468, tolerance: 0.06 }
    setup:
      params: { type: bandpass, q: 2 }
  - id: peaking-gain-at-the-centre
    statement: >-
      The peaking prototype (s² + sA/Q + 1)/(s² + s/(AQ) + 1) with A = 10^(gain/40) is A² at Ω = 1:
      the +9 dB boost measures 9.000000 dB at f0.
    readout: Gain at f0 (measured from h)
    expect: { value: 9, tolerance: 0.000002 }
    setup:
      params: { type: peaking }
  - id: notch-is-a-zero-on-the-circle
    statement: >-
      The notch (s² + 1)/(s² + s/Q + 1) is 0 at Ω = 1, its zeros on the unit circle at f0: the gain
      measured there is below −100 dB (the readout's floor is −180).
    readout: Gain at f0 (measured from h)
    expect: { below: -100 }
    setup:
      params: { type: notch }
---

Moving poles and zeros on the z-plane and watching the frequency response follow.

A biquad is the difference equation y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2] − a1·y[n−1] − a2·y[n−2]; its transfer function H(z) is a ratio of quadratics, whose roots are the zeros and poles on the z-plane. The coefficients here come from the bilinear transform of the analogue low-pass, high-pass, band-pass, notch and peaking prototypes.

Poles close to the unit circle make a resonance at their angle, zeros on it make a notch; a pole outside it would make the filter unstable. The response is measured by filtering a unit impulse and transforming the result, and checked against H evaluated on the unit circle. A low-pass section's gain at its corner is Q itself, so with Q = 1/√2 ≈ 0.707 it is a Butterworth section, −3 dB exactly at the corner; the Q control moves in steps of 0.1, and its nearest setting, 0.7, reads about −3.1 dB there.

**The analogue prototype as the oracle.** The coefficients are not their own check. Each section is the bilinear transform of an analogue prototype, prewarped so that its centre lands on f0, and the prototype says in closed form what the digital filter must do there: the low- and high-pass have gain Q at the corner, the band-pass exactly 1, the notch 0, the peaking EQ the gain asked for. Their half-power points come from the prototype's |H(jΩ)|² = ½, mapped to frequency by the warp f = (fs/π)·atan(Ω·tan(πf0/fs)). The plate measures the gain at f0 from the impulse response, as a sum over every sample rather than at the nearest bin, and shows the prototype's value beside it; the half-power points measured between bins are shown beside the prototype's.

**Data.** The plate takes no data of a reader's: it runs on the signal engine, which has no data input yet; filtering a reader's own recording waits on the engine's upload slice (U0, then U-signal).

