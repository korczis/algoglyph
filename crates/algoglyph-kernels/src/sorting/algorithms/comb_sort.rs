//! Comb Sort (Dobosiewicz 1980; popularised by Lacey & Box 1991, "A fast, easy sort", Byte
//! 16(4)): bubble-sort passes compare elements a gap apart; the gap starts at n and shrinks by
//! the factor 1.3 each pass (Lacey & Box's empirical shrink factor), and once it reaches 1 the
//! passes continue until one makes no swap. Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "comb-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let mut gap = n;
    let mut sorted = false;
    while !sorted {
        gap = (gap * 10 / 13).max(1);
        sorted = gap == 1;
        t.phase(&format!("gap {gap}"));
        for i in 0..n.saturating_sub(gap) {
            if t.cmp(v, i, i + gap) == Ordering::Greater {
                t.swap(v, i, i + gap);
                sorted = false;
            }
        }
    }
    Outcome::Sorted
}
