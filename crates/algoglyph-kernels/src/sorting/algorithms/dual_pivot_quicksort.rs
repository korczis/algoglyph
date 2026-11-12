//! Dual-Pivot Quicksort (Yaroslavskiy 2009, "Dual-Pivot Quicksort", the algorithm adopted
//! for primitives in Java 7; analysed by Wild & Nebel 2012): two pivots P1 <= P2 (here the
//! tertile elements, moved to the ends as in Yaroslavskiy's paper) split the range in one
//! scan into < P1, P1..P2 and > P2, with indices `less`, `k` and `great`. The middle part is
//! skipped when P1 == P2 (all of it equals the pivots). Ranges shorter than 17 use insertion
//! sort, as in the paper. Java 7's later tuning (five-sample pivots, equal-key handling,
//! pair insertion sort) is not included. Not stable, in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "dual-pivot-quicksort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const TINY: usize = 17;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n > 1 {
        dual(t, v, 0, n - 1);
    }
    Outcome::Sorted
}

fn dual(t: &mut Tracer, v: &mut [Item], left: usize, right: usize) {
    let len = right - left + 1;
    if len < TINY {
        kit::insertion(t, v, left, right + 1);
        return;
    }
    t.mark(left, right + 1, "partition");
    let third = len / 3;
    t.swap(v, left + third, left);
    t.swap(v, right - third, right);
    if t.cmp(v, left, right) == Ordering::Greater {
        t.swap(v, left, right);
    }
    // P1 = v[left], P2 = v[right]
    let mut less = left + 1;
    let mut great = right - 1;
    let mut k = less;
    while k <= great {
        if t.cmp(v, k, left) == Ordering::Less {
            t.swap(v, k, less);
            less += 1;
        } else if t.cmp(v, k, right) == Ordering::Greater {
            while k < great && t.cmp(v, great, right) == Ordering::Greater {
                great -= 1;
            }
            t.swap(v, k, great);
            great -= 1;
            if t.cmp(v, k, left) == Ordering::Less {
                t.swap(v, k, less);
                less += 1;
            }
        }
        k += 1;
    }
    less -= 1;
    great += 1;
    t.swap(v, left, less);
    t.swap(v, right, great);
    if less > left + 1 {
        dual(t, v, left, less - 1);
    }
    if great + 1 < right {
        dual(t, v, great + 1, right);
    }
    if great > less + 1 && t.cmp(v, less, great) == Ordering::Less {
        dual(t, v, less + 1, great - 1);
    }
}
