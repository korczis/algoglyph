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
  - Slide a window of w bytes in steps of w/8 and keep its histogram up to date byte by byte.
  - Keep the sum of c·log2 c with it, so the entropy log2 w − S/w costs no pass over the bins.
  - See why a window of w bytes shows at most log2 w bits per byte, and where code, text, tables and padding sit.
bounds:
  model: histogram updates
  worst: 'at most 2n for n bytes, whatever the window: each byte enters the window once and leaves it at most once'
---

Shannon entropy in a sliding window over a file's bytes: code, text, tables and compressed data separate.

The bytes row colours every byte by its value; the entropy row fills in, one cell per window, as a window of w bytes slides along in steps of w/8. The histogram of the window is updated byte by byte, one count down for the byte leaving and one up for the byte entering, and with it the sum of c·log2 c, so the entropy log2 w − S/w costs no pass over the bins.

A window of w bytes can show at most log2 w bits per byte (7 for the default 128, 8 only from 256), so random or compressed sections approach that ceiling, text and code sit in between, and padding reads near zero. The readouts average the entropy over the windows inside each section of the synthetic file.
