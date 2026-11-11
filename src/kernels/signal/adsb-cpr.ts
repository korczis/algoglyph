import { gaussian } from '../../core/random';
import { mulberry32 } from '../../engines/signal/input';
import type { SignalKernel, View, XYPanel } from '../../engines/signal/trace';
import { cprDecode, cprEncode, demodulate, fields, hex, modulate, NL, positionFrame, repair,
  syndrome } from './_adsb';

const LEAD = 24; // samples of noise before each frame
const R = 6371008.8;
const GAP = 8; // seconds of flight between two reports, within the usual 10 s pairing limit

/** Great-circle distance in metres. */
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2
    + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Received magnitude: the PPM pulses with complex Gaussian noise at the given SNR. */
function receive(f: Uint8Array, snrDb: number, rnd: () => number): Float64Array {
  const clean = modulate(f);
  const sigma = Math.sqrt(1 / 10 ** (snrDb / 10) / 2);
  return Float64Array.from({ length: LEAD + clean.length + 8 }, (_, i) => {
    const s = clean[i - LEAD] ?? 0;
    return Math.hypot(s + sigma * gaussian(rnd), sigma * gaussian(rnd));
  });
}

// An aircraft flies a seeded track and squitters even and odd position reports in turn. Each frame is received in noise, sliced into bits, checked (and if one bit is damaged,
// repaired) by its CRC-24, and every fresh even/odd pair is decoded into a global position.
export const kernel: SignalKernel = {
  rate: 3,
  params: [{ kind: 'range', key: 'snr', label: 'Receiver SNR (dB)', min: 4, max: 30, step: 1, value: 11 }],
  run(params, seed, meter): View[] {
    const rnd = mulberry32(seed);
    const icao = Math.floor(rnd() * 0xffffff);
    let lat = 35 + rnd() * 25; let lon = -10 + rnd() * 40;
    const heading = rnd() * 2 * Math.PI;
    const alt = 25 * Math.round((20000 + rnd() * 18000) / 25);
    const speed = 240; // m/s
    const snr = Number(params.snr);
    const truthTrack: number[] = []; const decodedTrack: number[] = [];
    const errors: [number, number][] = [];
    const last: { 0?: [number, number]; 1?: [number, number] } = {};
    let ok = 0; let repaired = 0; let dropped = 0;
    const views: View[] = [];
    const frames = 24;
    const lat0 = lat; const lon0 = lon;
    for (let k = 0; k < frames; k++) {
      // time-lapse: GAP seconds of flight between reports, so the track shows against the zones
      const d = ((speed * GAP) / R) * (180 / Math.PI);
      lat += d * Math.cos(heading); lon += (d * Math.sin(heading)) / Math.cos((lat * Math.PI) / 180);
      truthTrack.push(lon, lat);
      const odd = (k % 2) as 0 | 1;
      const sent = positionFrame(icao, alt, cprEncode(lat, lon, odd), odd, meter);
      const mag = receive(sent, snr, rnd);
      const { start, frame } = demodulate(mag, LEAD + 8, meter);
      const wrong = Array.from(frame).reduce((s, b, i) => s + popcount(b ^ sent[i]), 0);
      const syn = syndrome(frame, meter);
      const fixed = repair(frame, meter);
      let decoded: { lat: number; lon: number } | null = null;
      let status: string;
      if (fixed === null) { dropped++; status = `CRC failed (syndrome ${syn.toString(16).toUpperCase()}), frame dropped`; } else {
        if (fixed >= 0) repaired++;
        ok++;
        status = fixed >= 0 ? `syndrome ${syn.toString(16).toUpperCase()}: bit ${fixed} repaired` : 'CRC remainder 0';
        const fl = fields(frame);
        last[fl.odd] = fl.cpr;
        if (last[0] && last[1]) decoded = cprDecode(last[0], last[1], fl.odd);
      }
      let err = NaN;
      if (decoded) {
        err = haversine(decoded, { lat, lon });
        decodedTrack.push(decoded.lon, decoded.lat);
        errors.push([k + 1, err]);
      }
      const fl = fields(frame);
      const nl = NL(lat);
      // the CPR zone boundaries near the aircraft: latitude zones of 6° (even) and 360/59° (odd),
      // longitude zones of 360/NL (even) and 360/(NL−1) (odd) at this latitude
      const box: [number, number, number, number] = [lon0 - 6, lon0 + 6, lat0 - 3.5, lat0 + 3.5];
      const lines: XYPanel['lines'] = [];
      for (const [dl, tone] of [[6, 0.25], [360 / 59, 0.8]] as [number, number][]) {
        for (let z = Math.floor(box[2] / dl); z * dl <= box[3]; z++) lines.push({ pts: [box[0], z * dl, box[1], z * dl], tone, weight: 1, alpha: 120 });
      }
      for (const [dl, tone] of [[360 / nl, 0.25], [360 / Math.max(1, nl - 1), 0.8]] as [number, number][]) {
        for (let z = Math.floor(box[0] / dl); z * dl <= box[1]; z++) lines.push({ pts: [z * dl, box[2], z * dl, box[3]], tone, weight: 1, alpha: 120 });
      }
      lines.push({ pts: truthTrack.slice(), tone: -1, weight: 1.5, alpha: 150 });
      const dots = [];
      for (let i = 0; i + 1 < decodedTrack.length; i += 2) dots.push({ x: decodedTrack[i], y: decodedTrack[i + 1], tone: 0.6, r: 3 });
      const zoom: [number, number, number, number] = [lon0 - 0.35, lon0 + 0.35, lat0 - 0.25, lat0 + 0.25];
      const meanErr = errors.length ? errors.reduce((s, e) => s + e[1], 0) / errors.length : NaN;
      views.push({
        layout: [[0, 1], [2, 3]],
        panels: [
          { kind: 'wave', title: `Frame ${k + 1}: received pulses, preamble at sample ${start}`, range: [0, 1.6],
            series: [{ name: '|r|', y: mag, tone: 0.7 }], marks: [{ at: start, label: 'preamble' }, { at: start + 16, label: 'data' }] },
          { kind: 'text', title: 'Bits, fields and parity', lines: [
            { text: hex(frame), tone: 0.7 },
            { text: `DF ${fl.df}  CA ${fl.ca}  ICAO ${fl.icao.toString(16).toUpperCase().padStart(6, '0')}  TC ${fl.tc}` },
            { text: `ALT ${Number.isFinite(fl.alt) ? fl.alt : '?'} ft  ${fl.odd ? 'odd' : 'even'}  LAT-CPR ${fl.cpr[0]}  LON-CPR ${fl.cpr[1]}` },
            { text: `${wrong} bit${wrong === 1 ? '' : 's'} damaged in reception; ${status}`, tone: fixed === null ? 0.95 : 0.3 },
          ] },
          { kind: 'xy', title: 'CPR zones near the aircraft: even and odd; track and decoded fixes', range: box, equal: false, lines, dots,
            xLabel: 'longitude (°)', yLabel: 'latitude (°)' },
          { kind: 'xy', title: 'Close up: true track and decoded fixes', range: zoom, lines: [{ pts: truthTrack.slice(), tone: -1, weight: 1.5, alpha: 150 }], dots,
            xLabel: 'longitude (°)', yLabel: 'latitude (°)' },
        ],
        stats: [
          { label: 'True position', value: `${lat.toFixed(5)}, ${lon.toFixed(5)}` },
          { label: 'Decoded position', value: decoded ? `${decoded.lat.toFixed(5)}, ${decoded.lon.toFixed(5)}` : 'waiting for an even/odd pair' },
          { label: 'Decoding error', value: Number.isFinite(err) ? `${err.toFixed(2)} m` : '—' },
          { label: 'Mean error over decoded fixes', value: Number.isFinite(meanErr) ? `${meanErr.toFixed(2)} m` : '—' },
          { label: 'Frames: passed CRC, of them repaired, dropped', value: `${ok}, ${repaired}, ${dropped}` },
          { label: 'Longitude zones NL(lat)', value: String(nl) },
          { label: 'Altitude decoded vs sent', value: fixed === null ? 'frame dropped' : `${fl.alt} vs ${alt} ft` },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Decoding error per fix', x: { label: 'frame' }, y: { label: 'error (m)' }, series: [{ name: 'great-circle error', points: errors.slice() }] },
      });
    }
    return views;
  },
};

function popcount(b: number): number {
  let c = 0;
  for (; b; b &= b - 1) c++;
  return c;
}
