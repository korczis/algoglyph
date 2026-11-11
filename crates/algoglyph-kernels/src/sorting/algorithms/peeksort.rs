//! Peeksort (Munro & Wild 2018, "Nearly-Optimal Mergesorts", ESA, LIPIcs 112; Algorithm
//! "PeekSort(A[ℓ..r], e, s)"). A top-down merge sort that splits not at the middle but at the
//! run boundary closest to it: it "peeks" at the run containing the midpoint (extending it
//! left and right) and splits at whichever end of that run is nearer to the middle. The
//! known runs at both ends (ending at e, starting at s) are passed down so no run is scanned
//! twice. Runs are weakly increasing. Merges copy the smaller run to aux `buffer`. Nearly
//! optimal merge cost, Θ(n) on sorted input. Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "peeksort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    // e = last index of the run starting at 0, s = first index of the run ending at n - 1
    let e = kit::weak_run(t, v, 0, n) - 1;
    let mut s = n - 1;
    while s > 0 && t.cmp(v, s - 1, s) != Ordering::Greater {
        s -= 1;
    }
    peek(t, v, 0, n - 1, e, s);
    Outcome::Sorted
}

/// Sorts `v[l..=r]` where `v[l..=e]` and `v[s..=r]` are runs.
fn peek(t: &mut Tracer, v: &mut [Item], l: usize, r: usize, e: usize, s: usize) {
    if e >= r || s <= l {
        return;
    }
    t.mark(l, r + 1, "peeksort");
    let m = l + (r - l) / 2;
    if m <= e {
        peek(t, v, e + 1, r, e + 1, s);
        merge(t, v, l, e + 1, r + 1);
    } else if m >= s {
        peek(t, v, l, s - 1, e, s - 1);
        merge(t, v, l, s, r + 1);
    } else {
        // extend the run containing m
        let mut i = m;
        while i > l && t.cmp(v, i - 1, i) != Ordering::Greater {
            i -= 1;
        }
        let mut j = m;
        while j < r && t.cmp(v, j, j + 1) != Ordering::Greater {
            j += 1;
        }
        t.mark(i, j + 1, "peeked run");
        if i == l && j == r {
            return;
        }
        if m - i < j - m {
            peek(t, v, l, i - 1, e, i - 1);
            peek(t, v, i, r, j, s);
            merge(t, v, l, i, r + 1);
        } else {
            peek(t, v, l, j, e, i);
            peek(t, v, j + 1, r, j + 1, s);
            merge(t, v, l, j + 1, r + 1);
        }
    }
}

fn merge(t: &mut Tracer, v: &mut [Item], lo: usize, mid: usize, hi: usize) {
    t.mark(lo, hi, "merge");
    kit::merge(t, v, lo, mid, hi, "buffer");
}
