---
schema: feature/v1
id: track-planning
kind: feature
title: A railway planned by OpenTTD's construction rules, for the fork's planner and player
short_title: Track planner
headline: Hand it the game's exported map and two stations; it returns the cheapest line the game would build, bridges and tunnels included.
summary: src/plates/track-planning/plan.ts searches tile, heading, motion and edge height with straight and corner pieces, inclines, foundations, bridges, tunnels and level crossings; data.ts reads the export's layers as they are, or the game's openttd://map and openttd://map/ways answers whole (vehicles standing on a tile make it taken) and returns TrackBits per tile and compact runs; a validator in test/track-planning.test.ts re-walks every plan.
status: stable
weight: 20
featured: true
domain: backend
rules: [project.planner-plays-by-the-rules, project.no-fake-science]
docs: [docs/ARCHITECTURE.md]
adrs: [adr-0012]
related: [flow-command-line]
tags: [planning, openttd, a-star, bridges, tunnels]
---

## What it does

Plans a line from a station's edge into another station tile on the caller's map, reading
heights, tile types, road bits and tiles taken since the export; answers the pieces, their
runs, the counts a price model needs, and on request its reading of every tile.

## What it does not do

It never changes the game: the caller builds the plan through its own commands. Half-tile
foundations, inclined bridge heads, signals and terraforming are not modelled yet (ADR 0012).
