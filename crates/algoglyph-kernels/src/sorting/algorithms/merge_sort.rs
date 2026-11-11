//! Merge Sort (von Neumann 1945, described by Knuth 1998, TAOCP 3, §5.2.4; the form of
//! Cormen et al. 2022, MERGE-SORT / MERGE): split in halves, sort each recursively, and merge
//! by copying both halves into the auxiliary arrays L and R and merging them back. Stable
//! (ties take the left element); the aux peak is n at the top-level merge.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "merge-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    merge_sort(t, v, 0, n);
    Outcome::Sorted
}

fn merge_sort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    if hi - lo < 2 {
        return;
    }
    let mid = lo + (hi - lo) / 2;
    merge_sort(t, v, lo, mid);
    merge_sort(t, v, mid, hi);
    merge(t, v, lo, mid, hi);
}

fn merge(t: &mut Tracer, v: &mut [Item], lo: usize, mid: usize, hi: usize) {
    t.mark(lo, hi, "merge");
    let left: Vec<Item> = (lo..mid).map(|i| t.read(v, i)).collect();
    let right: Vec<Item> = (mid..hi).map(|i| t.read(v, i)).collect();
    t.aux("L", &left);
    t.aux("R", &right);
    let (mut i, mut j) = (0, 0);
    for k in lo..hi {
        let take_left = j == right.len()
            || (i < left.len() && t.cmp_items(&left[i], &right[j]) != Ordering::Greater);
        if take_left {
            t.set(v, k, left[i]);
            i += 1;
        } else {
            t.set(v, k, right[j]);
            j += 1;
        }
    }
    t.aux_clear("L");
    t.aux_clear("R");
}
