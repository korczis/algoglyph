---
id: project.derived-facts
version: 1
kind: rule
title: Every number and every link is derived, never typed
description: A count of anything in the collection, a plate number or an internal link written by hand is a copy that drifts; numbers come from the catalogue or a measured run, links name ids that resolve, and a gate refuses the rest on every commit.
statement: Never type a count of the collection (plates, entries, wings, shelves, labs, kernels, engines, tests, tags, milestones, issues), never refer to a plate by its number, and never write an internal link the catalogue does not resolve; derive the number (README derived regions, src/core/facts.ts, the catalogue model, a constant the code reads) or cite the CI run or commit it was measured on, and link by id. `node scripts/check-facts.mjs` must report no finding.
status: active
class: blocking
depends_on: [project.catalogue-integrity@1]
tags: [single-source, derived, links, numbers, drift]
---

# Rationale

Numbers started to drift as soon as the collection grew (2026-11-11): the derived plan stored
per-wing counts that went stale the moment one entry went live, an architecture document named
a file that had moved, instructions to workers carried counts that would have been copied into
notes, and plate numbers — which follow the taxonomy order — were the only way some text could
point at a plate. Each was a fact written twice. The root cause is always the same: a value
that can be computed was stored instead. The prevention is the same too: refuse the stored copy
at the commit that introduces it.

# Required behaviour

- A count about the collection appears only where it is computed: a derived README region,
  `src/core/facts.ts` on the site, a value the catalogue model carries (`labMin`), or a
  readout measured at runtime.
- A number measured once (a CI duration, a test count at a milestone) is evidence: it stays on
  the line that cites the run or the full commit it was measured on, or inside a closed plan
  object or a dated decision record.
- A plate is named by its id; `#/p/<id>`, `#/c/<path>` and `#/lab/<id>` resolve in the
  catalogue; a relative link or a backticked repository path in prose names a file that exists.
- Generators store no counts: what a reader needs to count is listed by the command that
  derives it (`npm run catalogue -- list ...`).
- What the gate looks for, what counts as a record and every exemption (each with its reason)
  live in `config/derived-facts.yaml`, never in code.

# Failure behaviour

`node scripts/check-facts.mjs` exits 1 and names each finding with its check, file and line;
the pre-commit hook, `npm run verify` (also `--fast`), CI and `test/derived-facts.test.ts`
(which runs the gate over the repository) all refuse it.

# Verification

`node scripts/check-facts.mjs`; `test/derived-facts.test.ts` proves each check by a refused
and an allowed case, keeps the root causes fixed (no count in the derived plan, the lab
minimum read from one constant) and runs the gate over the repository.
Two implementations read the one policy: `scripts/check-facts.mjs` is the gate, and its Rust
port `algoglyph facts` (`crates/algoglyph-cli`, `just facts-rs`; checks beyond the built-in ones
are Rhai scripts under `tools/checks/`) is held to it by
`crates/algoglyph-cli/tests/equivalence.rs`, which runs both on the repository and on
`test/fixtures/derived-facts/` and asserts the same findings, files read and exemptions applied.
