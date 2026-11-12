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
---

Compact position reports from two frames combined into a latitude and longitude.

An extended squitter is 112 bits sent by pulse-position modulation at 1 Mbit/s after an 8 µs preamble; the last 24 bits are a CRC-24 parity over the first 88, with generator polynomial 0x1FFF409. The receiver here finds the preamble by correlation, decides each bit by comparing its two half-microsecond halves, and checks the parity; a remainder that matches the syndrome of a single-bit error locates that bit, which is flipped back.

A compact position report encodes latitude and longitude as 17-bit fractions of a zone. Even frames divide latitude into 60 zones and odd frames into 59, and longitude zones depend on the latitude band NL(lat); combining one even and one odd report resolves which zone the aircraft is in, and gives a global position to about 5 m. The plate's aircraft is time-lapsed, a few seconds of flight between reports.
