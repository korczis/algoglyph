---
id: entropy-map
title: Entropy map of a binary
taxonomy: strings/cryptology
status: live
engine: string
sources:
  - id: pocorgtfo
tags:
  - entropy
  - binary analysis
  - sliding window
motivation: A staple of the reverse-engineering literature.
complexity: "O(n) histogram updates for n bytes, whatever the window"
related:
  - hash-avalanche
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Slide a window of w bytes in steps of w/8 (by default) and keep its histogram up to date byte by byte.
  - Keep the sum of c·log2 c with it, so the entropy log2 w − S/w costs no pass over the bins.
  - See why a window of w bytes shows at most log2 w bits per byte, and where code, text, tables and padding sit.
bounds:
  model: histogram updates
  worst: 'at most 2n for n bytes, whatever the window: each byte enters the window once and leaves it at most once'
claims:
  - id: random-at-most-seven-bits-in-128
    statement: >-
      A window of 128 bytes can show at most log2 128 = 7 bits per byte, so the mean entropy of
      the random section is at most 7.
    readout: Mean entropy, random
    expect: { range: [0, 7] }
  - id: random-at-most-eight-bits-in-256
    statement: >-
      A window of 256 bytes can show at most log2 256 = 8 bits per byte, so the mean entropy of
      the random section is at most 8.
    readout: Mean entropy, random
    expect: { range: [0, 8] }
    setup:
      params: { window: '256' }
  - id: updates-at-quarter-window-steps
    statement: >-
      The first window takes w increments and each later one s decrements and s increments, so
      ⌊(N − w)/s⌋ + 1 windows cost w + 2s(nWin − 1) updates. For the N = 4096 bytes of the
      default file, w = 128 and s = w/4 = 32: 125 windows and 128 + 64 · 124 = 8064 updates.
    readout: Histogram updates
    expect: { value: 8064 }
    setup:
      params: { stride: '4' }
  - id: windows-at-whole-window-steps
    statement: >-
      Windows that no longer overlap, s = w = 128: ⌊3968/128⌋ + 1 = 32 windows measured.
    readout: Windows measured
    expect: { value: 32 }
    setup:
      params: { stride: '1' }
  - id: updates-at-most-twice-the-bytes
    statement: >-
      Every byte enters a window at most once and leaves it at most once, so at most 2N updates;
      when s divides N − w it is 2N − w = 8064 exactly, at s = w as at w/8.
    readout: Histogram updates
    expect: { value: 8064 }
    setup:
      params: { stride: '1' }
  - id: random-at-most-seven-bits-at-half-window-steps
    statement: >-
      The ceiling log2 128 = 7 bits per byte holds for each window whatever the step, so the
      random section's mean entropy is at most 7 at s = w/2.
    readout: Mean entropy, random
    expect: { range: [0, 7] }
    setup:
      params: { stride: '2' }
---

Shannon entropy in a sliding window over a file's bytes: code, text, tables and compressed data separate.

The bytes row colours every byte by its value; the entropy row fills in, one cell per window, as a window of w bytes slides along in steps of w/8, or of w/4, w/2 or w with the step control. The histogram of the window is updated byte by byte, one count down for the byte leaving and one up for the byte entering, and with it the sum of c·log2 c, so the entropy log2 w − S/w costs no pass over the bins.

A window of w bytes can show at most log2 w bits per byte (7 for the default 128, 8 only from 256), so random or compressed sections approach that ceiling, text and code sit in between, and padding reads near zero. The readouts average the entropy over the windows inside each section of the synthetic file.
