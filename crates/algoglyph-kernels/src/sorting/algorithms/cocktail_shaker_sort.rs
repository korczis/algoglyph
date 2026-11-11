//! Cocktail Shaker Sort (Knuth 1998, TAOCP 3, §5.2.2 "cocktail-shaker sort", exercise 5.2.2-
//! 20): bubble sort passes alternate direction, left-to-right then right-to-left, and both
//! ends shrink to the position of the last swap, so small elements near the end ("turtles")
//! move quickly. Stable and in place; stops after a pass without swaps.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "cocktail-shaker-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let (mut lo, mut hi) = (0usize, n - 1);
    while lo < hi {
        t.phase("forward pass");
        let mut last = lo;
        for j in lo..hi {
            if t.cmp(v, j, j + 1) == Ordering::Greater {
                t.swap(v, j, j + 1);
                last = j;
            }
        }
        hi = last;
        t.mark(hi + 1, n, "sorted");
        if lo >= hi {
            break;
        }
        t.phase("backward pass");
        let mut first = hi;
        for j in (lo..hi).rev() {
            if t.cmp(v, j, j + 1) == Ordering::Greater {
                t.swap(v, j, j + 1);
                first = j + 1;
            }
        }
        lo = first;
        t.mark(0, lo, "sorted");
    }
    Outcome::Sorted
}
