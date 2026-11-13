---
id: credible-path
title: Most credible path
taxonomy: graphs/shortest-paths
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - dijkstra
  - confidence
  - evidence
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E log V)"
interaction: "Tap a vertex to start from it."
related:
  - dijkstra
  - yen-k-shortest
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - dijkstra
  objectives:
    - Run Dijkstra over edge costs of one minus confidence to find the best-supported link between two entities.
    - Switch the edge cost to −ln c to maximise the product of the confidences, the probability that every link holds if they fail independently.
    - Compare the two rules on one graph by the product of confidences each one's path reaches.
  misconceptions:
    - Adding up doubts is not multiplying confidences; on some graphs the 1 − c rule picks a path whose product is below the best one.
claims:
  - id: log-rule-reaches-the-maximum-product
    statement: >-
      Minimising the sum of −ln c maximises the product of the confidences, so under the −ln c
      rule the product is the largest over all source–target paths: exp of minus the
      Floyd–Warshall distance over −ln c in the test, 0.0038825 on the default graph. The
      readout prints three digits, so 0.00388 within half a unit of the last, 0.000005.
    readout: Product of confidences
    expect: { value: 0.00388, tolerance: 0.000005 }
    setup:
      params: { cost: log }
  - id: log-rule-reaches-the-maximum-at-seed-7
    statement: >-
      At seed 7 the largest product over all paths is 0.0099933 by the same Floyd–Warshall, and
      the −ln c rule reaches it: 0.00999 within half a unit of the printed third digit,
      0.000005.
    readout: Product of confidences
    expect: { value: 0.00999, tolerance: 0.000005 }
    setup:
      params: { cost: log }
      seed: 7
  - id: log-rule-reaches-the-maximum-at-300
    statement: >-
      On 300 vertices the largest product is 0.00012145 by Floyd–Warshall in the test, and the
      −ln c rule reaches it: 0.000121 within half a unit of the printed third digit, 0.0000005.
    readout: Product of confidences
    expect: { value: 0.000121, tolerance: 0.0000005 }
    setup:
      params: { cost: log, n: 300 }
  - id: doubt-rule-falls-short-at-seed-7
    statement: >-
      Adding doubts is not multiplying confidences: at seed 7 the 1 − c rule picks a path whose
      product is below the largest, 0.0099933 by Floyd–Warshall on −ln c in the test. Its
      readout is below 0.00999, that largest product cut to the readout's three digits.
    readout: Product of confidences
    expect: { below: 0.00999 }
    setup:
      seed: 7
  - id: doubt-rule-falls-short-at-300
    statement: >-
      On 300 vertices at seed 4242 the 1 − c rule falls short too: its product reads below
      0.000121, the largest product 0.00012145 cut to three digits.
    readout: Product of confidences
    expect: { below: 0.000121 }
    setup:
      params: { n: 300 }
  - id: doubt-rule-never-beats-the-maximum
    statement: >-
      No rule can beat the largest product, 0.0038825 on the default graph, so the 1 − c rule's
      readout rounds to at most 0.00388 and lies below 0.003885, half a unit of the third digit
      above it.
    readout: Product of confidences
    expect: { below: 0.003885 }
---

Dijkstra over edge costs of one minus confidence: the best-supported link between two entities.

Each link carries a confidence between 0.30 and 0.99. Dijkstra runs from the circled source to the boxed target, stops once the target is settled, and draws the chosen path in the foreground colour.

The default cost 1 − c adds up doubts, which favours paths of few strong links. Switch the edge cost to −ln c to maximise the product of the confidences, the probability that every link holds if they fail independently. The readouts give that product either way, so the two rules can be compared on one graph. Adding doubts is not the same as multiplying confidences: on some graphs the 1 − c rule picks a path whose product is below the best one.
