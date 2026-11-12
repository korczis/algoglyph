---
id: postfix-evaluation
title: Postfix evaluation with a stack
taxonomy: foundations/structures
status: live
engine: string
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - stack
  - expressions
complexity: "O(n) for n tokens, one push or two pops and a push per token"
related:
  - infix-to-postfix
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Evaluate a postfix expression with one value stack and no precedence rules.
  - Watch the stack depth rise with operands, fall with operators and end at one value.
---

Read an expression in postfix notation and evaluate it with one pushdown stack.

Operands are pushed; an operator pops its right operand, then its left, and pushes the result, so the order of subtraction and exponentiation is preserved. The chart plots the depth of the value stack after each token: it rises with operands, falls by one with each operator and ends at exactly one value.

The postfix input is printed from the same random expression tree as the infix form other plates read, so no parentheses or precedence are needed here.
