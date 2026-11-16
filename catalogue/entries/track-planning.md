---
id: track-planning
title: Track planner
taxonomy: graphs/shortest-paths
status: live
engine: custom
sources:
  - id: openttd-track
    purpose: implementation
  - id: hart-nilsson-raphael-1968
    purpose: algorithm-reference
tags:
  - graphs
  - A*
  - planning
  - OpenTTD
complexity: O(S log S) in the states S = tiles × 4 headings × 3 motions × heights
related:
  - pathfinding-terrain
  - dijkstra
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
    - pathfinding-terrain
  objectives:
    - Search over a tile, the heading it was entered by, the train's motion and the height of the edge crossed, so a slope, a curve and a bridge are moves of one graph.
    - Explain why an incline takes only a straight piece, why every other piece on a slope needs a foundation, and why the heights at a shared edge must agree.
    - Raise the cost of tunnels or bridges and watch the cheapest line change construct, never cost less.
  misconceptions:
    - A grid path is not a railway; without headings and heights a planner lays turns and climbs no train can run on.
claims:
  - id: a-star-equals-dijkstra
    statement: >-
      The estimate, the Manhattan distance times the cheapest cost of advancing one tile (half a
      tile's diagonal), never overestimates, so A*'s plan costs exactly what Dijkstra's does on the
      same map: 0 % above, within half the printed decimal, 0.05.
    readout: vs Dijkstra
    expect: { value: 0, tolerance: 0.05 }
    source: hart-nilsson-raphael-1968
  - id: default-plan-cost
    statement: >-
      On the default map the plan costs 68.13, the cost the validator in the test re-adds piece by
      piece from OpenTTD's rules and Dijkstra matches: 68.13 within 0.005.
    readout: plan cost
    expect: { value: 68.13, tolerance: 0.005 }
  - id: the-river-is-bridged
    statement: >-
      The river runs across the whole map at sea level and track cannot stand on water, so the
      line bridges it, once: exactly 1 bridge on the default map.
    readout: bridges
    expect: { range: [1, 1] }
    source: openttd-track
  - id: the-village-is-tunnelled
    statement: >-
      The ridge's crest is built over; at the default costs a tunnel under it is cheaper than
      climbing round or over it: exactly 1 tunnel on the default map.
    readout: tunnels
    expect: { range: [1, 1] }
  - id: dear-tunnels-climb-over
    statement: >-
      At 10 a tunnel tile, the line climbs over the ridge on inclines instead: no tunnel.
    readout: tunnels
    expect: { range: [0, 0] }
    setup:
      params: { tunnel: 10 }
  - id: dear-tunnels-cost-more
    statement: >-
      That line costs 79.07, more than the tunnelled 68.13: dearer moves never make the optimum
      cheaper. 79.07 within 0.005, matched in the test.
    readout: plan cost
    expect: { value: 79.07, tolerance: 0.005 }
    setup:
      params: { tunnel: 10 }
  - id: seed-7-plan-cost
    statement: >-
      On the map of seed 7 the plan costs 63.82, re-added by the validator in the test: 63.82 within
      0.005.
    readout: plan cost
    expect: { value: 63.82, tolerance: 0.005 }
    setup:
      seed: 7
---

A railway from station A to station B across rolling land, laid as OpenTTD lays it: straight and diagonal track pieces, inclines, foundations, a bridge over the river and a tunnel under the village, the cheapest line A* can find.

The map is OpenTTD's: whole height levels at the tile corners, neighbouring corners at most one level apart, so a tile is flat, inclined (one edge a level above the opposite one), sloped or steep. A straight piece runs up an incline as it is; any other piece on a slope stands on a foundation that levels it to its highest corner, and track on a steep slope only where the rule allows it. Every edge the line crosses has one height, and the two tiles that share it must agree on it.

The search's state is a tile, the heading the line entered it by, the train's motion (one of eight directions: a corner piece is half a tile's diagonal and turns the line 45 degrees) and the height of that edge. Two corner pieces turning the same way make a 90-degree turn, which OpenTTD forbids by default. A bridge is straight and level, its heads at the height the line arrives at and the ground under it no higher; a tunnel runs level from an incline rising into a hill to the first incline falling out of it, with ground above it all the way.

A* orders the states by the cost so far plus the Manhattan distance times the cheapest cost of advancing a tile, which never overestimates; the readout compares its plan with Dijkstra's on the same map. Raise the bridge or tunnel cost and watch the line go round the village or over the ridge instead.

The flow's command line runs the same planner on a caller's map, the layers OpenTTD's research export gives (`npm run flow -- kernel track-planning -`). Its `from` and `to` are the station tiles themselves, so the line starts on the tile after the first station and stops on the tile before the second; a builder lays the pieces between them as they are.
