//! Top-Down Merge Sort (Sedgewick & Wayne 2011, *Algorithms* 4th ed., §2.2, `Merge`): the
//! recursive merge sort with one auxiliary array of n elements allocated once (aux `aux`):
//! each merge copies `[lo, hi)` into it and merges back into the array. The merge is skipped
//! when the two halves are already in order (v[mid-1] <= v[mid]), the improvement Sedgewick &
//! Wayne list, which makes sorted input linear. Stable, not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "top-down-merge-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut aux = vec![Item::default(); n];
    rec(t, v, &mut aux, 0, n);
    t.aux_clear("aux");
    Outcome::Sorted
}

fn rec(t: &mut Tracer, v: &mut [Item], aux: &mut [Item], lo: usize, hi: usize) {
    if hi - lo < 2 {
        return;
    }
    let mid = lo + (hi - lo) / 2;
    rec(t, v, aux, lo, mid);
    rec(t, v, aux, mid, hi);
    if t.cmp(v, mid - 1, mid) != Ordering::Greater {
        return;
    }
    t.mark(lo, hi, "merge");
    for k in lo..hi {
        aux[k] = t.read(v, k);
    }
    t.aux("aux", &aux[lo..hi]);
    let (mut i, mut j) = (lo, mid);
    for k in lo..hi {
        if i >= mid {
            t.set(v, k, aux[j]);
            j += 1;
        } else if j >= hi || t.cmp_items(&aux[i], &aux[j]) != Ordering::Greater {
            t.set(v, k, aux[i]);
            i += 1;
        } else {
            t.set(v, k, aux[j]);
            j += 1;
        }
    }
}
