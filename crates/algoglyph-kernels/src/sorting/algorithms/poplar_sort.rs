//! Poplar Sort (Bron & Hesselink 1991, "Smoothsort revisited", Information Processing
//! Letters 39(5)). A simplification of smoothsort: the array is a sequence of "poplars",
//! perfect binary max-heaps of 2^k - 1 elements stored in post-order (root last), with
//! non-increasing sizes. A new element becomes the root of the last two poplars when they
//! have equal size (and is sifted down), otherwise a poplar of its own. Sorting repeatedly
//! takes the largest of the O(log n) poplar roots, exchanges it with the last root, sifts the
//! exchanged value down in its poplar, and removes the last element (splitting its poplar
//! into its two children). Not stable, in place (the list of poplar sizes is O(log n)).
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "poplar-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    // poplars as (start, size); size = 2^k - 1
    let mut pops: Vec<(usize, usize)> = Vec::new();
    t.phase("grow poplars");
    for i in 0..n {
        let len = pops.len();
        if len >= 2 && pops[len - 1].1 == pops[len - 2].1 {
            let (start, s) = pops[len - 2];
            pops.pop();
            pops.pop();
            pops.push((start, 2 * s + 1));
            sift(t, v, start, 2 * s + 1);
        } else {
            pops.push((i, 1));
        }
    }
    t.phase("select maxima among the roots");
    for end in (1..n).rev() {
        // the largest root
        let last = pops.len() - 1;
        let mut best = last;
        for p in 0..last {
            let (sp, zp) = pops[p];
            let (sb, zb) = pops[best];
            if t.cmp(v, sp + zp - 1, sb + zb - 1) == Ordering::Greater {
                best = p;
            }
        }
        if best != last {
            let (sb, zb) = pops[best];
            t.swap(v, sb + zb - 1, end);
            sift(t, v, sb, zb);
        }
        // remove the last element (the root of the last poplar)
        let (start, size) = pops.pop().unwrap();
        if size > 1 {
            let h = (size - 1) / 2;
            pops.push((start, h));
            pops.push((start + h, h));
        }
        t.mark(end, n, "sorted");
    }
    Outcome::Sorted
}

/// Sift-down of the root of the poplar `[start, start+size)` (post-order layout).
fn sift(t: &mut Tracer, v: &mut [Item], mut start: usize, mut size: usize) {
    while size > 1 {
        let h = (size - 1) / 2;
        let root = start + size - 1;
        let l = start + h - 1;
        let r = start + 2 * h - 1;
        let (c, cs) = if t.cmp(v, l, r) == Ordering::Greater {
            (l, start)
        } else {
            (r, start + h)
        };
        if t.cmp(v, root, c) != Ordering::Less {
            return;
        }
        t.swap(v, root, c);
        start = cs;
        size = h;
    }
}
