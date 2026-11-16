---
schema: adr/v1
id: adr-0011
kind: adr
title: "A typed reactive DAG over the collection's kernels: units in the type, intents for interaction, a custom editor"
status: proposed
date: 2026-11-15
tags:
  - flow
  - architecture
  - interaction
  - types
provenance:
  origin: authored
---

# 11. A typed reactive DAG over the collection's kernels

## Context

The owner asked, in session 823ff4b3-9e36-4df2-8d64-581f79040afd on 2026-11-15, for the
collection to become a typed, composable computing environment — "implement this, deploy and
close this session" over a brief that asks whether providers, typed schemas, node contracts, one
runtime and a bidirectional interaction protocol suffice, and that forbids a second
implementation of any algorithm. The full analysis, evidence and roadmap are
`docs/rfc/0001-typed-reactive-dag.md`.

The collection's computations are already pure in places (the array engine's `trace()`, the
signal kernels' FFT, the numeric linear algebra), but most engines return drawings, and plates
keep their state inside their closures behind mouse hooks.

## Decision

1. **A flow is a validated document, never a drawing.** `src/flow/graph.ts` defines
   `algoglyph.graph/v1` (nodes, edges, seed) and the one validator `check()`: unknown types and
   ports, a second edge into an input, a unit that does not unify and every cycle are refused
   with a sentence. `canConnect()`, the importer (`parseGraph`), the link decoder, the store and
   the runtime all call it. Order is Kahn's, ties broken by node id.
2. **Units are part of the type.** A port is a series (values in a unit, along an axis in a
   unit), points (x and y units), a table or readouts (`src/flow/types.ts`). Units compare as
   exact strings with `$` variables bound per node; nothing is coerced, and a conversion is an
   explicit node (min–max normalize is the first).
3. **Interaction is an intent, never an edge.** A view sends a typed intent to the node that
   owns the state (`PointsValue.owner`); `src/flow/store.ts` validates it, commits a new
   revision with its origin and transaction, and keeps undo/redo. The computation stays acyclic.
4. **The runtime is finite, headless and incremental.** `src/flow/runtime.ts` fingerprints each
   node by type, parameters, state, attached-text digest, seed when seeded, and its inputs'
   fingerprints; a newer run aborts an older one and its result is dropped. Simulation and
   stream execution are separate modes, not built.
5. **Nodes adapt existing code.** Sort runs any live array kernel through `trace()`, the
   spectrum runs `_fft.ts`, the fit runs `_linalg.ts`, the table provider runs
   `src/core/data.ts`. The sort menu is derived from the catalogue.
6. **The editor is custom DOM and SVG** (`src/flow/studio.ts`): Flowbite cards over one cable
   layer, ports as buttons, a per-input menu listing what `canConnect` accepts, lazy ECharts
   previews through `src/core/charts.ts`. Route `#/flow`, lazy-loaded.
7. **Kernels are derived, never listed.** `src/flow/derive.ts` connects the catalogue to the
   flow generically: one adapter per engine (array in `nodes.ts`; grid, graph, tree, string and hash in
   `src/flow/adapters.ts`) turns every live entry of its engine into a choice of one family node,
   run by that engine's headless runner and reporting that engine's measurement. Every live
   entry is computed into one level — declared, derived or inferred — and an inferred entry
   carries its reason (and a proposed node where the source tree shows a headless runner) and is
   never runnable. Adding an adapter promotes an engine's entries; no kernel id is typed in code.
8. **A reader's table stays in the tab.** It never enters the document or a link; the link
   carries the approved schema. Rule `project.user-data-stays-local` applies unchanged.

## Alternatives rejected

- **A node definition per kernel, or flow ports declared in each entry's frontmatter** — the
  ports are the engine's, not the entry's: every kernel of an engine shares them, so declaring
  them per entry would repeat one fact hundreds of times and drift; the catalogue keeps what is
  per entry (title, taxonomy, status), the adapter what is per engine.

- **Rete.js v2 with its Lit renderer** — typed sockets would be a second compatibility table
  beside `unify`, keyboard access is undocumented, and the core's last release was 2025-06;
  kept as the fallback.
- **React Flow / Svelte Flow** — the best accessibility documentation, but a second UI framework
  in a site that is Alpine and Flowbite; kept as the runner-up behind a measured trigger
  (RFC §E).
- **LiteGraph, Cytoscape** — canvas nodes cannot pass the axe gate; LiteGraph's fork is archived;
  Cytoscape has no ports and is excluded by owner policy.
- **Plate = node** — a plate is a presentation with hidden state; making it a node would either
  copy its state or expose its closure. A plate joins as a sink, or as a bidirectional node only
  after its state is lifted.
- **A schema library (Zod, TypeBox) or JSON Schema as the source** — none expresses unit
  variables and unification, and the catalogue already owns a schema dialect.

## Consequences

- New code lives under `src/flow/`; no plate, kernel or the stage changed. Two engines moved a
  constant into their headless module so plate and flow read one source (the tree engine's input
  sizes, the hash plate's defaults); their plates are unchanged.
- An entry that goes live under an adapted engine is in the flow with no edit; its kernel test
  proves its result, `test/flow-derive.test.ts` proves its node forwards the engine's numbers.
- `project.typed-flow` makes the invariants blocking; `test/flow-*.test.ts` and the browser
  gate's `flow` section are its proof.
- Engines that return drawings join only after their kernels are split into compute and draw
  (RFC §H step 2); until then their algorithms are not nodes.
- The editor's scale target is the document limit (`LIMITS` in `src/flow/graph.ts`); beyond it
  the runner-up decision is reopened.
