//! ipnsort (Bergdoll & Peters; Rust's `slice::sort_unstable` since Rust 1.81, source
//! `core/src/slice/sort/unstable/`, design notes github.com/Voultapher/sort-research-rs).
//! The structure of the std implementation:
//!
//! - inputs of at most 20 elements: insertion sort;
//! - `find_existing_run`: if the whole input is one non-descending or strictly descending
//!   run it is finished in O(n) (reversed if descending);
//! - otherwise introsort-style quicksort with the limit 2 * floor(log2(n | 1)); pivot =
//!   median of 3 (below 64 elements) or the recursive pseudo-median of 3 ("median3_rec")
//!   sampled at offsets 0, 4n/8 and 7n/8;
//! - if the chosen pivot equals the ancestor pivot (the one left of the range), the range is
//!   partitioned by `<=` and the equal elements are skipped (linear on few distinct keys);
//! - heapsort when the limit is exhausted.
//!
//! Simplified: std's branchless cyclic Lomuto partition is a plain Lomuto partition here,
//! and the small sort (sorting networks plus insertion, up to 32 elements) is insertion
//! sort. Not stable, in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "ipnsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const SMALL_SORT_THRESHOLD: usize = 32;
const PSEUDO_MEDIAN_REC_THRESHOLD: usize = 64;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let len = v.len();
    if len < 2 {
        return Outcome::Sorted;
    }
    if len <= 20 {
        t.phase("small input: insertion sort");
        kit::insertion(t, v, 0, len);
        return Outcome::Sorted;
    }
    t.phase("find existing run");
    let (run_len, reversed) = find_existing_run(t, v);
    if run_len == len {
        if reversed {
            kit::reverse(t, v, 0, len);
        }
        return Outcome::Sorted;
    }
    let limit = 2 * kit::log2(len | 1);
    t.phase("quicksort");
    quicksort(t, v, 0, len, None, limit);
    Outcome::Sorted
}

fn find_existing_run(t: &mut Tracer, v: &[Item]) -> (usize, bool) {
    let len = v.len();
    let mut run_len = 2;
    let desc = t.less(v, 1, 0);
    if desc {
        while run_len < len && t.less(v, run_len, run_len - 1) {
            run_len += 1;
        }
    } else {
        while run_len < len && !t.less(v, run_len, run_len - 1) {
            run_len += 1;
        }
    }
    t.mark(0, run_len, "existing run");
    (run_len, desc)
}

fn quicksort(
    t: &mut Tracer,
    v: &mut [Item],
    mut lo: usize,
    hi: usize,
    mut ancestor: Option<usize>,
    mut limit: u32,
) {
    loop {
        let len = hi - lo;
        if len <= SMALL_SORT_THRESHOLD {
            kit::insertion(t, v, lo, hi);
            return;
        }
        if limit == 0 {
            t.phase("limit reached: heapsort");
            kit::heapsort(t, v, lo, hi);
            return;
        }
        limit -= 1;
        let pivot_pos = choose_pivot(t, v, lo, len);
        if let Some(ap) = ancestor {
            // !is_less(ancestor, pivot): the pivot equals the ancestor pivot
            if !t.less(v, ap, pivot_pos) {
                let num_le = partition(t, v, lo, hi, pivot_pos, true);
                lo += num_le + 1;
                ancestor = None;
                continue;
            }
        }
        let num_lt = partition(t, v, lo, hi, pivot_pos, false);
        let mid = lo + num_lt;
        quicksort(t, v, lo, mid, ancestor, limit);
        ancestor = Some(mid);
        lo = mid + 1;
    }
}

/// Lomuto partition of `[lo, hi)` around `v[pivot_pos]`; returns how many elements are
/// `< pivot` (or `<= pivot` when `le`), and leaves the pivot right after them.
fn partition(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    pivot_pos: usize,
    le: bool,
) -> usize {
    t.mark(
        lo,
        hi,
        if le {
            "partition <= (equal to ancestor)"
        } else {
            "partition <"
        },
    );
    t.swap(v, lo, pivot_pos);
    let mut store = lo + 1;
    for i in (lo + 1)..hi {
        let c = t.cmp(v, i, lo);
        let goes_left = if le {
            c != Ordering::Greater
        } else {
            c == Ordering::Less
        };
        if goes_left {
            if i != store {
                t.swap(v, store, i);
            }
            store += 1;
        }
    }
    let num = store - (lo + 1);
    t.swap(v, lo, lo + num);
    num
}

fn choose_pivot(t: &mut Tracer, v: &[Item], lo: usize, len: usize) -> usize {
    let len_div_8 = len / 8;
    let a = lo;
    let b = lo + len_div_8 * 4;
    let c = lo + len_div_8 * 7;
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
