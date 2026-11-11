//! American Flag Sort (McIlroy, Bostic & McIlroy 1993, "Engineering Radix Sort", Computing
//! Systems 6(1)): an in-place MSD radix sort. For the current byte (keys with the sign bit
//! flipped) the 256 bucket sizes are counted, the bucket boundaries computed, and the
//! elements permuted into their buckets by following cycles: the element at the first
//! unfinished position is swapped into the next free slot of its bucket until an element of
//! the current bucket arrives. Then every bucket is sorted on the next byte. Small piles
//! (below 16 elements) are finished by insertion sort, as the paper recommends for small
//! piles. Not stable, in place (the 256 counters per level are not items).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "american-flag-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Distribution,
};

const SMALL: usize = 16;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    flag(t, v, 0, n, 0);
    Outcome::Sorted
}

fn byte(x: &Item, d: u32) -> usize {
    ((kit::biased(x.key) >> (24 - 8 * d)) & 0xFF) as usize
}

fn flag(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, d: u32) {
    if hi - lo < SMALL {
        kit::insertion(t, v, lo, hi);
        return;
    }
    if d >= 4 {
        return;
    }
    let mut count = [0usize; 256];
    for i in lo..hi {
        let x = t.read(v, i);
        count[byte(&x, d)] += 1;
    }
    let mut start = [0usize; 257];
    start[0] = lo;
    for b in 0..256 {
        start[b + 1] = start[b] + count[b];
    }
    let mut next = [0usize; 256];
    next.copy_from_slice(&start[..256]);
    t.mark(lo, hi, &format!("byte {d}: permute into buckets"));
    for b in 0..256 {
        while next[b] < start[b + 1] {
            let i = next[b];
            let mut x = t.read(v, i);
            let mut bx = byte(&x, d);
            while bx != b {
                let j = next[bx];
                next[bx] += 1;
                t.swap(v, i, j);
                x = v[i];
                bx = byte(&x, d);
            }
            next[b] += 1;
        }
    }
    for b in 0..256 {
        let (a, e) = (start[b], start[b + 1]);
        if e - a > 1 {
            t.mark(a, e, "bucket");
            flag(t, v, a, e, d + 1);
        }
    }
}
