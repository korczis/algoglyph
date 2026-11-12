//! SkaSort (Skarupke 2016, "I Wrote a Faster Sorting Algorithm", probablydance.com, code
//! github.com/skarupke/ska_sort): an in-place MSD radix sort on bytes (keys with the sign bit
//! flipped, most significant byte first). Like American flag sort it counts the 256 bucket
//! sizes and moves elements into their buckets by swaps, but its loop is "ska_byte_sort": it
//! walks over the remaining unfinished buckets and, for every element of a bucket's unsorted
//! part, swaps it straight into the next free slot of its own bucket; the walk repeats until
//! every bucket is complete, which avoids American flag sort's serial dependency on the
//! element just swapped in. A byte on which all keys agree is skipped. Buckets then recurse
//! on the next byte; small ones are sorted by a comparison sort (`std::sort`, here the kit
//! introsort).
//!
//! Simplified: ska_sort switches to `std::sort` below 128 elements and to American flag sort
//! below 1024; here the comparison threshold is 16 by default (`options.k` sets it) and
//! ska_byte_sort is used above it, so the radix passes are visible on small inputs. Not
//! stable, in place (the 256 counters per level are not items).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "skasort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let small = if opt.k >= 2 { opt.k as usize } else { 16 };
    let n = v.len();
    ska(t, v, 0, n, 0, small);
    Outcome::Sorted
}

fn byte(x: &Item, d: u32) -> usize {
    ((kit::biased(x.key) >> (24 - 8 * d)) & 0xFF) as usize
}

fn ska(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, mut d: u32, small: usize) {
    if hi - lo <= small {
        kit::std_sort(t, v, lo, hi);
        return;
    }
    let mut count: [usize; 256];
    loop {
        if d >= 4 {
            return;
        }
        count = [0usize; 256];
        for i in lo..hi {
            let x = t.read(v, i);
            count[byte(&x, d)] += 1;
        }
        if count.iter().any(|&c| c == hi - lo) {
            d += 1; // every key shares this byte
            continue;
        }
        break;
    }
    let mut offset = [0usize; 256];
    let mut next_offset = [0usize; 256];
    let mut acc = lo;
    for b in 0..256 {
        offset[b] = acc;
        acc += count[b];
        next_offset[b] = acc;
    }
    let bounds = offset;
    t.mark(lo, hi, &format!("ska_byte_sort on byte {d}"));
    let mut remaining: Vec<usize> = (0..256).filter(|&b| count[b] > 0).collect();
    while !remaining.is_empty() {
        let mut still = Vec::with_capacity(remaining.len());
        for &b in &remaining {
            let (start, end) = (offset[b], next_offset[b]);
            for it in start..end {
                let target = byte(&t.read(v, it), d);
                let o = offset[target];
                offset[target] += 1;
                t.swap(v, it, o);
            }
            if offset[b] != next_offset[b] {
                still.push(b);
            }
        }
        remaining = still;
    }
    for b in 0..256 {
        let (a, e) = (bounds[b], next_offset[b]);
        if e - a > 1 {
            ska(t, v, a, e, d + 1, small);
        }
    }
}
