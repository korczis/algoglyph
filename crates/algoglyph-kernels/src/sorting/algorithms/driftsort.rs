//! Driftsort (Bergdoll & Peters; Rust's `slice::sort` since Rust 1.81, source
//! `core/src/slice/sort/stable/drift.rs` and `stable/quicksort.rs`, design notes
//! github.com/Voultapher/driftsort). A stable hybrid of merge sort and quicksort:
//!
//! - the input is scanned into runs: an existing non-descending or strictly descending run
//!   of at least `min_good_run_len` (min(n - n/2, 64) up to n = 4096, else ≈ √n) is a sorted
//!   run; otherwise the next `min_good_run_len` elements form a lazy *unsorted* run (inputs
//!   of at most 64 elements are sorted eagerly in chunks of 32 instead);
//! - runs are merged with the powersort policy, computed as `merge_tree_depth` of each run
//!   boundary; merging two unsorted runs is free (they just become one longer unsorted run),
//!   and an unsorted run is sorted with stable quicksort only when it meets a sorted one;
//! - stable quicksort partitions through the scratch buffer (aux `scratch`: < pivot in
//!   order to the front, >= pivot to the back, copied back), uses the ipnsort pivot
//!   selection, partitions by <= when the pivot equals the ancestor pivot (duplicates are
//!   linear), and falls back to eager driftsort after 2 log2 n bad pivots.
//!
//! Simplified: the small sort (sorting networks and bidirectional merges up to 32 elements)
//! is binary insertion sort. Stable, not in place (scratch of n elements).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "driftsort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

const SMALL_SORT_THRESHOLD: usize = 32;
const PSEUDO_MEDIAN_REC_THRESHOLD: usize = 64;

#[derive(Clone, Copy)]
struct Run {
    len: usize,
    sorted: bool,
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    if n <= 20 {
        kit::insertion(t, v, 0, n);
        return Outcome::Sorted;
    }
    let eager = n <= SMALL_SORT_THRESHOLD * 2;
    drift(t, v, 0, n, eager);
    t.aux_clear("scratch");
    Outcome::Sorted
}

pub(crate) fn sqrt_approx(n: usize) -> usize {
    let ilog = kit::log2(n | 1);
    let shift = (1 + ilog) / 2;
    ((1usize << shift) + (n >> shift)) / 2
}

pub(crate) fn merge_tree_depth(left: usize, mid: usize, right: usize, scale: u64) -> u32 {
    let x = left as u64 + mid as u64;
    let y = mid as u64 + right as u64;
    (scale.wrapping_mul(x) ^ scale.wrapping_mul(y)).leading_zeros()
}

pub(crate) fn drift(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, eager: bool) {
    let len = hi - lo;
    if len < 2 {
        return;
    }
    let scale = ((1u64 << 62) + len as u64 - 1) / len as u64;
    let min_good = if len <= 64 * 64 {
        (len - len / 2).min(64)
    } else {
        sqrt_approx(len)
    };
    let mut stack: Vec<(Run, u32)> = Vec::new();
    let mut prev = Run {
        len: 0,
        sorted: true,
    };
    let mut scan = 0usize;
    loop {
        let (next, depth) = if scan < len {
            let r = create_run(t, v, lo + scan, hi, min_good, eager);
            (
                r,
                merge_tree_depth(scan - prev.len, scan, scan + r.len, scale),
            )
        } else {
            (
                Run {
                    len: 0,
                    sorted: true,
                },
                0,
            )
        };
        while stack.len() > 1 && stack.last().unwrap().1 >= depth {
            let (left, _) = stack.pop().unwrap();
            let merged = left.len + prev.len;
            let start = scan - merged;
            prev = logical_merge(t, v, lo + start, lo + scan, left, prev);
        }
        stack.push((prev, depth));
        if scan >= len {
            break;
        }
        scan += next.len;
        prev = next;
    }
    if !prev.sorted {
        stable_quicksort(t, v, lo, hi);
    }
}

fn logical_merge(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    left: Run,
    right: Run,
) -> Run {
    let len = hi - lo;
    if left.sorted || right.sorted {
        if !left.sorted {
            stable_quicksort(t, v, lo, lo + left.len);
        }
        if !right.sorted {
            stable_quicksort(t, v, lo + left.len, hi);
        }
        t.mark(lo, hi, "merge");
        kit::merge(t, v, lo, lo + left.len, hi, "scratch");
        Run { len, sorted: true }
    } else {
        t.mark(lo, hi, "unsorted run (lazy)");
        Run { len, sorted: false }
    }
}

fn create_run(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    min_good: usize,
    eager: bool,
) -> Run {
    let len = hi - lo;
    if len >= min_good {
        let (run_len, reversed) = find_existing_run(t, v, lo, hi);
        if run_len >= min_good {
            if reversed {
                kit::reverse(t, v, lo, lo + run_len);
            }
            t.mark(lo, lo + run_len, "sorted run");
            return Run {
                len: run_len,
                sorted: true,
            };
        }
    }
    if eager {
        let k = SMALL_SORT_THRESHOLD.min(len);
        small_sort(t, v, lo, lo + k);
        t.mark(lo, lo + k, "eagerly sorted run");
        Run {
            len: k,
            sorted: true,
        }
    } else {
        Run {
            len: min_good.min(len),
            sorted: false,
        }
    }
}

pub(crate) fn find_existing_run(t: &mut Tracer, v: &[Item], lo: usize, hi: usize) -> (usize, bool) {
    let len = hi - lo;
    if len < 2 {
        return (len, false);
    }
    let mut run_len = 2;
    let desc = t.less(v, lo + 1, lo);
    if desc {
        while run_len < len && t.less(v, lo + run_len, lo + run_len - 1) {
            run_len += 1;
        }
    } else {
        while run_len < len && !t.less(v, lo + run_len, lo + run_len - 1) {
            run_len += 1;
        }
    }
    (run_len, desc)
}

fn small_sort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    if hi - lo > 1 {
        kit::binary_insertion(t, v, lo, lo + 1, hi);
    }
}

fn stable_quicksort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    let limit = 2 * kit::log2((hi - lo) | 1);
    quicksort(t, v, lo, hi, limit, None);
}

fn quicksort(
    t: &mut Tracer,
    v: &mut [Item],
    mut lo: usize,
    mut hi: usize,
    mut limit: u32,
    mut ancestor: Option<Item>,
) {
    loop {
        let len = hi - lo;
        if len <= SMALL_SORT_THRESHOLD {
            small_sort(t, v, lo, hi);
            return;
        }
        if limit == 0 {
            t.phase("too many bad pivots: eager driftsort");
            drift(t, v, lo, hi, true);
            return;
        }
        limit -= 1;
        let pivot_pos = choose_pivot(t, v, lo, len);
        let pivot = v[pivot_pos];
        let mut equal = match ancestor {
            Some(a) => t.cmp_items(&a, &pivot) != Ordering::Less,
            None => false,
        };
        let mut left_len = 0;
        if !equal {
            left_len = stable_partition(t, v, lo, hi, pivot_pos, false, false);
            equal = left_len == 0;
        }
        if equal {
            let mid_eq = stable_partition(t, v, lo, hi, pivot_pos, true, true);
            lo += mid_eq;
            ancestor = None;
            continue;
        }
        quicksort(t, v, lo + left_len, hi, limit, Some(pivot));
        hi = lo + left_len;
    }
}

/// Stable partition of `[lo, hi)` through the scratch buffer. Elements `< pivot` (or `<=`
/// with `le`) keep their order at the front, the others keep their order after them; the
/// pivot itself goes left iff `pivot_left`. Returns the size of the left part.
fn stable_partition(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    pivot_pos: usize,
    pivot_left: bool,
    le: bool,
) -> usize {
    t.mark(
        lo,
        hi,
        if le {
            "stable partition <="
        } else {
            "stable partition <"
        },
    );
    let len = hi - lo;
    let mut scratch = vec![Item::default(); len];
    let (mut num_left, mut back) = (0usize, len);
    for i in lo..hi {
        let goes_left = if i == pivot_pos {
            pivot_left
        } else {
            let c = t.cmp(v, i, pivot_pos);
            if le {
                c != Ordering::Greater
            } else {
                c == Ordering::Less
            }
        };
        let x = t.read(v, i);
        if goes_left {
            scratch[num_left] = x;
            num_left += 1;
        } else {
            back -= 1;
            scratch[back] = x;
        }
    }
    t.aux("scratch", &scratch);
    for k in 0..num_left {
        t.set(v, lo + k, scratch[k]);
    }
    for k in 0..(len - num_left) {
        t.set(v, lo + num_left + k, scratch[len - 1 - k]);
    }
    num_left
}

pub(crate) fn choose_pivot(t: &mut Tracer, v: &[Item], lo: usize, len: usize) -> usize {
    let len_div_8 = len / 8;
    let (a, b, c) = (lo, lo + len_div_8 * 4, lo + len_div_8 * 7);
    if len < PSEUDO_MEDIAN_REC_THRESHOLD {
        median3(t, v, a, b, c)
    } else {
        median3_rec(t, v, a, b, c, len_div_8)
    }
}

fn median3_rec(
    t: &mut Tracer,
    v: &[Item],
    mut a: usize,
    mut b: usize,
    mut c: usize,
    n: usize,
) -> usize {
    if n * 8 >= PSEUDO_MEDIAN_REC_THRESHOLD {
        let n8 = n / 8;
        a = median3_rec(t, v, a, a + n8 * 4, a + n8 * 7, n8);
        b = median3_rec(t, v, b, b + n8 * 4, b + n8 * 7, n8);
        c = median3_rec(t, v, c, c + n8 * 4, c + n8 * 7, n8);
    }
    median3(t, v, a, b, c)
}

fn median3(t: &mut Tracer, v: &[Item], a: usize, b: usize, c: usize) -> usize {
    let x = t.less(v, a, b);
    let y = t.less(v, a, c);
    if x == y {
        let z = t.less(v, b, c);
        if z ^ x {
            c
        } else {
            b
        }
    } else {
        a
    }
}
