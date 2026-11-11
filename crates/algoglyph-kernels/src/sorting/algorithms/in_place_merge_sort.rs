//! In-Place Merge Sort (Katajainen, Pasanen & Teuhola 1996, "Practical in-place mergesort",
//! Nordic Journal of Computing 3(1)). Merging needs a work area, and the trick is that the
//! unsorted part of the array itself serves as it: `wmerge` merges two sorted runs into the
//! work area by swaps (the work area's elements move to where the runs were, nothing is
//! lost). `imsort` sorts one half into the other half using the first quarter as work area,
//! then repeatedly sorts half of the remaining unsorted part and merges it into the sorted
//! part using the rest as work area; the last few elements are inserted by insertion. Θ(n log n)
//! comparisons and swaps, O(1) extra space. Not stable (the merges swap with the work area).
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "in-place-merge-sort",
    stable: Stability::Variant,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    imsort(t, v, 0, n);
    Outcome::Sorted
}

/// Merges `[i, m)` and `[j, n)` into the work area starting at `w` by swaps.
fn wmerge(
    t: &mut Tracer,
    v: &mut [Item],
    mut i: usize,
    m: usize,
    mut j: usize,
    n: usize,
    mut w: usize,
) {
    while i < m && j < n {
        if t.cmp(v, i, j) == Ordering::Less {
            t.swap(v, w, i);
            i += 1;
        } else {
            t.swap(v, w, j);
            j += 1;
        }
        w += 1;
    }
    while i < m {
        t.swap(v, w, i);
        w += 1;
        i += 1;
    }
    while j < n {
        t.swap(v, w, j);
        w += 1;
        j += 1;
    }
}

/// Sorts `[l, u)` into the work area starting at `w` (which must hold `u - l` elements).
fn wsort(t: &mut Tracer, v: &mut [Item], mut l: usize, u: usize, mut w: usize) {
    if u - l > 1 {
        let m = l + (u - l) / 2;
        imsort(t, v, l, m);
        imsort(t, v, m, u);
        wmerge(t, v, l, m, m, u, w);
    } else {
        while l < u {
            t.swap(v, l, w);
            l += 1;
            w += 1;
        }
    }
}

fn imsort(t: &mut Tracer, v: &mut [Item], l: usize, u: usize) {
    if u - l > 1 {
        t.mark(l, u, "imsort");
        let m = l + (u - l) / 2;
        let mut w = l + u - m;
        wsort(t, v, l, m, w); // the last half now holds sorted elements
        while w - l > 2 {
            let n = w;
            w = l + (n - l + 1) / 2;
            wsort(t, v, w, n, l); // the first half of the old work area becomes sorted
            wmerge(t, v, l, l + n - w, n, u, w);
        }
        // the remaining one or two elements: insertion
        let mut n = w;
        while n > l {
            let mut m = n;
            while m < u && t.cmp(v, m, m - 1) == Ordering::Less {
                t.swap(v, m, m - 1);
                m += 1;
            }
            n -= 1;
        }
    }
}
