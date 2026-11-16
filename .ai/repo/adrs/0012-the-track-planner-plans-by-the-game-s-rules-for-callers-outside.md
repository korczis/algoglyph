---
schema: adr/v1
id: adr-0012
kind: adr
title: "The track planner plans by the game's rules, for callers outside the collection"
status: proposed
date: 2026-11-16
tags:
  - planning
  - interconnection
  - flow
provenance:
  origin: authored
---

# 12. The track planner plans by the game's rules, for callers outside the collection

## Context

The owner asked, in session 823ff4b3-9e36-4df2-8d64-581f79040afd on 2026-11-16, that route
planning for the OpenTTD fork learn bridges, tunnels and diagonal curves; that it be a planning
engine of its own, externalized through AlgoGlyph and tested; and that the map be read in more
detail than its topology — slope, height, material, surroundings, gradients, connections and
occupancy for every tile, kept current — all of it enforced and documented through `.ai/`.

What existed: the fork's Squirrel AI laid track with its own A* over four neighbours, turning
only on flat land, never building a bridge or a tunnel; the fork's planner in Rust (`tools/research/mcp-rhai`) called
AlgoGlyph once, for `knapsack-dp`, through the flow's command line (`npm run flow -- kernel`);
the fork exports the map as layers (`openttd://map` heights, types and owners,
`openttd://map/ways` road and rail bits). The collection's own terrain search (the Cartographer,
`pathfinding-terrain`) is a grid search with no headings, heights or constructs.

## Decision

1. **One planner, one identity.** The planner is the collection's entry `track-planning`: its
   search in `src/plates/track-planning/plan.ts`, its plate beside it, and its data form
   (`data.ts`, `src/core/solve.ts`) the command line serves. A caller outside the collection runs
   that code; nobody keeps a second copy of it. The Cartographer stays what it is: the lesson on
   Dijkstra, A* and greedy search; the planner adapts its heap, not its search.
2. **The game's rules are the model.** A state is a tile, the heading it was entered by, the
   train's motion (eight directions) and the height of the edge crossed. A move is a track piece
   (straight, or a corner piece: half a tile's diagonal, a 45-degree turn), a bridge (straight,
   level, its heads at the arrival height, the ground under it no higher, at most `maxBridge`
   tiles) or a tunnel (level, from an incline rising into a hill to the first incline falling
   out of it, ground above it all the way). An incline takes only a straight piece; anything else
   on a slope stands on a levelling foundation; steep slopes only where `steep` allows; the two
   tiles sharing an edge agree on its height; `forbid90` forbids a 90-degree turn. Conventions
   (axes, Slope, TrackBits, RoadBits, type letters) are OpenTTD's, so the export maps on as it is.
3. **The caller's map is read as it is exported, and read further here.** The data form takes the
   export's layers verbatim (hex heights, type letters, road bits) plus tiles taken since the
   export (`blocked`), so occupancy is current at every call; it returns the pieces as a builder
   lays them (TrackBits per tile, each bridge and tunnel with both ends) and, on request, its
   reading of every tile (Slope, gradient). Slope, foundation need, edge heights and gradients
   are derived from the heights, never asked for twice.
4. **The planner never changes the game.** It returns a plan; the caller builds it through its own
   commands (the fork's rule `project.game-state-mutates-only-through-commands`).
5. **Every plan is re-walked.** `test/track-planning.test.ts` holds a validator written from the
   game's rules, separately from the search, that re-walks each plan tile by tile and re-adds its
   cost; A* is held to Dijkstra on generated maps; the plate's claims read plans the validator
   accepts. Rule `project.planner-plays-by-the-rules` makes this blocking.

## Consequences

- The fork can retire its own track search for `npm run flow -- kernel track-planning` (or a
  `serve` session that replans): the move is the fork's, recorded in its own `.ai/`.
- Not modelled yet, and said so: half-tile foundations (OpenTTD lets some corner pieces stand on
  a slope without one), bridge heads on inclines, signals, several tracks on one tile, a plan's
  speed (curve and slope speed limits), terraforming. Each is an addition to the rules, behind a
  test, never a silent approximation.
- With the game's prices (`openttd://economy/prices`) and bridge types (`openttd://bridges`) the
  search weighs a whole bridge or tunnel at the price CmdBuildBridge / CmdBuildTunnel charge
  (CalcBridgeLenCostFactor and the cheapest type that spans it; the compounding tunnel cost), and
  the plan's `money` is summed from its pieces in the game's money, never from the search's
  penalties for curves and inclines.
- A per-tile layer the fork does not export yet (foundations already built, occupancy by
  vehicles, bridge and tunnel extents) arrives through the same form as an added field, its
  reading derived here.

## Owner confirmation

The owner, in session 823ff4b3-9e36-4df2-8d64-581f79040afd on 2026-11-16 at 20:25 CET, answered two
questions, recorded verbatim (a peer session's label is replaced by its role):

- Q: "The integrator ([the integrator session]) is holding my planner branches until you confirm
  them: flow-solve, track-planning (bridges, tunnels, curves), human-pointing, openttd-map-input
  (per-tile meta), action-plan (the repay-50k-as-5-presses DAG), transport-investment (multimodal
  ROI), exact-prices. 22 commits on top of main, all pushed, and the OpenTTD sessions already use
  them live. Should they land on main and deploy?" A: "Land all of them (Recommended)".
- Q: "algoglyph's last Pages deploy (b3dee95, with the flow editor and flow CLI) failed in CI's
  browser gate: the step ended after 25 min with no result and no log, which looks like a lost
  runner. The same gate passes locally (399 plates, #/flow, both themes). Should I re-run that Pages
  workflow now, or leave it to the integrator session?" A: "Re-run it now (Recommended)".

The stack lands through the integrator after hosted x86 CI, as every branch does; the confirmation
releases the hold, it does not skip a gate.

The integrator session (8b702ebf-3f15-4e77-880e-843436e75d2c) asked the owner twice on 2026-11-16,
recorded verbatim. First, before the confirmation above:

- Q: "Another session, algoglyph-f8, asked me to land a seven-branch stack into the public algoglyph
  site. On top of flow-solve sit six branches that add an OpenTTD rail and transport planner: a new
  ADR 0012, a new blocking rule (project.planner-plays-by-the-rules), a human-like mouse-motion model
  matched bit for bit against a fork's motion.rs, and plans expanded into key presses. Should I land
  the OpenTTD part in algoglyph?" A: "Hold it (Recommended)".

Then, after the confirmation above was reported to it by the planner's session, and before landing:

- Q: "Earlier you told me to hold the OpenTTD planner stack. algoglyph-f8 now reports that you told it
  "Land all of them" at 20:25 CET today (about 15 minutes ago), and it added your words to ADR 0012.
  Which stands for the stack: flow-solve, track-planning, human-pointing, openttd-map-input,
  action-plan, transport-investment and exact-prices, 23 commits with exact-prices 689f24a on top?"
  A: "Land all of them".

The later answer stands. Before landing, the stack's added lines were checked for a private
repository, a local path, an e-mail address and peer-session labels: none (commit messages keep
four peer-session labels, which are agent names, not people or repositories).
