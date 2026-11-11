//! Proportion Extend Sort (Chen 2001, "Proportion Extend Sort", SIAM Journal on Computing
//! 31(1), 323–330). The input is processed as a sorted prefix followed by unsorted elements.
//! While the unsorted part is at most p times the sorted one, the median of the sorted
//! prefix is the pivot: the unsorted part is partitioned around it, a rotation brings the
//! smaller unsorted elements below the pivot and the upper half of the prefix above it, and
//! both sides are extended recursively, each again with a sorted prefix (the lower and the
//! upper half of the old one). Longer unsorted parts are taken in stages of p times the
//! current prefix, which is what bounds the worst case by O(n log n). p = 16 by default
//! (`options.k` overrides). Not stable, in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "proportion-extend-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let p = if opt.k >= 2 { opt.k as usize } else { 16 };
    let n = v.len();
    if n > 1 {
        pe_sort(t, v, 0, 1, n, p);
    }
    Outcome::Sorted
}

/// `[lo, s)` is sorted; sorts `[lo, e)`.
fn pe_sort(t: &mut Tracer, v: &mut [Item], lo: usize, mut s: usize, e: usize, p: usize) {
    if e <= s {
        return;
    }
    if s == lo {
        s = lo + 1;
    }
    while e - s > p * (s - lo) {
        let stage = s + p * (s - lo);
        extend(t, v, lo, s, stage, p);
        s = stage;
    }
    extend(t, v, lo, s, e, p);
}

/// `[lo, s)` is sorted and `e - s <= p (s - lo)`; sorts `[lo, e)`.
fn extend(t: &mut Tracer, v: &mut [Item], lo: usize, s: usize, e: usize, p: usize) {
    if e <= s {
        return;
    }
    t.mark(lo, s, "sorted prefix");
    t.mark(s, e, "extension");
    let m = lo + (s - lo) / 2; // median of the sorted prefix
    let mut q = s;
    for i in s..e {
        if t.cmp(v, i, m) == Ordering::Less {
            if i != q {
                t.swap(v, q, i);
            }
            q += 1;
        }
    }
    // [lo,m) low half | [m,s) pivot + high half | [s,q) smalls | [q,e) larges
    kit::rotate(t, v, m, s, q);
    let np = m + (q - s); // the pivot's final position
    pe_sort(t, v, lo, m, np, p);
    pe_sort(t, v, np + 1, q, e, p);
}
