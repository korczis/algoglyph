---
schema: adr/v1
id: adr-0005
kind: adr
title: "Semantic catalogue v2: typed relations, evidence dimensions, knowledge graph, experiment capsules, Rust tooling"
status: proposed
date: 2026-11-11
tags:
  - catalogue
  - semantics
provenance:
  origin: authored
---

# 5. Semantic catalogue v2: typed relations, evidence dimensions, knowledge graph, experiment capsules, Rust tooling

## Context

The owner's master prompt "ALGOGLYPH: SEMANTIC EVOLUTION & SCIENTIFIC VISUAL ATLAS" (session
8b702ebf-3f15-4e77-880e-843436e75d2c, 2026-11-11T22:15Z, given with `/loop` and `/evolve`)
asks for a semantically indexed atlas: a versioned, validated metadata contract; typed
relationships with derived inverses; a knowledge graph with machine-readable exports;
evidence dimensions (declared, implemented, tested, verified, enforced, deployed) that no
author can set by hand; maturity profiles; reproducible experiment capsules; textbook
sections that show only what the catalogue, the code or the evidence supports; negative
tests for every refusal. In the same session the owner added: "vse data driven, no bash, all
rust scripting, extensibility, plugins, for wasm and all derived, infered, dynamic, generic",
and "from now on always working automagically out of the box, always kept in sync, always
enforced, always each fuck up root cause diagnosed, analyzed, fixed, prevented, enforced".

ADR 0004 already made the catalogue the single source; its entries carry a small v1 front
matter with an untyped `related` list.

## Decision

1. **v2 is an extension of the one parser, not a second catalogue.** `scripts/lib/catalogue.mjs`
   accepts v1 entries unchanged and the v2 blocks below; every key is declared in data
   (`catalogue/schema/entry.yaml`), so an unknown key, a wrong type or a value outside its
   enumeration is refused with the file and the field path.
2. **Relationships are typed and declared once.** `catalogue/relations.yaml` defines each type:
   meaning, inverse (or none), symmetry, whether it must be acyclic. An entry declares
   `relations: [{type, target, reason}]`; inverses, backlinks and the graph are derived; a
   cycle in an acyclic type and a dangling target are refused. v1 `related` reads as
   `related_to`.
3. **Evidence is derived, never authored.** `implemented` comes from discovered code,
   `tested` from the engine harness or a plate test that names the entry, `verified` and
   `deployed` from CI and the deployed revision. There is no front-matter key for any of
   them; maturity profiles are computed from authored completeness plus that evidence. A live
   entry whose derived `tested` is empty is refused by `catalogue --check`: every experiment is
   standalone (the browser gate opens each one at its route) and tested.
4. **The knowledge graph is a build output** (`catalogue.json`, `graph.json` beside the site),
   deterministic, with the site's own pages as its first consumer.
5. **Experiment capsules** carry entry, seed and every non-default parameter in the route,
   parsed back against each control (the share-params lane, merged through review).
6. **Tooling moves to Rust, scripted in Rhai, entered through `just`.** New tooling is written as
   a Rust CLI (`crates/algoglyph-cli`) whose plugins are Rhai scripts the CLI runs; a recipe in
   the repository's `justfile` is the entry point for every task, never a Makefile or a bespoke
   shell wrapper. The shell scripts and the Node tooling are ported slice by slice, each port
   proven equivalent by running both on the same tree before the old one is removed. Until a
   port lands, the existing script stays the gate. The owner, in the same session
   (2026-11-11T22:30Z): "always prefer rhai over shell / always prefer just over make or custom
   shell tooling / always derive / infere / dry / reuse / componentize / compose / document for
   future".

## Alternatives rejected

- A second "v2 catalogue" beside the first: two sources of one collection.
- Free-form relation strings: tags with arrows, no meaning to validate or invert.
- `verified: true` in front matter: credibility by assertion.
- Porting every script to Rust in one change: a rewrite with nothing to compare against.

## Consequences

- Entries gain rich metadata only where an author has something true to say; planned entries
  stay small and declare no runtime facts.
- The schema file, the relation types and the gate are data; adding a field or a relation type
  is a data change with its validation following automatically.
- Each Rust port carries an equivalence test against the script it replaces.
