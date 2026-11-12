---
id: adsb-cpr
title: ADS-B position decoding
taxonomy: signals/radio
status: live
engine: signal
sources:
  - id: practice-geo
tags:
  - ads-b
  - cpr
  - crc-24
  - aircraft
complexity: 'O(1) per frame: a CRC over 88 bits and a few divisions'
motivation: Crisis maps and geospatial analysis are built from it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - crc-division
  objectives:
  - Find the preamble by correlation and decide each bit from its two half-microsecond halves.
  - Check the CRC-24 parity over the first 88 bits, and flip back a single-bit error its syndrome locates.
  - Combine one even and one odd compact position report into a global latitude and longitude.
bounds:
  model: CRC bit steps
  best: '88 per parity check: the CRC-24 over the first 88 of the 112 bits'
  worst: '88 per parity check: the CRC-24 over the first 88 of the 112 bits'
claims:
  - id: global-position-to-about-five-metres
    statement: >-
      Combining an even and an odd report gives a global position to about 5 m: the mean error
      over the decoded fixes stays below 5 m.
    readout: Mean error over decoded fixes
    expect: { below: 5 }
  - id: five-metres-at-one-second
    statement: >-
      The pair only picks the zone; the fix is the newest frame's own 17-bit position, off by at
      most half a step of the odd zones, 2.59 m in latitude and at most 2.73 m in longitude on
      this track (35° to 61°), 3.77 m together, whatever the gap. The zone is right while the two
      reports lie within 5654 m in latitude (3/59°) and 6951 m in longitude (180/(NL(NL − 1))°):
      1 s apart they lie 240 m apart, so the mean error stays below 5 m.
    readout: Mean error over decoded fixes
    expect: { below: 5 }
    setup:
      params: { gap: 1 }
  - id: five-metres-at-ten-seconds
    statement: >-
      At the 10 s pairing limit the reports lie 2400 m apart, still inside the 5654 m and 6951 m
      within which the pair picks the right zone, so each fix is again off by its own quantisation,
      at most 3.77 m, and the mean error stays below 5 m.
    readout: Mean error over decoded fixes
    expect: { below: 5 }
    setup:
      params: { gap: 10 }
---

Compact position reports from two frames combined into a latitude and longitude.

An extended squitter is 112 bits sent by pulse-position modulation at 1 Mbit/s after an 8 µs preamble; the last 24 bits are a CRC-24 parity over the first 88, with generator polynomial 0x1FFF409. The receiver here finds the preamble by correlation, decides each bit by comparing its two half-microsecond halves, and checks the parity; a remainder that matches the syndrome of a single-bit error locates that bit, which is flipped back.

A compact position report encodes latitude and longitude as 17-bit fractions of a zone. Even frames divide latitude into 60 zones and odd frames into 59, and longitude zones depend on the latitude band NL(lat); combining one even and one odd report resolves which zone the aircraft is in, and gives a global position to about 5 m. The plate's aircraft is time-lapsed, a few seconds of flight between reports, set by a control up to the 10 s within which a receiver pairs two reports; a report left older than that by a dropped frame is not paired, since the two could lie in different zones. Without that limit a single dropped frame at the default 8 s gap decoded a fix 681 km off (seed 1); the plate's test checks every decoded fix against its own quantisation over forty seeds at gaps of 8 and 10 s, with frames dropped.
