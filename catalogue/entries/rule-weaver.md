---
id: rule-weaver
title: Rule Weaver
taxonomy: dynamics/automata
status: live
engine: custom
tags:
  - cellular automata
  - Wolfram
  - bits
complexity: O(width) per generation
---

An elementary cellular automaton woven row by row; each live cell is coloured by which of the eight rule bits gave birth to it.

A row of cells on a ring; each new row is computed from the one above by looking at three cells (left, self, right). The 8 possible neighbourhoods index the 8 bits of the rule number, and that bit is the cell's next state.

The legend in the corner is the rule itself: the eight neighbourhoods from 111 down to 000 and the state each one produces. Live cells take the colour of the neighbourhood that created them, so the texture shows which bits are doing the work.

Try 30 (chaos, once used as a random generator), 110 (Turing complete), 90 (Sierpiński), 184 (traffic flow), 73 and 54. Changing the rule mid-weave splices two fabrics.
