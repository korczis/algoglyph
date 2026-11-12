---
schema: adr/v1
id: adr-0009
kind: adr
title: "Figure occurrences of cited works: chapter documents over shared plates, link-only sources"
status: proposed
date: 2026-11-12
tags:
  - catalogue
  - feynman
  - provenance
provenance:
  origin: authored
---

# 9. Figure occurrences of cited works: chapter documents over shared plates, link-only sources

## Context

The owner asked for interactive pages for the figures of *The Feynman Lectures on Physics*,
starting with the six figures of Volume III, chapter 1, each a full page on the existing Stage,
with shared solvers. A figure of a book is a bibliographic fact (volume, chapter, number, what it
shows); a plate is a solver; a lesson is what a reader does with both. One solver serves several
figures (the two-slit amplitudes serve four), and one figure may need a model no plate has yet.

The online edition of the lectures may be read, not reproduced: no text, caption, drawing or
audio of it may enter the repository. Every figure page is original prose and original code.

## Decision

1. **A figure occurrence is not a catalogue entry.** It lives in a chapter document,
   `catalogue/figures/<work>-<volume>-<chapter>.yaml`, validated by
   `catalogue/schema/figures.yaml`. Its `pedagogy` and `claims` fields are the entry schema's
   own (catalogue/schema/entry.yaml), used by reference, so there is one definition of each.
   Entries, plate counts and the plate KPIs are unaffected by figures.
2. **A figure names a plate and pins a setup.** `plate` is a live entry; `setup` holds values of
   that plate's own parameters (checked against its code, as an entry's experiments are). A
   figure's claims are read by the one claims instrument (ADR 0007) with the figure's setup under
   the claim's own.
3. **Authored and derived.** Authored: the figure's number, section, anchor, source class, a
   paraphrase in our own words, the plate and setup, pedagogy, claims, and the chapter's source
   review. Derived: the route `#/feynman/<volume>/<chapter>/<figure>`, previous and next figures,
   counts, the navigation, the backlink from a plate to its figures, and every evidence fact.
4. **No status key.** A figure page is routed exactly when its chapter carries a source review
   (who read the primary source, when, how) and its plate is live and tested. The review is an
   attestation that a person compared the record with the primary source, not a verdict about
   the page; implemented, tested and deployed remain derived (ADR 0005 §3). A figure that is not
   routed is not shown, and its URL opens the collection, never an unrelated plate.
5. **Link-only sources.** A chapter cites a `sources.yaml` work and the canonical chapter URL; a
   figure records its anchor. Nothing of the source's text or artwork is copied, downloaded,
   traced or mirrored, and a claim's statement is our own wording (it appears verbatim on the
   page). A chapter that the source says is almost the same as another (III/1 and I/37) records
   it as `same_as`, a bibliographic backlink only.
6. **A figure URL carries the same query as a plate's.** `src/core/share.ts` serialises the
   seed and the parameters that differ from a base: the plate's defaults on `#/p`, the figure's
   setup on `#/feynman`, so a clean figure link has no parameters and a changed one restores.

## Alternatives rejected

- Figures as catalogue entries with a `figure` block: a figure would count as a plate, need a
  taxonomy leaf and an engine, and four figures would duplicate one solver's entry.
- A figure document per figure: a chapter is the unit a reviewer reads, and the review is one
  record for the chapter.
- An authored `verified` or `published` status: a stored verdict is a copy that goes stale.
- Embedding or tracing the source's figures: not licensed.

## Consequences

- The browser gate and the claims test read routed figures from the catalogue; a chapter with
  no review adds no page and no claim run, and says so in `catalogue --check`'s plan.
- A solver used by figures is an ordinary live entry with its own tests and claims, so its
  physics is gated whether or not any figure is routed.
- Figure-level claims (§2) land with the step that runs them in `test/claims.test.ts` and shows
  them on the page; until then the schema has no `claims` key for a figure and the physics
  claims sit on the plates' entries.
