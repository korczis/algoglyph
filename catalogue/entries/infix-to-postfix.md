---
id: infix-to-postfix
title: Infix to postfix conversion
taxonomy: foundations/structures
status: live
engine: string
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - stack
  - expressions
  - parsing
complexity: "O(n) for n tokens: each operator is pushed and popped once"
related:
  - postfix-evaluation
  - recursive-descent-parser
---

Convert an infix expression to postfix with an operator stack.

An operand goes straight to the output. An operator first pops every stacked operator that binds at least as tightly (strictly more tightly when the new one is right associative, as ^ is), then waits on the stack; an opening parenthesis fences off the stack until its closing partner pops back to it.

The readouts count stack pushes and pops and the precedence comparisons that decided each pop. Every operator is pushed once and popped once, so the stack operations are at most twice the number of operators and parentheses.
