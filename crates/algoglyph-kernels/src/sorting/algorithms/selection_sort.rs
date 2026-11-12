//! Selection Sort (Knuth 1998, TAOCP 3, §5.2.3, "straight selection", Algorithm S; Cormen et
//! al. 2022, exercise 2.2-2): position i receives the minimum of the unsorted rest, found by a
//! linear scan and moved there by one exchange. Exactly n(n-1)/2 comparisons and at most
//! n - 1 exchanges. Not stable (the exchange can jump over equal keys), in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "selection-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    for i in 0..n.saturating_sub(1) {
        let mut m = i;
        for j in (i + 1)..n {
            if t.cmp(v, j, m) == Ordering::Less {
                m = j;
            }
        }
        if m != i {
            t.swap(v, i, m);
        }
        t.mark(0, i + 1, "sorted");
    }
    Outcome::Sorted
}
