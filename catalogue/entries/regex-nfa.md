---
id: regex-nfa
title: Regular expressions by NFA simulation
taxonomy: strings/patterns
status: live
engine: string
sources:
  - id: sedgewick-aic-1990
    ref: String Processing
tags:
  - regular expressions
  - automata
  - nfa
complexity: "O(m n) for a pattern of length m and a text of length n"
related:
  - knuth-morris-pratt
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Read the pattern wrapped in parentheses as an automaton, one state per character.
  - Follow match edges for literals and '.', and epsilon edges for parentheses, |, *, + and ?.
  - Keep the whole set of states after each text character, closed under epsilon edges, instead of backtracking.
bounds:
  model: states examined
  worst: 'at most m + 2 per text character for a pattern of m characters (m + 2 states with its two parentheses, besides the accept state): O(m n)'
claims:
  - id: depth-1-every-end
    statement: >-
      At nesting 1 the seeded pattern is (a|.), and '.' matches any one character, so a match
      ends at every one of the 36 positions; JavaScript's RegExp, tried over every start and end
      of the text, finds the same 36.
    readout: Match ends
    expect: { value: 36 }
    setup:
      params: { depth: 1 }
  - id: depth-2-ends-regexp
    statement: >-
      At nesting 2 the seeded pattern is b(b|c): JavaScript's RegExp, an independent engine tried
      over every start and end of the text, finds a match ending at 13 positions, and so does the
      automaton.
    readout: Match ends
    expect: { value: 13 }
    setup:
      params: { depth: 2 }
  - id: depth-2-states-bound
    statement: >-
      At nesting 2 the pattern b(b|c) has m = 6 characters, so each of the n = 36 text characters
      examines at least the start state and at most the m + 2 states besides the accept state:
      between 36 and 8 × 36 = 288 states examined.
    readout: States examined
    expect: { range: [36, 288] }
    setup:
      params: { depth: 2 }
---

Compile a pattern to a nondeterministic automaton and run every state set at once.

The automaton row is the pattern itself, wrapped in parentheses: each character is a state. A literal or '.' moves to the next state when it matches the text character; parentheses, |, *, + and ? contribute only epsilon edges. The highlighted cells are the set of states after each text character, closed under epsilon edges, and the start state is added back at every position so that a match may begin anywhere.

A position is reported when the set contains the accept state ✓; the result is the list of positions where some match ends. For a pattern of m characters the automaton has m + 2 states, its characters and the two parentheses, plus the accept state, so the set never holds more than m + 3 states, which is what keeps the simulation from the exponential blow-up of backtracking matchers.
