---
id: project.catalogue-integrity
version: 1
kind: rule
title: The catalogue is the single source of the collection
description: Everything a person reads about the collection — titles, prose, classification, status, numbering, counts, the README, the derived plan — comes from catalogue/, validated against the code on every change.
statement: Describe an algorithm only in its catalogue entry (catalogue/entries/<id>.md) and classify it only by a leaf of catalogue/taxonomy.yaml; keep `status` true to the code, cite sources without copying them, name no private repository, path or organisation, and regenerate every derived file (README regions, .ai/repo/project MC-*/IC-* plan) so that `npm run catalogue -- --check` and `node scripts/build-readme.mjs --check` pass.
status: active
class: blocking
depends_on: [project.viz-component-layer@2, project.no-fake-science@1]
tags: [catalogue, single-source, derived, privacy]
---

# Rationale

A collection of several hundred algorithms survives only if nothing about it is written twice
(ADR 0004). A count typed into prose, a title kept in code next to a title in a catalogue, a
plan issue written by hand for something the catalogue already lists: each drifts the first
time one half changes. The tree is public, so the same check that keeps the catalogue honest
keeps private names and locators out of it.

# Required behaviour

- One entry per algorithm, its file name its `id`, its keys only those
  `scripts/lib/catalogue.mjs` declares; the body opens with a summary, and a live entry has
  reading notes.
- `status: live` exactly when the kernel or plate the entry's engine implies exists.
- A source is cited by the id of `catalogue/sources.yaml` and, where useful, its part; no text
  or code is copied from a cited work.
- No entry names a private repository, organisation or filesystem location; the check refuses
  home-directory paths and source-file locators, and an untracked deny-list
  (`~/.config/algoglyph/private-terms`, or `$ALGOGLYPH_PRIVATE_TERMS`) adds names locally.
- The milestones `MC-*` and issues `IC-*` of `.ai/repo/project` are derived by
  `npm run catalogue -- plan --write`; Majordomus keeps their plan state, nothing else edits
  their derived keys.

# Failure behaviour

A catalogue error fails the Vite build and the dev server; `npm run catalogue -- --check`
exits 1 on an error or a stale derived plan file; `node scripts/build-readme.mjs --check`
exits 1 on stale README regions. Each blocks `npm run verify` and CI.

# Verification

`npm run catalogue -- --check` and `node scripts/build-readme.mjs --check`, both in
`scripts/verify-all.sh` and `.github/workflows/ci.yml`; `test/registry.test.ts` checks
numbering, the taxonomy roll-up and that every live entry loads.
