//! Exchange Sort (the "sorting by exchanging" of Knuth 1998, §5.2.2, in its simplest form):
//! position i is compared with every later position j and exchanged whenever v[j] < v[i], so
//! after the inner loop v[i] is the minimum of the rest. Always n(n-1)/2 comparisons. Not
//! stable (long-distance exchanges), in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "exchange-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    for i in 0..n {
        for j in (i + 1)..n {
            if t.cmp(v, j, i) == Ordering::Less {
                t.swap(v, i, j);
            }
        }
        t.mark(0, i + 1, "sorted");
    }
    Outcome::Sorted
}
