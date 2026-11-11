//! Natural Merge Sort (Knuth 1998, TAOCP 3, §5.2.4, "natural two-way merge sort", Algorithm
//! N): the input is split into its maximal non-decreasing runs, and passes merge adjacent
//! pairs of runs until one is left. A sorted input is one run (n - 1 comparisons); r runs
//! need ⌈log2 r⌉ passes. Merges copy the smaller run to aux `buffer`. Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "natural-merge-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    t.phase("find natural runs");
    let mut bounds = vec![0usize];
    let mut i = 0;
    while i < n {
        let end = kit::weak_run(t, v, i, n);
        t.mark(i, end, "run");
        bounds.push(end);
        i = end;
    }
    let mut pass = 0;
    while bounds.len() > 2 {
        pass += 1;
        t.phase(&format!("pass {pass}: {} runs", bounds.len() - 1));
        let mut next = vec![0usize];
        let mut r = 0;
        while r + 2 < bounds.len() {
            let (lo, mid, hi) = (bounds[r], bounds[r + 1], bounds[r + 2]);
            t.mark(lo, hi, "merge");
            kit::merge(t, v, lo, mid, hi, "buffer");
            next.push(hi);
            r += 2;
        }
        if r + 1 < bounds.len() {
            next.push(bounds[r + 1]);
        }
        bounds = next;
    }
    Outcome::Sorted
}
