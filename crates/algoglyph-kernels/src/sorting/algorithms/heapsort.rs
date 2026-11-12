//! Heapsort (Williams 1964, CACM Algorithm 232; heap construction by Floyd 1964, CACM Algorithm 245).
//! A binary max-heap is built bottom-up in the array (Floyd), then the maximum is swapped to
//! the end and the root sifted down, n - 1 times. Not stable, in place, O(n log n) always.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "heapsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    t.phase("build max-heap (Floyd)");
    for root in (0..n / 2).rev() {
        kit::sift_down(t, v, 0, root, n);
    }
    t.mark(0, n, "heap");
    t.phase("extract maxima");
    for end in (1..n).rev() {
        t.swap(v, 0, end);
        kit::sift_down(t, v, 0, 0, end);
        t.mark(end, n, "sorted");
    }
    Outcome::Sorted
}
