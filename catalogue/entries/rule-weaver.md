---
id: rule-weaver
title: Rule Weaver
taxonomy: dynamics/automata
status: live
engine: custom
sources:
  - id: wolfram-1983-cellular-automata
    purpose: algorithm-reference
tags:
  - cellular automata
  - Wolfram
  - bits
complexity: O(width) per generation
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Compute each new row from the one above by looking at three cells, left, self and right, whose 8 possible neighbourhoods index the 8 bits of the rule number.
    - Read the legend as the rule itself, the eight neighbourhoods from 111 down to 000 and the state each one produces.
    - See which bits are doing the work, with live cells taking the colour of the neighbourhood that created them.
    - Compare rule 30 (chaos), 110 (Turing complete), 90 (Sierpiński) and 184 (traffic flow).
algorithm:
  paradigm: simulation
bounds:
  model: cell updates, one per cell of the ring per generation
  best: width per generation
  worst: width per generation
  space: three rows of width cells, and the woven picture
claims:
  - id: rule-90-at-row-63
    statement: >-
      Rule 90 sets each cell to the exclusive or of its two neighbours, so from a single live cell
      generation n is row n of Pascal's triangle mod 2, and by Lucas's theorem C(n, k) is odd
      exactly when the bits of k are among those of n: 2^popcount(n) live cells, while the two
      fronts have not met round the ring (n below half its 200 cells at the default 4 px). At row
      63 = 111111₂ that is 2⁶ = 64 cells, 32.0% of the ring, exactly.
    readout: live cells
    expect: { value: 32 }
    setup:
      params: { rule: 90, runs: 63 }
  - id: rule-90-at-row-99
    statement: >-
      At row 99 = 1100011₂, still below half the 200-cell ring, Lucas's theorem leaves 2⁴ = 16 live
      cells: 8.0% of the ring, exactly, a quarter of row 63's share although the triangle
      is wider.
    readout: live cells
    expect: { value: 8 }
    setup:
      params: { rule: 90, runs: 99 }
  - id: rule-184-conserves-its-live-cells
    statement: >-
      Rule 184 moves a live cell one step right when the cell ahead is empty and keeps it
      otherwise, so on the ring it never creates or destroys one (checked by exhaustion over every
      configuration of every ring up to 12 cells): from a random first row the live cells after
      300 generations are the first row's, a difference of exactly 0.
    readout: live cells
    expect: { against: live cells in the first row, tolerance: 0 }
    setup:
      params: { rule: 184, start: random, runs: 300 }
  - id: rule-184-conserves-a-sparse-row
    statement: >-
      The same conservation holds at any density: from the sparse first row (8% alive) the live
      cells after 1000 generations, the picture scrolled many times over, are still exactly the
      first row's.
    readout: live cells
    expect: { against: live cells in the first row, tolerance: 0 }
    setup:
      params: { rule: 184, start: sparse, runs: 1000 }
---

An elementary cellular automaton woven row by row; each live cell is coloured by which of the eight rule bits gave birth to it.

A row of cells on a ring; each new row is computed from the one above by looking at three cells (left, self, right). The 8 possible neighbourhoods index the 8 bits of the rule number, and that bit is the cell's next state.

The legend in the corner is the rule itself: the eight neighbourhoods from 111 down to 000 and the state each one produces. Live cells take the colour of the neighbourhood that created them, so the texture shows which bits are doing the work.

Try 30 (chaos, once used as a random generator), 110 (Turing complete), 90 (Sierpiński), 184 (traffic flow), 73 and 54. Changing the rule mid-weave splices two fabrics.

The first row is generation 0, and the generation readout labels the row last woven. Rule 184 moves each live cell one step right when the cell ahead is empty, like cars in a queue, so it never creates or destroys one: its live cells stay those of the first row, which a readout shows beside them.
