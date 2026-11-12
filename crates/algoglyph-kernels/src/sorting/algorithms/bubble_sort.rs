//! Bubble Sort (Knuth 1998, TAOCP 3, §5.2.2, "Algorithm B" without its bound; Astrachan 2003
//! traces the name). The plain textbook form: n - 1 passes over the whole unsorted prefix,
//! each swapping adjacent out-of-order pairs, with no early exit (that refinement is
//! `optimized-bubble-sort`). Stable: only strictly greater neighbours are swapped.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "bubble-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    for pass in 1..n {
        t.phase(&format!("pass {pass}"));
        for j in 0..(n - pass) {
            if t.cmp(v, j, j + 1) == Ordering::Greater {
                t.swap(v, j, j + 1);
            }
        }
        t.mark(n - pass, n, "sorted");
    }
    Outcome::Sorted
}
