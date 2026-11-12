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
---

Compile a pattern to a nondeterministic automaton and run every state set at once.

The automaton row is the pattern itself, wrapped in parentheses: each character is a state. A literal or '.' moves to the next state when it matches the text character; parentheses, |, *, + and ? contribute only epsilon edges. The highlighted cells are the set of states after each text character, closed under epsilon edges, and the start state is added back at every position so that a match may begin anywhere.

A position is reported when the set contains the accept state ✓; the result is the list of positions where some match ends. The set never holds more than m + 1 states, which is what keeps the simulation from the exponential blow-up of backtracking matchers.
