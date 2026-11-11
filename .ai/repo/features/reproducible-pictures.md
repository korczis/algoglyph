---
schema: feature/v1
id: reproducible-pictures
kind: feature
title: The address names the exact picture
short_title: Reproducible pictures
headline: Reseed a plate and share the address; whoever opens it sees the same picture.
summary: Randomness is seeded (mulberry32 in src/core/random.ts) and the route carries the plate and its seed, so a picture is a function of the address and its parameters.
status: stable
weight: 30
domain: gallery
docs: [README.md]
adrs: [adr-0001]
related: [plates]
tags: [seed, routing, sharing]
---

## What it does

`#/p/<plate>?seed=<n>` opens a plate with that seed; `R` draws a fresh seed and writes it
into the address. Keyboard shortcuts cover play, step, reseed, defaults, PNG export, full
screen, navigation and theme.

## What it does not do

A seed reproduces the plate's initial state and its stepping; it does not record pointer
interaction, so a picture shaped by the pointer is reproduced only up to that input.
