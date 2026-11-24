---
schema: knowledge/v1
id: music-analysis-from-sonic-playground
kind: knowledge
class: lesson
title: "Tempo, beat phase and key of real music in a browser: what measurements on freely licensed recordings taught sonic-playground, and plates they suggest here"
description: "Before a plate on tempo, beat tracking, onset detection, key finding or song structure, or when one of the signal or stochastic kernels (kuramoto, page-hinkley, stft-spectrogram, yin-pitch) is reused for live audio."
status: verified
epistemics: observed
date: 2026-11-24
tags:
  - signals
  - measurement
  - cross-project
provenance:
  origin: authored
---

# Tempo, beat phase and key of real music in a browser

The owner's music site sonic-playground (~/dev/sonic-playground, `static/js/viz-audio.js`) drives
25 visualisations from live audio. On 2026-11-24, by the owner's order of "bidirectional
knowledge", three analysis passes fed it freely licensed recordings: techno, hip-hop, rock with
live drums, swing jazz, drum and bass, solo piano, Beethoven and Vivaldi. The recordings came from
Wikimedia Commons, with librosa references. What follows was measured there and is offered here
as knowledge and as plates worth drawing. sonic-playground credits this collection where it took
a method: its beat phase follows the phase locking of the `kuramoto` plate, and its song
sections are the `page-hinkley` plate's test.

## Tempo

- **Kick intervals hold on four-on-the-floor only.** Hip-hop read 118 bpm or nothing, rock and
  jazz locked a fifth of the time, and a solo piano read a false 110.
- **The autocorrelation of an onset novelty is the robust estimator.** Each range (bass, mids,
  highs) keeps its own novelty and autocorrelation. A lag scores its correlation at 1-4 periods (a
  comb), weighed by a log-normal preference around 120 bpm. The best range's best lag is the
  tempo, accepted only where the ranges' mean supports it.
  - One bass-weighted novelty let a dotted-eighth bass line put techno at 2/3 of its tempo.
  - The best range alone found beats in Vivaldi.
  - The mean alone missed swing jazz.
- **A period is rarely a whole number of analysis steps.** Smooth the novelty (about +-40 ms)
  before correlating, or sharp onsets miss each other at the period's multiples. Unsmoothed,
  124 bpm read as 166.
- **Never take the maximum of frames that share a step.** At 60 fps into 20 ms steps, every
  fifth step holds two frames; their maximum wrote a 100 ms rhythm into noise. Average them,
  interpolate skipped steps, and time the novelty by the audio clock
  (`AudioContext.currentTime`). The audio thread delivers in blocks, so frames without new sound
  must not count.
- **A room's noise has a periodicity of its own** (about 260 ms, from the audio path; correlation
  0.12-0.18). Gate a tempo on an onset rate (one onset per two or three beats), not on
  correlation alone.
- **SuperFlux novelty:** take a band's rise over the maximum of its neighbours a frame ago (Böck
  and Widmer 2013). A sustained bass line's beating partials otherwise read as a pulse. On a
  syncopated groove the beat's clarity rose from 0.13-0.20 to 0.22-0.32.
- **Result on the recordings:**
  - hip-hop 0% -> 99% of the time right;
  - rock 20% -> 75-80%;
  - jazz 27% -> 57%;
  - Beethoven and a room's noise: no tempo, which is correct;
  - techno still wavers between metrically related readings (166, 125, 83).

## Beat phase

- **Restarting the phase on every kick throws it half a beat back** on a syncopated kick.
- **A phase oscillator at the tempo** that onsets nudge (the Kuramoto coupling with one forced
  oscillator) never jumps. On four-on-the-floor it reads within 0.05 of a beat as each kick
  arrives.
- **But the sine coupling has a stable trap at half a beat.** sin(2 pi error) does not pull at
  error 0.5. On a real techno track the off-beat hats held the phase there: 0.43 of a beat off,
  R 0.80. What worked:
  - start the phase on the last kick when a tempo locks;
  - let kicks and snares within 0.3 of a beat pull proportionally (a sawtooth), and hats not at
    all;
  - re-anchor after four kicks in a row away from the beat;
  - keep the oscillator running through a dropout of the tempo instead of restarting it.
- **A plate could show both couplings side by side,** the sine's half-beat trap against the
  sawtooth's escape.

## Key

- **The best-matching triad of the last second is not a key.** It matched the reference key 0-45%
  of the time and changed 9-26 times a minute.
- **Use Krumhansl-Schmuckler key profiles** on the chroma averaged over about 8 s, holding the key
  until another beats it by 0.05 for 2 s. Offline on the same chroma this named the key of 7 of 8
  excerpts, with 1-6 changes a minute.
- **A lone major triad is ambiguous.** F# major read as A# minor. A cadence (I-IV-V) is not.

## Song sections: the page-hinkley kernel on live audio

- **Offline:** on the eight excerpts, a two-sided Page-Hinkley test on z-scored features scored F1
  0.53 (0.49 leave-one-out) against librosa's structural boundaries (within 2 s). The features
  were the loudness, the spectral centroid or brightness, and four band groups, each z-scored
  against its own Welford mean and spread since the last alarm, with up += z - 1, down += z + 1
  and lambda 8. A 3 s against 6 s feature contrast scored 0.34.
- **Live, those parameters fired 7-8 times a minute** on music without sections. Right after a
  reset a steady band's spread is near zero and every wobble is a large z.
- **Live, what held:**
  - a floor of 0.03 on the spread;
  - lambda 10;
  - 3 s to learn after each alarm;
  - at least 6 s between sections.
  That gave 1-4 sections a minute, many on the boundaries: techno 10.4 s against 10.3, drum and
  bass 33.7 against 33.7, Beethoven 55.5 against 55.7.
- **Worth showing on the plate:** the spread floor and the learning time after a reset, which an
  offline stream with a known change point hides.

## Plates this suggests (Signals and sound / Measurement)

- `tempo-autocorrelation`: an onset novelty, its autocorrelation, the comb over multiples and the
  tempo prior, with the octave and 2/3 traps visible. A seeded drum pattern (four-on-the-floor,
  syncopated, swing) and noise as inputs.
- `key-profiles`: a chroma, the 24 rotated profiles and their correlations, with the
  relative-minor and lone-triad ambiguities as presets.
- `superflux-onsets`: spectral flux against its neighbour-maximum variant on a sustained tone with
  vibrato.
