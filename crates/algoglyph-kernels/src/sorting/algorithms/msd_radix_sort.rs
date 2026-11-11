//! MSD Radix Sort (Sedgewick & Wayne 2011, *Algorithms* 4th ed., §5.1 `MSD`; Knuth 1998,
//! §5.2.5): the most significant byte first (keys with the sign bit flipped, 4 bytes):
//! key-indexed counting distributes the range into 256 sub-ranges through an auxiliary
//! array (aux `aux`), the result is copied back, and every sub-range is sorted recursively on
//! the next byte. Sub-ranges of at most 15 elements are finished by insertion sort, as in
//! Sedgewick & Wayne (CUTOFF = 15). Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "msd-radix-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Distribution,
};

const R: usize = 256;
const CUTOFF: usize = 15;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    msd(t, v, 0, n, 0);
    t.aux_clear("aux");
    Outcome::Sorted
}

fn byte(x: &Item, d: u32) -> usize {
    ((kit::biased(x.key) >> (24 - 8 * d)) & 0xFF) as usize
}

fn msd(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, d: u32) {
    if hi - lo <= CUTOFF {
        kit::insertion(t, v, lo, hi);
        return;
    }
    if d >= 4 {
        return;
    }
    t.mark(lo, hi, &format!("byte {d}"));
    let mut count = [0usize; R + 1];
    for i in lo..hi {
        let x = t.read(v, i);
        count[byte(&x, d) + 1] += 1;
    }
    for r in 0..R {
        count[r + 1] += count[r];
    }
    let mut aux = vec![Item::default(); hi - lo];
    let mut next = count;
    for i in lo..hi {
        let x = t.read(v, i);
        let b = byte(&x, d);
        aux[next[b]] = x;
        next[b] += 1;
    }
    t.aux("aux", &aux);
    kit::write_back(t, v, lo, &aux);
    for r in 0..R {
        let (a, b) = (lo + count[r], lo + count[r + 1]);
        if b - a > 1 {
            msd(t, v, a, b, d + 1);
        }
    }
}
