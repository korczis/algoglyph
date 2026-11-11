//! Quicksort (Hoare 1962, "Quicksort", The Computer Journal 5(1)) with Hoare's own
//! partition scheme: two indices move towards each other from both ends, stopping at
//! elements that are on the wrong side of the pivot, which are then exchanged. The pivot is
//! the middle element (Hoare suggests a random or middle choice; the middle keeps the trace
//! reproducible and avoids the quadratic case on sorted input). The smaller part is sorted
//! recursively and the larger one iteratively, so the stack stays O(log n) (Sedgewick 1978).
//! Not stable, in place; O(n^2) worst case.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "quicksort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n > 1 {
        quick(t, v, 0, n - 1);
    }
    Outcome::Sorted
}

fn quick(t: &mut Tracer, v: &mut [Item], mut lo: usize, mut hi: usize) {
    while lo < hi {
        let j = partition(t, v, lo, hi);
        if j - lo < hi - j {
            quick(t, v, lo, j);
            lo = j + 1;
        } else {
            quick(t, v, j + 1, hi);
            hi = j;
        }
    }
}

/// Hoare partition of `[lo, hi]` (inclusive); returns `j` with `[lo, j] <= pivot <= [j+1, hi]`.
fn partition(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> usize {
    t.mark(lo, hi + 1, "partition");
    let pivot = t.read(v, lo + (hi - lo) / 2);
    let mut i = lo as isize - 1;
    let mut j = hi as isize + 1;
    loop {
        loop {
            i += 1;
            if t.cmp_at(&pivot, v, i as usize) != Ordering::Greater {
                break;
            }
        }
        loop {
            j -= 1;
            if t.cmp_at(&pivot, v, j as usize) != Ordering::Less {
                break;
            }
        }
        if i >= j {
            return j as usize;
        }
        t.swap(v, i as usize, j as usize);
    }
}
