---
schema: adr/v1
id: adr-0004
kind: adr
title: Catalogue in frontmatter, multi-level taxonomy, engines, kernels and labs
status: proposed
date: 2026-11-11
tags:
  - catalogue
  - architecture
provenance:
  origin: authored
---

# 4. Catalogue in frontmatter, multi-level taxonomy, engines, kernels and labs

## Context

The collection had 19 plates, each a hand-written module listed by hand in
`src/plates/index.ts`, classified by one of three categories, with its prose in TypeScript.
The gallery rendered every thumbnail at runtime, one after another; on the shared SwiftShader
runner that pass alone outgrew its 300 s budget (runs 43087611444, 43092909731).

The owner asked (2026-11-11) for the 101 algorithms derived from their own work, every
algorithm of Robert Sedgewick's *Algorithms in C* as its own plate, a lab that simulates and
compares algorithms, a multi-level classification, three.js where it is needed and WebAssembly
for heavy work, and everything inferred, derived, dynamic, generic, data-driven,
frontmatter-friendly, automatic and tooled, from a single source; mobile first; working on
GitHub Pages; enforced through the Majordomus layer. A further 101 will follow. Hand-maintained
lists and one bespoke module per plate do not reach a collection of several hundred.

Owner answers, recorded verbatim (AskUserQuestion, session
8b702ebf-3f15-4e77-880e-843436e75d2c, 2026-11-11T21:10Z):

- Q: "Scope of this round: the new architecture (multi-level taxonomy, frontmatter catalogue
  of all 120 algorithms, auto-discovered registry, lazy thumbnails, mobile-first UI, catalogue
  tooling and the .ai rule) plus how many new plates?"
  A: "Architecture + all 101"
- Q: "Should planned (not yet implemented) catalogue entries appear on the public site?"
  A: "Yes, as 'planned' cards (Recommended)"

The Sedgewick, three.js/WebAssembly and single-source requests arrived in the same session
after these answers and extend the scope.

Later owner answers in the same session (AskUserQuestion, 2026-11-11T21:59Z):

- Q: "The Majordomus pre-push hook refused pushing feature/catalogue-labs to main: the task's
  declared scope omits crates/algoglyph-kernels/* and docs/ARCHITECTURE.md, which I added later.
  How should I proceed?"
  A: "Close partial, restart task (Recommended)"
- Q: "After the deploy, should I launch the engine waves for the 212 planned entries now,
  roughly 11 parallel agents in their own worktrees (graph, string, tree, numeric, geometry,
  stochastic, signal, systems, grid, hash, bespoke plates)?"
  A: "Yes, all 11 at once"

## Decision

1. **The catalogue is the only description of the collection.** `catalogue/entries/<id>.md`,
   one file per algorithm, YAML front matter plus a Markdown body (summary, then reading
   notes). It carries everything a person reads: title, taxonomy path, status (`live` or
   `planned`), engine, labs, sources, tags, complexity. Code carries only behaviour.
2. **The taxonomy is a tree of any depth** (`catalogue/taxonomy.yaml`). An entry names one
   leaf path; wings, shelves, counts, navigation, breadcrumbs and numbering are derived.
3. **The registry is discovered**, never listed: a bespoke plate is `src/plates/<dir>/plate.ts`,
   an engine-driven plate is a kernel under `src/kernels/<engine>/<id>.ts`. An entry marked
   `live` must resolve to exactly one of them and each of them to exactly one entry.
4. **Engines and kernels.** An engine owns a family's input, drawing and measurement (array,
   tree, hash, graph, geometry, string, numeric, signal, systems, stochastic). A kernel is a
   pure function from a seeded input to an instrumented operation trace; the plate replays the
   trace, the readouts are counted from it, and unit tests check the kernel's result against an
   independent reference.
5. **Labs** run several kernels of one engine on the same seeded input side by side, with
   their measured metrics and a measured scaling curve; a lab is declared by the entries that
   name it.
6. **WebAssembly for heavy kernels, three.js for 3D engines.** A kernel is written once, in
   TypeScript or in Rust (`wasm/`, compiled to `wasm32-unknown-unknown` in the build, never
   committed as a binary); both produce the same trace contract, so a lab can compare them.
   Bevy is not used: shipping a game engine's runtime to a phone costs more than any plate
   gains. 2D plates stay on p5.
7. **Thumbnails render lazily**, for cards that come into view; the browser gate proves each
   plate renders and its thumbnail is produced in the plate pass, not as one long gallery wait.
8. **Sources are cited, not copied.** From *Algorithms in C* only the list of algorithms and
   the book's part are taken; code and prose are this repository's own. Entries derived from
   the owner's work state a generic motivation and never name a private repository, path or
   organisation, because this tree is public.
9. **Enforcement.** `scripts/catalogue.mjs --check` (schema, references, live↔code, derived
   files current) runs in `npm run verify` and CI, under the project rule
   `project.catalogue-integrity`.

## Alternatives rejected

- Keeping prose in TypeScript next to a catalogue for classification only: two sources for one
  plate, and drift on the first edit.
- One bespoke module per algorithm: several hundred near-identical renderers.
- Bevy for rendering: a large WebAssembly runtime on every phone, for drawing p5 and three.js
  already do.
- Committed `.wasm` binaries: a second source beside the Rust they are built from.
- Hiding planned entries from the site: the owner chose to show them.
- Pre-rendered thumbnail images in the bundle: they go stale with every plate change and
  cannot follow the theme.

## Consequences

- Plate numbers follow taxonomy order and change when the taxonomy changes; links use ids.
- Every new algorithm is a catalogue file plus, for a supported engine, one kernel and its
  test; `npm run catalogue -- new <id>` scaffolds both.
- The build needs the `wasm32-unknown-unknown` Rust target wherever it runs, CI included.
- The plan (`.ai/repo/project`) is generated from the catalogue: one milestone per wing, one
  issue per engine within it, so parallel waves never share a registry file.
