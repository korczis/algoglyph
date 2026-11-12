//! SymMerge-based Sort (Kim & Kutzner 2004, "Stable Minimum Storage Merging by Symmetric
//! Comparisons", ESA, LNCS 3221): the stable in-place merge sort of Go's `sort.Stable`
//! (go.dev/src/sort/sort.go). Blocks of 20 elements are insertion-sorted, then merged
//! bottom-up with SymMerge: it finds by a symmetric binary search the split where a suffix
//! of the left run and a prefix of the right run must exchange places, rotates them (by
//! block swaps) and recurses on both sides. O(n log^2 n) moves, O(n log n) comparisons,
//! O(log n) stack, no buffer. Stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "symmerge-based-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

const BLOCK: usize = 20;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let mut block = BLOCK;
    let (mut a, mut b) = (0usize, block);
    t.phase("insertion-sort blocks of 20");
    while b <= n {
        insertion(t, v, a, b);
        a = b;
        b += block;
    }
    insertion(t, v, a, n);
    while block < n {
        t.phase(&format!("symmerge runs of {block}"));
        a = 0;
        b = 2 * block;
        while b <= n {
            sym_merge(t, v, a, a + block, b);
            a = b;
            b += 2 * block;
        }
        let m = a + block;
        if m < n {
            sym_merge(t, v, a, m, n);
        }
        block *= 2;
    }
    Outcome::Sorted
}

fn insertion(t: &mut Tracer, v: &mut [Item], a: usize, b: usize) {
    for i in (a + 1)..b {
        let mut j = i;
        while j > a && t.less(v, j, j - 1) {
            t.swap(v, j, j - 1);
            j -= 1;
        }
    }
}

fn sym_merge(t: &mut Tracer, v: &mut [Item], a: usize, m: usize, b: usize) {
    if m - a == 1 {
        // insert v[a] into [m, b): first i with !(v[i] < v[a])
        let (mut i, mut j) = (m, b);
        while i < j {
            let h = (i + j) / 2;
            if t.less(v, h, a) {
                i = h + 1;
            } else {
                j = h;
            }
        }
        let mut k = a;
        while k + 1 < i {
            t.swap(v, k, k + 1);
            k += 1;
        }
        return;
    }
    if b - m == 1 {
        let (mut i, mut j) = (a, m);
        while i < j {
            let h = (i + j) / 2;
            if !t.less(v, m, h) {
                i = h + 1;
            } else {
                j = h;
            }
        }
        let mut k = m;
        while k > i {
            t.swap(v, k, k - 1);
            k -= 1;
        }
        return;
    }
    t.mark(a, b, "symmerge");
    let mid = (a + b) / 2;
    let n = mid + m;
    let (mut start, mut r) = if m > mid { (n - b, mid) } else { (a, m) };
    let p = n - 1;
    while start < r {
        let c = (start + r) / 2;
        if !t.less(v, p - c, c) {
            start = c + 1;
        } else {
            r = c;
        }
    }
    let end = n - start;
    if start < m && m < end {
        rotate(t, v, start, m, end);
    }
    if a < start && start < mid {
        sym_merge(t, v, a, start, mid);
    }
    if mid < end && end < b {
        sym_merge(t, v, mid, end, b);
    }
}

fn swap_range(t: &mut Tracer, v: &mut [Item], a: usize, b: usize, n: usize) {
    for i in 0..n {
        t.swap(v, a + i, b + i);
    }
}

/// Go's block-swap rotation of `[a, b)` around `m`.
fn rotate(t: &mut Tracer, v: &mut [Item], a: usize, m: usize, b: usize) {
    let mut i = m - a;
    let mut j = b - m;
    while i != j {
        if i > j {
            swap_range(t, v, m - i, m, j);
            i -= j;
        } else {
            swap_range(t, v, m - i, m + j - i, i);
            j -= i;
        }
    }
    swap_range(t, v, m - i, m, i);
}
