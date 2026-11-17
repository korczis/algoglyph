---
id: amplitude-arrows
title: Amplitude Arrows in a Glass Plate
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - partial reflection
  - thin-film interference
  - Airy formula
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 1 (probability amplitudes add as complex numbers, and the probability is the square of the sum)'
    purpose: further-reading
  - id: born-wolf-optics
    ref: '§7.6.1 (multiple-beam interference in a plane-parallel plate: the Airy formulae)'
    purpose: proof
tags:
  - amplitudes
  - interference
  - thin film
  - reflection
complexity: O(arrows) per setting, about 14 at n = 1.5; O(arrows × 241) for the thickness sweep
interaction: The sliders set the glass's thickness and index, the light's wavelength and how many arrows are drawn.
motivation: How much light a sheet of glass reflects comes out of nothing but adding arrows tip to tail and squaring the length of the sum, and the sum is the textbook formula exactly.
relations:
  - type: related_to
    target: two-slit-amplitudes
    reason: The same rule, one arrow for each way the event can happen, added before squaring; there two slits give two arrows, here a plate gives an endless chain of shrinking ones.
  - type: related_to
    target: fourier-epicycles
    reason: Both add complex numbers tip to tail; there a chain of turning circles traces a curve, here a chain of arrows, each turned by the same round trip and shortened by the same r², sums to one amplitude.
pedagogy:
  difficulty: introductory
  objectives:
  - Draw one arrow for each way light can come back from a plate, off the front face, or in, off the back face and out, and again after more bounces inside.
  - Add the arrows tip to tail and read the probability as the square of the sum's length.
  - See the reflection vanish when the plate is a whole number of half wavelengths thick, and peak at the odd quarter waves.
  misconceptions:
  - The front and back faces do not each reflect a fixed share that adds up; their arrows add, so a thicker plate can reflect less than a thinner one.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: arrows summed, one per path
  worst: 'until an arrow falls below 1e−18: 1 + ⌈ln(1e−18/((1 − r²)r))/ln r²⌉, 14 at n = 1.5, 25 at n = 2.5'
experiments:
  - id: quarter-wave
    title: A quarter wave thick
    params: { d: 100 }
    observe: 'At 100 nm and 600 nm light the round trip turns each later arrow half a turn, so every arrow lines up with the first: the most a plate of n = 1.5 can reflect, 14.8 %.'
  - id: half-wave
    title: A half wave thick
    params: { d: 200 }
    observe: The round trip is a whole turn; the back arrows sum to exactly the front arrow's length, pointing the other way, and nothing is reflected.
  - id: diamond
    title: A diamond film
    params: { n: 2.4, lambda: 576, d: 60 }
    observe: At n = 2.4 a single face reflects 17 %, and a quarter-wave film 49.6 %; the first two arrows alone would say 56.8 %, the later bounces taking back the excess.
  - id: water
    title: A soap film
    params: { n: 1.33, lambda: 532, d: 100 }
    observe: Water's faces reflect 2 % each; a quarter-wave film of it at green light reflects 7.7 %, which is why a soap film shows colours where it is a few hundred nanometres thick.
  - id: two-arrows
    title: Two arrows are almost the answer
    params: { shown: 2 }
    observe: The front arrow and the first back arrow are 0.2 and 0.192 long at n = 1.5; the later ones are 25 times shorter each, and the sum drawn barely moves when they are added.
claims:
  - id: arrows-are-the-airy-formula
    statement: >-
      The arrows −r, then (1 − r²)·r^(2k+1)·e^(i(k+1)δ), sum to −r + (1 − r²)r·e^(iδ)/(1 − r²e^(iδ)),
      whose squared length is the Airy reflectance F sin²(δ/2)/(1 + F sin²(δ/2)), F = 4r²/(1 − r²)².
      The plate computes the two separately; each of the 14 arrows adds a few roundings of
      u = 1.1e−16 on a sum no longer than 0.4, so they agree within 3e−15.
    readout: arrows against Airy
    expect: { below: 3.0e-15 }
  - id: reflected-and-transmitted-add-to-one
    statement: >-
      The transmitted arrows, (1 − r²)·r^(2k)·e^(i(k+½)δ), are summed on their own; the reflected and
      the transmitted probabilities add to 1 within 3e−15, though nothing in either sum knows the
      other.
    readout: reflected + transmitted − 1
    expect: { below: 3.0e-15 }
  - id: quarter-wave-reflects-most
    statement: >-
      At a quarter wave (δ = π) every arrow lines up and the sum is −2r/(1 + r²): at n = 1.5,
      r = 0.2, the probability is 4r²/(1 + r²)² = 0.147929, within half the readout's last digit.
    readout: reflected, every arrow summed
    expect: { value: 0.147929, tolerance: 0.000001 }
    setup:
      params: { d: 100 }
  - id: quarter-wave-two-arrows
    statement: >-
      The first two arrows alone, r and (1 − r²)r in line, give r²(2 − r²)² = 0.153664: more than all
      of them, since the later arrows each point back.
    readout: reflected, the first two arrows
    expect: { value: 0.153664, tolerance: 0.000001 }
    setup:
      params: { d: 100 }
  - id: half-wave-reflects-nothing
    statement: >-
      At a half wave (δ = 2π) the back arrows sum to (1 − r²)r/(1 − r²) = r against the front's −r:
      nothing is reflected, 0 within the readout's last digit.
    readout: reflected, every arrow summed
    expect: { value: 0, tolerance: 0.000001 }
    setup:
      params: { d: 200 }
  - id: diamond-quarter-wave
    statement: >-
      A diamond film, n = 2.4 so r = 7/17, a quarter wave thick at 576 nm (60 nm): 4r²/(1 + r²)² =
      0.495816.
    readout: reflected, every arrow summed
    expect: { value: 0.495816, tolerance: 0.000001 }
    setup:
      params: { n: 2.4, lambda: 576, d: 60 }
  - id: water-quarter-wave
    statement: >-
      A water film, n = 1.33, a quarter wave thick at 532 nm (100 nm): r = 0.33/2.33 and
      4r²/(1 + r²)² = 0.077113.
    readout: reflected, every arrow summed
    expect: { value: 0.077113, tolerance: 0.000001 }
    setup:
      params: { n: 1.33, lambda: 532, d: 100 }
---

How much light a glass plate reflects, found by adding one arrow for every way the light can come back and squaring the length of the sum.

Light can come back from a plate in many ways: off the front face, or into the glass, off the back face and out, or after bouncing back and forth inside any number of times. Each way is an arrow, an amplitude. Off the front face its length is r = (n − 1)/(n + 1), turned half a turn because the light reflects from the denser side. Every way through the back face is shorter by the 1 − r² that the two crossings of the front face cost, and by r² more for each extra bounce, and turned by the round trip through the glass, 4πnd/λ, once more each time. Adding the arrows tip to tail gives one arrow, and the probability of reflection is its length squared.

The rule makes the plate's behaviour plain. A plate a half wave thick turns each back arrow a whole turn, they line up against the front arrow, and nothing is reflected; a quarter wave turns them half a turn, they line up with it, and the reflection is the most the glass can give. The arrows are drawn tip to tail with their sum, the chart sweeps the thickness from 0 to 1000 nm, and the readouts compare the arrows' sum with the Airy formula, the closed form of multiple-beam interference, computed without them.

**A still.** Nothing in the picture moves: light is not followed in time, only its ways of coming back are added, so the diagram is redrawn when a control changes and every readout is computed from the controls alone. The state travels in the URL.

**Data.** The plate takes no data of a reader's: its inputs are three sliders, and a measured reflection spectrum is not among the kinds ADR 0010 can read.
