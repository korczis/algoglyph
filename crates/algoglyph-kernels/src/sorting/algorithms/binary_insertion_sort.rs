//! Binary Insertion Sort (Knuth 1998, TAOCP 3, §5.2.1, "binary insertion", attributed to
//! Mauchly 1946): like insertion sort, but the place of the held element in the sorted
//! prefix is found by binary search (after the last equal key, which keeps it stable), so it
//! needs only about n log2 n comparisons; the shifting still costs Θ(n^2) moves. In place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "binary-insertion-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    for i in 1..n {
        let x = t.read(v, i);
        let pos = kit::upper_bound(t, v, 0, i, &x);
        let mut j = i;
        while j > pos {
            let y = v[j - 1];
            t.set(v, j, y);
            j -= 1;
        }
        if pos != i {
            t.set(v, pos, x);
        }
        t.mark(0, i + 1, "sorted prefix");
    }
    Outcome::Sorted
}
