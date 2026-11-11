---
schema: feature/v1
id: plates
kind: feature
title: Every algorithm and physical system is a plate on one shared stage
short_title: Plates
headline: Open a plate and watch an algorithm or a physical system run live, in 2D or 3D, with its parameters as controls.
summary: Each visualisation is a Plate under src/plates/ registered in src/plates/index.ts and drawn only through the PlateContext of the shared p5 stage; the registry is the only list of plates.
status: stable
weight: 10
featured: true
domain: gallery
rules: [project.viz-component-layer]
docs: [README.md]
adrs: [adr-0001]
related: [measured-readouts, reproducible-pictures]
tags: [plates, p5, registry]
---

## What it does

A plate owns its simulation and its drawing; the stage in `src/core/stage.ts` owns the
canvas, the pixel density and the background, so every plate looks and behaves the same way
in the gallery, full screen and in a thumbnail. The registry's order is the numbering, and
the counts and the catalogue in the README are generated from it.

## What it does not do

No plate creates its own p5 instance or canvas, and nothing is loaded from a CDN: the site
is static and the stage is the only place p5 is constructed.
