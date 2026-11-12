//! Glidesort (Peters 2023, github.com/orlp/glidesort, presented at FOSDEM 2023 "Glidesort:
//! Efficient In-Memory Adaptive Stable Sorting on Modern Hardware"). The stable sort that
//! introduced the ideas driftsort later refined:
//!
//! - *lazy logical runs*: the scan yields sorted runs (natural runs of at least ≈ √n, or of
//!   min(n - n/2, 64) for small n) and unsorted stretches; two unsorted runs are merged by
//!   simply concatenating them, so long unsorted stretches reach quicksort whole;
//! - the merge tree follows the powersort policy (node power of each run boundary);
//! - an unsorted run is sorted by a stable quicksort when it has to be merged with a sorted
//!   one; its partition uses only half of the input as buffer: each half is partitioned
//!   stably through the buffer and the two middle parts are swapped by a rotation
//!   (L< L>= R< R>= becomes L< R< L>= R>=); equal elements are split off when the pivot
//!   equals the ancestor pivot, so many duplicates sort in linear time;
//! - merges go through the same buffer of ⌈n/2⌉ elements (aux `buffer`).
//!
//! Simplified: glidesort's ping-pong, bidirectional and interleaved merges (which exist for
//! instruction-level parallelism) are plain buffered merges, its small sorts are binary
//! insertion sort, and after 2 log2 n bad pivots the range is merge-sorted bottom-up.
//! Stable, not in place.
use super::driftsort::{choose_pivot, find_existing_run, merge_tree_depth, sqrt_approx};
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "glidesort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

const SMALL_SORT: usize = 32;

#[derive(Clone, Copy)]
struct Run {
    len: usize,
    sorted: bool,
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n <= SMALL_SORT {
        small_sort(t, v, 0, n);
        return Outcome::Sorted;
    }
    let scale = ((1u64 << 62) + n as u64 - 1) / n as u64;
    let min_run = if n <= 64 * 64 {
        (n - n / 2).min(64)
    } else {
        sqrt_approx(n)
    };
    let mut stack: Vec<(Run, u32)> = Vec::new();
    let mut prev = Run {
        len: 0,
        sorted: true,
    };
    let mut scan = 0usize;
    loop {
        let (next, depth) = if scan < n {
            let r = next_run(t, v, scan, n, min_run);
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
            let start = scan - (left.len + prev.len);
            prev = logical_merge(t, v, start, scan, left, prev);
        }
        stack.push((prev, depth));
        if scan >= n {
            break;
        }
        scan += next.len;
        prev = next;
    }
    if !prev.sorted {
        quicksort_entry(t, v, 0, n);
    }
    t.aux_clear("buffer");
    Outcome::Sorted
}

fn next_run(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, min_run: usize) -> Run {
    let len = hi - lo;
    if len >= min_run {
        let (run_len, reversed) = find_existing_run(t, v, lo, hi);
        if run_len >= min_run {
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
    Run {
        len: min_run.min(len),
        sorted: false,
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
    if !left.sorted && !right.sorted {
        t.mark(lo, hi, "unsorted runs concatenated");
        return Run {
            len: hi - lo,
            sorted: false,
        };
    }
    if !left.sorted {
        quicksort_entry(t, v, lo, lo + left.len);
    }
    if !right.sorted {
        quicksort_entry(t, v, lo + left.len, hi);
    }
    t.mark(lo, hi, "merge");
    kit::merge(t, v, lo, lo + left.len, hi, "buffer");
    Run {
        len: hi - lo,
        sorted: true,
    }
}

fn small_sort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    if hi - lo > 1 {
        kit::binary_insertion(t, v, lo, lo + 1, hi);
    }
}

fn quicksort_entry(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
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
        if len <= SMALL_SORT {
            small_sort(t, v, lo, hi);
            return;
        }
        if limit == 0 {
            t.phase("too many bad pivots: bottom-up merge sort");
            let mut w = SMALL_SORT;
            let mut a = lo;
            while a < hi {
                small_sort(t, v, a, (a + w).min(hi));
                a += w;
            }
            while w < len {
                let mut a = lo;
                while a + w < hi {
                    kit::merge(t, v, a, a + w, (a + 2 * w).min(hi), "buffer");
                    a += 2 * w;
                }
                w *= 2;
            }
            return;
        }
        limit -= 1;
        let pivot_pos = choose_pivot(t, v, lo, len);
        let pivot = t.read(v, pivot_pos);
        let equal = match ancestor {
            Some(a) => t.cmp_items(&a, &pivot) != Ordering::Less,
            None => false,
        };
        let left_len = if equal {
            0
        } else {
            partition(t, v, lo, hi, &pivot, false)
        };
        if equal || left_len == 0 {
            let mid_eq = partition(t, v, lo, hi, &pivot, true);
            lo += mid_eq;
            ancestor = None;
            continue;
        }
        quicksort(t, v, lo + left_len, hi, limit, Some(pivot));
        hi = lo + left_len;
    }
}

/// Stable partition of `[lo, hi)` by `x < pivot` (or `x <= pivot` with `le`), each half
/// through the half-size buffer, the middle parts joined by a rotation.
fn partition(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    pivot: &Item,
    le: bool,
) -> usize {
    t.mark(
        lo,
        hi,
        if le {
            "bidirectional partition <="
        } else {
            "bidirectional partition <"
        },
    );
    let mid = lo + (hi - lo) / 2;
    let l = half_partition(t, v, lo, mid, pivot, le);
    let r = half_partition(t, v, mid, hi, pivot, le);
    kit::rotate(t, v, lo + l, mid, mid + r);
    l + r
}

fn half_partition(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    pivot: &Item,
    le: bool,
) -> usize {
    let len = hi - lo;
    let mut buf = vec![Item::default(); len];
    let (mut nl, mut back) = (0usize, len);
    for i in lo..hi {
        let c = t.cmp_at(pivot, v, i); // pivot vs v[i]
        let goes_left = if le {
            c != Ordering::Less
        } else {
            c == Ordering::Greater
        };
        let x = t.read(v, i);
        if goes_left {
            buf[nl] = x;
            nl += 1;
        } else {
            back -= 1;
            buf[back] = x;
        }
    }
    t.aux("buffer", &buf);
    for k in 0..nl {
        t.set(v, lo + k, buf[k]);
    }
    for k in 0..(len - nl) {
        t.set(v, lo + nl + k, buf[len - 1 - k]);
    }
    nl
}
