---
schema: adr/v1
id: adr-0001
kind: adr
title: Static Vite site, p5.js plates behind one stage, Alpine and Flowbite Pro shell
status: proposed
date: 2026-11-11
tags:
  - architecture
  - ui
provenance:
  origin: authored
---

# 1. Static Vite site, p5.js plates behind one stage, Alpine and Flowbite Pro shell

## Context

The owner asked (2026-11-11, verbatim): "zaloz novy majordomus.dev project pro visualizaci
ruznych sw veci jako algoritmy, chtel bych aby to vvypadalo jako beautiful data / beautifufl
viisualization, pouzivalo p5.js ci podobne, bylo to artove a geeky, pouzivalo alpine.js,
flowbite llm pro css ... bude to sbirka ruznych visualizaci a interaktivnich simulaci vcetne
3d (ruzne fyzikalni pokusy(, projed si ~/dev/ a veskere me navyky, at o splmnuje nejaky moje
sntandards".

So: a collection of algorithm visualisations and interactive simulations including 3D physics,
on p5.js, Alpine.js and Flowbite Pro, following the conventions of the owner's other
repositories (kompendium-epistemicke-anihilace is the closest: static site, Tailwind 4 +
Flowbite + Alpine, `npm run verify` mirroring CI, GitHub Pages with revision check).

## Decision

- A static site built by Vite 8 from TypeScript, no server. Hash routing (`#/p/<id>?seed=`)
  keeps it deployable under any Pages sub-path with `base: './'`.
- p5.js 2 in instance mode for every plate, 2D and WEBGL. One `Stage` (`src/core/stage.ts`)
  owns instances, sizing, pausing, export and thumbnails; plates implement the `Plate`
  contract (`src/core/plate.ts`) and are listed once in `src/plates/index.ts`
  (rule `project.viz-component-layer`).
- Alpine.js 3 for the page state (gallery filter, routing, parameters bound to controls,
  readouts). p5 instances are kept outside Alpine's reactive proxies.
- Flowbite Pro shell markup (fixed navbar, sidebar drawer, breadcrumb page header, cards) on
  Tailwind 4 with the open-source `flowbite` 4 plugin and JS; no Pro source file is shipped.
- npm with exact pins and `package-lock.json`, Node 22, as in the owner's other web repos.

## Alternatives rejected

- three.js for the 3D plates: better 3D tooling, but a second rendering stack and a second
  component layer; p5 WEBGL is enough for point clouds, line trails and a cloth mesh.
- A framework (React/Svelte): the page is one shell with two views; Alpine was asked for and
  is sufficient.
- Zola, as in kompendium: there is no content corpus to template, only plates.

## Consequences

- The bundle carries the whole p5 build (about 1.4 MB minified, 420 kB gzip). Importing only
  the p5 modules in use is the first optimisation if load time matters.
- Every plate must be pure enough to unit test its algorithm separately from drawing
  (rule `project.no-fake-science`).
- Thumbnails are rendered in the browser at first visit and cached in sessionStorage; there
  are no image files to keep current.
