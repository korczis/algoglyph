---
id: project.verify-commands
version: 1
kind: rule
title: Verification commands
description: A task finishes with the repository's one gate, the same chain CI runs.
statement: Close every task with `majordomus finish --verify-command "npm run verify"`; use `npm run verify -- --fast` only for a change that touches no file under src/, index.html, public/ or scripts/audit-ui.mjs.
status: active
class: advisory
depends_on: []
tags: [verification, node]
---

# Rationale

`scripts/verify-all.sh` runs the same steps as `.github/workflows/ci.yml`, in the same order,
and stops at the first failure: typecheck, unit tests, build, the owner-level Flowbite Pro
verifier when it is present, the browser gate, `majordomus doctor`. A task closed on a weaker
command proves less than the merge gate will ask for.

# Required behaviour

| Change touches                                   | Verify command               |
|--------------------------------------------------|------------------------------|
| `src/`, `index.html`, `public/`, the audit       | `npm run verify`             |
| anything else (docs, `.ai/`, CI, hooks)          | `npm run verify -- --fast`   |

- The browser gate launches Chrome once per run; do not loop it. On macOS each headless launch
  leaves a code-signing clone behind (owner note), so prefer `--fast` while iterating and run
  the full gate once before finishing.

# Failure behaviour

A task finished on a command that skips a gate its change needs is a review finding.

# Verification

A reviewer compares the finish record's verify command with the files the task changed.
