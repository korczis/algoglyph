//! Optimized Bubble Sort (Knuth 1998, TAOCP 3, §5.2.2, Algorithm B): every pass remembers
//! the position of its last swap, and the next pass stops there, because everything after it
//! is already in final position; a pass without swaps ends the sort (best case n - 1
//! comparisons on sorted input). Stable and in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "optimized-bubble-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let mut bound = v.len();
    let mut pass = 0;
    while bound > 1 {
        pass += 1;
        t.phase(&format!("pass {pass}: up to {bound}"));
        let mut last_swap = 0;
        for j in 0..bound - 1 {
            if t.cmp(v, j, j + 1) == Ordering::Greater {
                t.swap(v, j, j + 1);
                last_swap = j + 1;
            }
        }
        t.mark(last_swap, v.len(), "sorted");
        bound = last_swap;
    }
    Outcome::Sorted
}
