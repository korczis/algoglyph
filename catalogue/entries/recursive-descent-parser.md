---
id: recursive-descent-parser
title: Recursive descent parsing
taxonomy: strings/patterns
status: live
engine: string
sources:
  - id: sedgewick-aic-1990
    ref: String Processing
tags:
  - parsing
  - grammars
  - recursion
complexity: "O(n) for n tokens: the grammar needs one token of lookahead and never backtracks"
related:
  - infix-to-postfix
  - postfix-evaluation
---

One procedure per grammar rule, the call stack shaped like the parse tree.

Each rule of the grammar shown in the code is one procedure: expr loops over + and −, term over *, factor calls itself after ^ so that exponentiation groups to the right, and primary either reads a number or a parenthesised expr. The call stack chips are the procedures active at the current token, and the chart plots their depth at every call, which follows the depth of the parse tree.

The parser evaluates as it returns and emits the operators in postfix order, so its output can be checked against the shunting-yard conversion of the same tokens.
