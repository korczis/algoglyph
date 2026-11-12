// Mode S extended squitter (DF17) airborne position messages: the CRC-24 parity, the compact
// position report (CPR) encoding of latitude and longitude in 17 bits each, its global decoding
// from an even and an odd frame, and the pulse-position modulation the frames travel in.
import type { Meter } from '../../engines/signal/trace';

export const GENERATOR = 0x1fff409;
const NZ = 15;
const B17 = 1 << 17;

/** CRC-24 remainder of the first `bits` bits of a frame (byte-aligned). */
export function crc24(bytes: Uint8Array, bits = 88, meter?: Meter): number {
  let crc = 0;
  for (let i = 0; i < bits / 8; i++) {
    crc ^= bytes[i] << 16;
    for (let b = 0; b < 8; b++) {
      crc <<= 1;
      if (crc & 0x1000000) crc ^= GENERATOR;
    }
  }
  meter?.add('CRC bit steps', bits);
  return crc & 0xffffff;
}

/** The parity field read from a 112-bit frame's last three bytes. */
export const parity = (f: Uint8Array): number => (f[11] << 16) | (f[12] << 8) | f[13];
/** Zero for an undamaged DF17 frame. */
export const syndrome = (f: Uint8Array, meter?: Meter): number => crc24(f, 88, meter) ^ parity(f);

export function hex(f: Uint8Array): string {
  return Array.from(f, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function fromHex(s: string): Uint8Array {
  return Uint8Array.from({ length: s.length / 2 }, (_, i) => parseInt(s.slice(2 * i, 2 * i + 2), 16));
}

export function bitsOf(f: Uint8Array, from: number, len: number): number {
  let v = 0;
  for (let i = from; i < from + len; i++) v = v * 2 + ((f[i >> 3] >> (7 - (i & 7))) & 1);
  return v;
}

export function setBits(f: Uint8Array, from: number, len: number, v: number): void {
  for (let i = 0; i < len; i++) {
    const bit = Math.floor(v / 2 ** (len - 1 - i)) % 2;
    const at = from + i;
    if (bit) f[at >> 3] |= 1 << (7 - (at & 7));
    else f[at >> 3] &= ~(1 << (7 - (at & 7)));
  }
}

export const flip = (f: Uint8Array, i: number): void => { f[i >> 3] ^= 1 << (7 - (i & 7)); };

const mod = (x: number, y: number) => x - y * Math.floor(x / y);

/** The number of longitude zones at a latitude. */
export function NL(lat: number): number {
  const a = Math.abs(lat);
  if (a === 0) return 59;
  if (a === 87) return 2;
  if (a > 87) return 1;
  const c = 1 - (1 - Math.cos(Math.PI / (2 * NZ))) / Math.cos((Math.PI / 180) * a) ** 2;
  if (c <= -1) return 1;
  return Math.floor((2 * Math.PI) / Math.acos(c));
}

/** Airborne CPR encoding of a position; i = 0 even, 1 odd. Returns [lat-cpr, lon-cpr]. */
export function cprEncode(lat: number, lon: number, i: 0 | 1): [number, number] {
  const dLat = 360 / (4 * NZ - i);
  const yz = Math.floor((B17 * mod(lat, dLat)) / dLat + 0.5);
  const rlat = dLat * (yz / B17 + Math.floor(lat / dLat));
  const dLon = 360 / Math.max(NL(rlat) - i, 1);
  const xz = Math.floor((B17 * mod(lon, dLon)) / dLon + 0.5);
  return [mod(yz, B17), mod(xz, B17)];
}

/** Global decoding from an even and an odd report; `newest` says which arrived last. */
export function cprDecode(even: [number, number], odd: [number, number], newest: 0 | 1): { lat: number; lon: number } | null {
  const [le, ge] = [even[0] / B17, even[1] / B17];
  const [lo, go] = [odd[0] / B17, odd[1] / B17];
  const dE = 360 / 60; const dO = 360 / 59;
  const j = Math.floor(59 * le - 60 * lo + 0.5);
  let latE = dE * (mod(j, 60) + le);
  let latO = dO * (mod(j, 59) + lo);
  if (latE >= 270) latE -= 360;
  if (latO >= 270) latO -= 360;
  if (NL(latE) !== NL(latO)) return null;
  const lat = newest === 0 ? latE : latO;
  const nl = NL(lat);
  const ni = Math.max(nl - newest, 1);
  const m = Math.floor(ge * (nl - 1) - go * nl + 0.5);
  let lon = (360 / ni) * (mod(m, ni) + (newest === 0 ? ge : go));
  if (lon >= 180) lon -= 360;
  return { lat, lon };
}

/** A DF17 airborne position frame (type code 11, barometric altitude in 25 ft steps). */
export function positionFrame(icao: number, altFt: number, cpr: [number, number], odd: 0 | 1, meter?: Meter): Uint8Array {
  const f = new Uint8Array(14);
  setBits(f, 0, 5, 17);
  setBits(f, 5, 3, 5);
  setBits(f, 8, 24, icao);
  setBits(f, 32, 5, 11);
  const n = Math.round((altFt + 1000) / 25);
  setBits(f, 40, 12, ((n >> 4) << 5) | 0x10 | (n & 0xf));
  setBits(f, 53, 1, odd);
  setBits(f, 54, 17, cpr[0]);
  setBits(f, 71, 17, cpr[1]);
  setBits(f, 88, 24, crc24(f, 88, meter));
  return f;
}

export interface Fields { df: number; ca: number; icao: number; tc: number; alt: number; odd: 0 | 1; cpr: [number, number] }

export function fields(f: Uint8Array): Fields {
  const a = bitsOf(f, 40, 12);
  const n = ((a >> 5) << 4) | (a & 0xf);
  return {
    df: bitsOf(f, 0, 5), ca: bitsOf(f, 5, 3), icao: bitsOf(f, 8, 24), tc: bitsOf(f, 32, 5),
    alt: a & 0x10 ? n * 25 - 1000 : NaN, odd: bitsOf(f, 53, 1) as 0 | 1, cpr: [bitsOf(f, 54, 17), bitsOf(f, 71, 17)],
  };
}

/** The syndrome each single-bit error leaves, so one damaged bit can be found and repaired. */
const SINGLE = (() => {
  const table = new Map<number, number>();
  for (let i = 0; i < 112; i++) {
    const f = new Uint8Array(14);
    flip(f, i);
    table.set(syndrome(f), i);
  }
  return table;
})();

/** Repair at most one bit in place; returns the bit repaired, -1 if none was needed, null if beyond. */
export function repair(f: Uint8Array, meter?: Meter): number | null {
  const s = syndrome(f, meter);
  if (s === 0) return -1;
  const i = SINGLE.get(s);
  if (i === undefined) return null;
  flip(f, i);
  return i;
}

export const PREAMBLE = [1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0];

/** Pulse-position modulation at 2 samples per microsecond: preamble, then 1 → high-low, 0 → low-high. */
export function modulate(f: Uint8Array): Float64Array {
  const out = new Float64Array(PREAMBLE.length + 224);
  PREAMBLE.forEach((v, i) => { out[i] = v; });
  for (let i = 0; i < 112; i++) {
    const b = (f[i >> 3] >> (7 - (i & 7))) & 1;
    out[16 + 2 * i] = b; out[17 + 2 * i] = 1 - b;
  }
  return out;
}

/** Find the preamble by correlation within `search` samples, then slice each bit's two halves. */
export function demodulate(mag: Float64Array, search: number, meter?: Meter): { start: number; frame: Uint8Array } {
  let best = 0; let start = 0;
  for (let s = 0; s <= search; s++) {
    let c = 0;
    for (let i = 0; i < PREAMBLE.length; i++) c += (PREAMBLE[i] ? 1 : -1) * mag[s + i];
    if (c > best) { best = c; start = s; }
  }
  meter?.add('Samples compared', (search + 1) * PREAMBLE.length + 224);
  const f = new Uint8Array(14);
  for (let i = 0; i < 112; i++) if (mag[start + 16 + 2 * i] > mag[start + 17 + 2 * i]) f[i >> 3] |= 1 << (7 - (i & 7));
  return { start, frame: f };
}
