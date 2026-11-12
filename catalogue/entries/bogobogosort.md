---
id: bogobogosort
title: Bogobogosort
taxonomy: sorting/esoteric
status: planned
engine: custom
sources:
  - id: morgan-mar-2013
    ref: the definition, readers' estimates and timings
  - id: gruber-2007
    ref: the analysed bogosort it parodies
  - id: lerma-2014
    ref: slower deterministic sorts
tags:
  - sorting
  - esoteric
  - randomized
  - recursion
complexity: n² best, unknown average, unbounded worst; extra space n²
related:
  - bogosort
---

Bogosort with a recursive sortedness test: to decide whether a list is sorted, copy it, bogobogosort all but the last element of the copy, shuffle the copy until its last element exceeds the rest, and only then ask whether the copy matches the original.

Morgan-Mar wrote it as a parody of bogosort, whose linear test he calls "too efficient". Every level of the test repeats random shuffles inside the random shuffles of the level above, so the expected cost multiplies with each element. On Already sorted every level succeeds at once, but each still copies and compares its list, which gives the quadratic best case and the quadratic memory for the copies.

Nobody knows the expected running time. The author offers only a guess, and the two reader estimates printed on his page contradict each other; neither is peer reviewed, so the average case is recorded as unknown. His own measurements show the explosion directly: six elements took minutes on average, and seven did not finish overnight.

This is a bespoke plate: no input at the array engine's sizes would ever finish. The plate lets the reader pick a very small n and a seed, shows the depth of the recursion and the shuffles spent at each level, and counts comparisons as they happen; runs that would not finish in reasonable time are cut off and labelled as such.

It is useful in teaching as an exercise in setting up a recurrence for nested random repetitions and in finding which step of a contested estimate fails. Bogosort, by contrast, has exact expectations derived by elementary means, and Lerma's worstsort shows that even bogobogosort is not a ceiling on slowness.
