---
schema: feature/v1
id: flow-command-line
kind: feature
title: The flow's command line runs any kernel with a data form on a caller's data
short_title: Flow command line
headline: Pipe JSON into `npm run flow -- kernel <id> -`, or keep one `serve` process, and get the kernel's answer with the plate's own code.
summary: scripts/flow.mjs loads src/flow/cli.ts through Vite; graph kernels read a graph, grid kernels their fromData, any other kernel or custom plate the DataForm it declares (src/core/solve.ts, src/plates/<id>/data.ts); `kernels` lists every form with the shape it reads, found from the kernels themselves.
status: stable
weight: 10
featured: true
domain: backend
rules: [project.typed-flow, project.planner-plays-by-the-rules]
docs: [docs/ARCHITECTURE.md]
adrs: [adr-0011, adr-0012]
related: [track-planning, human-pointing]
tags: [cli, flow, data-forms, serve, agents]
---

## What it does

`nodes`, `coverage`, `preset`, `check` and `run` answer from the editor's registry, validator
and runtime; `kernel <id>` runs one catalogue kernel on the caller's JSON; `serve` answers one
JSON request a line until standard input closes, so a planner that replans pays the start-up
once. A refusal names the field and exits 1.

## What it does not do

It reads no file but the one it is handed, opens no network connection and stores nothing; a
kernel without a data form is refused, never guessed at.
