---
id: project.planner-plays-by-the-rules
version: 1
kind: rule
title: The track planner models the game's construction rules, and every plan it returns is re-walked
description: The track planner (src/plates/track-planning) is the one route planner callers outside the collection run; it reads the caller's map as exported, models OpenTTD's track, slope, bridge and tunnel rules explicitly, never changes the game, and an independent validator re-walks every plan its tests and claims rely on.
statement: Keep one track planner, src/plates/track-planning/plan.ts, run by its plate and through its data form (data.ts) by the flow's command line, never copied into a caller; take the caller's layers as exported (OpenTTD's axes, vertex heights, Slope, TrackBits, RoadBits, type letters) and derive slope, foundation need, edge heights and gradients from them; let a move exist only if the game would build it (a straight piece alone on an incline, a levelling foundation for any other piece on a slope, steep slopes only by rule, equal heights at a shared edge, no 90-degree turn under forbid90, a bridge level over ground no higher than its heads, a tunnel level between a rising and a falling incline under ground all the way); return a plan and never a change to the game; and hold every plan in test/track-planning.test.ts to a validator written from the rules apart from the search, and A* to Dijkstra.
status: active
class: blocking
depends_on: [project.typed-flow@1, project.no-fake-science@1, project.user-data-stays-local@1]
tags: [planning, interconnection, openttd, flow]
---

# Rationale

ADR 0012 makes the collection the fork's route planner. A planner that lays a line no train can
run on — a turn the game forbids, a bridge onto a hillside, a curve on an incline — looks as
convincing in a JSON answer as a sound one, and the caller only finds out when the game refuses a
command half-way along a line. The rules are the model, written out where the search reads them,
and the tests re-walk what it returns with code that does not share the search's.

# Required behaviour

- One planner: `plan()` in `src/plates/track-planning/plan.ts`. The plate draws its plans; the
  data form serves them; a caller (the fork's Rust planner, its Squirrel AI, an agent) runs
  `npm run flow -- kernel track-planning -` or the `serve` mode, never a copy.
- The input is the export as it is: hex heights (TileHeight, the north corner), type letters,
  road bits, plus `blocked` tiles taken since the export. A layer the export adds later is a new
  field of the form with its reading derived here.
- A move the game would refuse does not exist in the search: the slope, edge-height, turn,
  bridge and tunnel rules are in `plan.ts`, each named in its comments; a rule left out is said
  in ADR 0012's consequences, never approximated silently.
- The planner returns pieces (TrackBits per tile, each bridge and tunnel with both ends and its
  height) and never calls into the game.

# Failure behaviour

`npx vitest run` fails on `test/track-planning.test.ts` when a plan breaks a rule as the
validator re-walks it (contiguity, edge heights from the raw corners, the slope rule, the turn
rule, bridge clearance and level heads, tunnel portals and ground, the goal's height) or re-adds
to another cost, when A* differs from Dijkstra on a generated map or expands more, when a map
built by hand does not force its construct (a straight line, a diagonal of corner pieces, a
bridge over a river, a tunnel under a built-over ridge, an incline, a steep slope only by rule, a
level crossing only across a straight road, no 90-degree turn by default), or when the data form
accepts a malformed map; `test/claims.test.ts` fails when a claim of `track-planning` no longer
reads what it states; `test/flow-obligations.test.ts` fails when its data form has no run in
`test/flow-cli.test.ts`. Each blocks `npm run verify` and CI.

# Verification

`npx vitest run test/track-planning.test.ts test/flow-cli.test.ts test/flow-obligations.test.ts`
and the `track-planning` claims in `test/claims.test.ts`; a reviewer checks that a new rule of the
game arrives with a hand-built map that forces it and a case in the validator.
