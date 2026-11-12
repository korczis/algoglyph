---
schema: adr/v1
id: adr-0006
kind: adr
title: "Every catalogued algorithm gets a live page, delivered in reviewed batches"
status: accepted
date: 2026-11-12
tags:
  - catalogue
  - delivery
provenance:
  origin: authored
---

# 6. Every catalogued algorithm gets a live page, delivered in reviewed batches

## Context

The owner, in session 8b702ebf-3f15-4e77-880e-843436e75d2c on 2026-11-12, verbatim:

- "deploy asap, then implement all planned"
- "implementuj page pro kazdy jeden z algoritmu, prubezne deploy in batches, meet all .ai/ update all
  .ai/"
- "kazda stranka zaroven musi byt akademicky / popularne naucny / vzdelavaci prolinkovany clanek pro
  edukativni / didakticke / nazorne ucely"
- "vse musi byt maximalne popsano ve frontmatter, at se da do budpoucna linkovat, inferovat,
  derivovat, delat dynamicke projekce, systemy, surfaces, etc"
- "vse musi byt as much as possible data driven, convention over configuration, rhai as possible"
- with the master prompt "ALGOGLYPH: SEMANTIC EVOLUTION & SCIENTIFIC VISUAL ATLAS" and "always
  prefer rhai over shell / always prefer just over make or custom shell tooling / always derive /
  infere / dry / reuse / componentize / compose / document for future" (ADR 0005 §6).

Every planned entry already has an engine lane building it; the catalogue derives the plan, so an
entry leaves the plan the moment its code and its test exist.

## Decision

1. **The goal is zero planned entries.** Each engine lane makes every entry of its engine live:
   a kernel through the engine's instrumented operations, or a bespoke plate when the engine
   cannot honestly express it; never a placeholder page.
2. **A page is live only with its evidence.** `catalogue --check` refuses a live entry no test
   names (ADR 0005 §3); the browser gate opens every live entry at its route in both themes and
   both widths; `test/budget.test.ts` holds every plate and lab to the main-thread budget at every
   width, heavy corner, run end and slider drag.
3. **Delivery is in batches.** A batch is the set of lane branches whose independent review
   (findings returned to the same builder, re-reviewed after each fix round) has no open P1 or P2.
   The integrator merges them onto main in one tree, regenerates the derived plan and README,
   runs the full `npm run verify` on exactly that tree, pushes, and confirms the deployed
   revision from production's `revision.txt`.
4. **Every page is also an article.** A live entry is an academic and popular-science text as
   much as an experiment: the textbook sections of ADR 0005 (overview and motivation, theory,
   how it works, complexity and limitations, experiments to try, what the tests verify, related
   entries, sources) written from the entry's front matter and body, every other entry it
   mentions linked by route (`#/p/<id>`, rendered as a link titled from the catalogue), every
   claim tied to a cited source or to the test that checks it. The derived maturity profile
   `documented` (notes, sources and at least one of pedagogy, algorithm, bounds) is the
   machine-checked floor; content waves per wing raise every live entry to it, and once a wing
   is done its live entries below `documented` are refused by `catalogue --check`.
5. **The article lives in front matter first.** What a page says is authored as typed v2 front
   matter (ADR 0005: `pedagogy`, `algorithm`, `bounds`, `experiments`, typed `relations`, `sources`
   with sections) so any future surface can link, infer and project it; the Markdown body carries
   only prose that no field can hold. Every field is declared in `catalogue/schema/entry.yaml`,
   nothing is invented to fill one (an unknown stays absent), and runtime facts (controls,
   readouts, evidence, maturity) are derived, never authored.
6. **Convention over configuration, data over code, Rhai over shell.** A file's place names its
   role (an entry by its file name, a kernel by `src/kernels/<engine>/<id>.ts`, a plate by
   `src/plates/<id>/plate.ts`, a check by its config file) and is discovered, never registered.
   Policies, budgets and rules are data (`config/*.yaml`, `catalogue/schema/*.yaml`). Tooling is
   entered through the repository `justfile`; new tooling logic is Rust with Rhai plugins
   (ADR 0005 §6), each port of a Node or shell script proven equivalent on the same tree first.
7. **Every rule change lands in `.ai/`.** A gate added or tightened in a batch is documented in
   the rule it enforces (`.ai/repo/rules/project/*`) and in `docs/ARCHITECTURE.md` in the same
   commit.

## Consequences

- The planned count falls with every batch and is never typed anywhere; README regions, the plan
  and the site's numbers are derived from the catalogue.
- A branch that is green on its builder's machine but red on CI is not done: the gate's local
  headroom (`config/budgets.yaml`) exists so that local green predicts CI green.
