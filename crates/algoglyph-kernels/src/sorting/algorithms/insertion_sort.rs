//! Insertion Sort (Knuth 1998, TAOCP 3, §5.2.1, "straight insertion", Algorithm S; Cormen et
//! al. 2022, §2.1 INSERTION-SORT): each element is taken out (held), the larger elements of
//! the sorted prefix are shifted one place right, and the held element is written into the
//! gap. Θ(n^2) worst case, Θ(n) on sorted input, Θ(n + inversions) in general. Stable (the
//! shift stops at an equal key), in place, online.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "insertion-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    for i in 1..n {
        let key = t.read(v, i);
        let mut j = i;
        while j > 0 && t.cmp_at(&key, v, j - 1) == Ordering::Less {
            let y = v[j - 1];
            t.set(v, j, y);
            j -= 1;
        }
        if j != i {
            t.set(v, j, key);
        }
        t.mark(0, i + 1, "sorted prefix");
    }
    Outcome::Sorted
}
