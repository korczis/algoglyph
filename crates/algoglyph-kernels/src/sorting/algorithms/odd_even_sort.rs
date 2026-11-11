//! Odd-Even Sort / Brick Sort (Habermann 1972, "Parallel neighbor-sort", Carnegie Mellon
//! tech. report; Knuth 1998, §5.3.4): phases alternate between comparing the pairs (even,
//! odd) and (odd, even). Every compare-exchange of a phase is independent, so a phase is one
//! parallel round with one lane per pair; n rounds suffice. Simulated in one thread, the
//! trace shows rounds and lanes. Stable (only adjacent strictly-greater pairs swap).
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "odd-even-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut sorted = false;
    let mut quiet = 0;
    while !sorted {
        sorted = true;
        for start in [1usize, 0] {
            t.round();
            t.phase(if start == 0 {
                "even phase"
            } else {
                "odd phase"
            });
            let mut swapped = false;
            let mut i = start;
            while i + 1 < n {
                t.lane((i / 2) as u32);
                if t.cmp(v, i, i + 1) == Ordering::Greater {
                    t.swap(v, i, i + 1);
                    swapped = true;
                }
                i += 2;
            }
            if swapped {
                sorted = false;
                quiet = 0;
            } else {
                quiet += 1;
            }
        }
        if quiet >= 2 {
            break;
        }
    }
    Outcome::Sorted
}
