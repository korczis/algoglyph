//! Randomized Quicksort (Cormen et al. 2022, §7.3 RANDOMIZED-QUICKSORT; the random pivot is
//! Hoare's own 1962 suggestion): a uniformly random element (from the seeded generator) is
//! exchanged with the last one and the Lomuto partition of CLRS splits around it. The
//! expected O(n log n) holds for every input. The smaller side recurses, the larger loops.
//! Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "randomized-quicksort",
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
        let q = partition(t, v, lo, hi);
        if q - lo < hi - q {
            if q > lo {
                quick(t, v, lo, q - 1);
            }
            lo = q + 1;
        } else {
            quick(t, v, q + 1, hi);
            if q == lo {
                break;
            }
            hi = q - 1;
        }
    }
}

/// RANDOMIZED-PARTITION: random pivot to `hi`, then Lomuto's scheme.
fn partition(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> usize {
    t.mark(lo, hi + 1, "partition");
    let r = t.rng().range(lo, hi + 1);
    t.swap(v, r, hi);
    let mut i = lo;
    for j in lo..hi {
        if t.cmp(v, j, hi) != Ordering::Greater {
            t.swap(v, i, j);
            i += 1;
        }
    }
    t.swap(v, i, hi);
    i
}
