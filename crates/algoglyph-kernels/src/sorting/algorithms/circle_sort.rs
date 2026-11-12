//! Circle Sort (Rosetta Code "Sorting algorithms/Circle sort", after a 2014 description by
//! its author): compare-exchange the first with the last element, the second with the second
//! last, and so on (a "circle"), then recurse into both halves; repeat whole sweeps until one
//! makes no swap. For odd lengths the middle element is compared with its right neighbour.
//! Not stable, in place, O(n log n) per sweep.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "circle-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut sweep = 0;
    loop {
        sweep += 1;
        t.phase(&format!("sweep {sweep}"));
        if circle(t, v, 0, n - 1) == 0 {
            break;
        }
    }
    Outcome::Sorted
}

fn circle(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> usize {
    if lo >= hi {
        return 0;
    }
    t.mark(lo, hi + 1, "circle");
    let mut swaps = 0;
    let (mut l, mut h) = (lo, hi);
    while l < h {
        if t.cmp(v, l, h) == Ordering::Greater {
            t.swap(v, l, h);
            swaps += 1;
        }
        l += 1;
        h -= 1;
    }
    if l == h && h + 1 <= hi && t.cmp(v, l, h + 1) == Ordering::Greater {
        t.swap(v, l, h + 1);
        swaps += 1;
    }
    let mid = lo + (hi - lo) / 2;
    swaps += circle(t, v, lo, mid);
    swaps += circle(t, v, mid + 1, hi);
    swaps
}
