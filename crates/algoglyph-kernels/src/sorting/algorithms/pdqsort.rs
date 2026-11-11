//! Pattern-defeating Quicksort (Peters 2021, arXiv:2106.05123; reference implementation
//! github.com/orlp/pdqsort). A port of `pdqsort_loop` of the reference C++ code:
//!
//! - insertion sort below 24 elements (unguarded when a smaller element precedes the range);
//! - pivot: median of 3, or Tukey's ninther above 128 elements;
//! - `partition_right` puts equal elements right and reports whether the range was already
//!   partitioned; then a partial insertion sort (at most 8 moves) may finish it, which makes
//!   sorted and nearly sorted inputs linear;
//! - when the pivot equals the element before the range, `partition_left` puts every equal
//!   element left and skips them (linear time on few distinct keys);
//! - a highly unbalanced partition (a side < n/8) shuffles a few elements to break the
//!   pattern, and after log2(n) such partitions the range is finished with heapsort.
//!
//! Simplified: the branchless block partition of `pdqsort_branchless` (BlockQuicksort style)
//! is not used; this is the branching `pdqsort` variant. Not stable, in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "pdqsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const INSERTION_SORT_THRESHOLD: usize = 24;
const NINTHER_THRESHOLD: usize = 128;
const PARTIAL_INSERTION_SORT_LIMIT: usize = 8;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    pdq_loop(t, v, 0, n, kit::log2(n), true);
    Outcome::Sorted
}

fn insertion(t: &mut Tracer, v: &mut [Item], begin: usize, end: usize, guarded: bool) {
    for cur in (begin + 1)..end {
        if t.cmp(v, cur, cur - 1) == Ordering::Less {
            let tmp = t.read(v, cur);
            let mut sift = cur;
            loop {
                let y = v[sift - 1];
                t.set(v, sift, y);
                sift -= 1;
                if guarded && sift == begin {
                    break;
                }
                if t.cmp_at(&tmp, v, sift - 1) != Ordering::Less {
                    break;
                }
            }
            t.set(v, sift, tmp);
        }
    }
}

fn partial_insertion(t: &mut Tracer, v: &mut [Item], begin: usize, end: usize) -> bool {
    if begin == end {
        return true;
    }
    let mut limit = 0;
    for cur in (begin + 1)..end {
        if t.cmp(v, cur, cur - 1) == Ordering::Less {
            let tmp = t.read(v, cur);
            let mut sift = cur;
            loop {
                let y = v[sift - 1];
                t.set(v, sift, y);
                sift -= 1;
                if sift == begin || t.cmp_at(&tmp, v, sift - 1) != Ordering::Less {
                    break;
                }
            }
            t.set(v, sift, tmp);
            limit += cur - sift;
        }
        if limit > PARTIAL_INSERTION_SORT_LIMIT {
            return false;
        }
    }
    true
}

/// Returns (pivot position, already partitioned). Equal elements go right.
fn partition_right(t: &mut Tracer, v: &mut [Item], begin: usize, end: usize) -> (usize, bool) {
    t.mark(begin, end, "partition right");
    let pivot = t.read(v, begin);
    let mut first = begin;
    let mut last = end;
    // v[x] < pivot  <=>  cmp_at(pivot, x) == Greater
    loop {
        first += 1;
        if t.cmp_at(&pivot, v, first) != Ordering::Greater {
            break;
        }
    }
    if first - 1 == begin {
        while first < last {
            last -= 1;
            if t.cmp_at(&pivot, v, last) == Ordering::Greater {
                break;
            }
        }
    } else {
        loop {
            last -= 1;
            if t.cmp_at(&pivot, v, last) == Ordering::Greater {
                break;
            }
        }
    }
    let already = first >= last;
    while first < last {
        t.swap(v, first, last);
        loop {
            first += 1;
            if t.cmp_at(&pivot, v, first) != Ordering::Greater {
                break;
            }
        }
        loop {
            last -= 1;
            if t.cmp_at(&pivot, v, last) == Ordering::Greater {
                break;
            }
        }
    }
    let pivot_pos = first - 1;
    let y = v[pivot_pos];
    t.set(v, begin, y);
    t.set(v, pivot_pos, pivot);
    (pivot_pos, already)
}

/// Equal elements go left; returns the pivot position.
fn partition_left(t: &mut Tracer, v: &mut [Item], begin: usize, end: usize) -> usize {
    t.mark(begin, end, "partition left (equal keys)");
    let pivot = t.read(v, begin);
    let mut first = begin;
    let mut last = end;
    // pivot < v[x]  <=>  cmp_at(pivot, x) == Less
    loop {
        last -= 1;
        if t.cmp_at(&pivot, v, last) != Ordering::Less {
            break;
        }
    }
    if last + 1 == end {
        while first < last {
            first += 1;
            if t.cmp_at(&pivot, v, first) == Ordering::Less {
                break;
            }
        }
    } else {
        loop {
            first += 1;
            if t.cmp_at(&pivot, v, first) == Ordering::Less {
                break;
            }
        }
    }
    while first < last {
        t.swap(v, first, last);
        loop {
            last -= 1;
            if t.cmp_at(&pivot, v, last) != Ordering::Less {
                break;
            }
        }
        loop {
            first += 1;
            if t.cmp_at(&pivot, v, first) == Ordering::Less {
                break;
            }
        }
    }
    let pivot_pos = last;
    let y = v[pivot_pos];
    t.set(v, begin, y);
    t.set(v, pivot_pos, pivot);
    pivot_pos
}

fn pdq_loop(
    t: &mut Tracer,
    v: &mut [Item],
    mut begin: usize,
    end: usize,
    mut bad_allowed: u32,
    mut leftmost: bool,
) {
    loop {
        let size = end - begin;
        if size < INSERTION_SORT_THRESHOLD {
            insertion(t, v, begin, end, leftmost);
            return;
        }
        let s2 = size / 2;
        if size > NINTHER_THRESHOLD {
            kit::sort3(t, v, begin, begin + s2, end - 1);
            kit::sort3(t, v, begin + 1, begin + (s2 - 1), end - 2);
            kit::sort3(t, v, begin + 2, begin + (s2 + 1), end - 3);
            kit::sort3(t, v, begin + (s2 - 1), begin + s2, begin + (s2 + 1));
            t.swap(v, begin, begin + s2);
        } else {
            kit::sort3(t, v, begin + s2, begin, end - 1);
        }
        if !leftmost && t.cmp(v, begin - 1, begin) != Ordering::Less {
            begin = partition_left(t, v, begin, end) + 1;
            continue;
        }
        let (pivot_pos, already) = partition_right(t, v, begin, end);
        let l_size = pivot_pos - begin;
        let r_size = end - (pivot_pos + 1);
        let highly_unbalanced = l_size < size / 8 || r_size < size / 8;
        if highly_unbalanced {
            bad_allowed -= 1;
            if bad_allowed == 0 {
                t.phase("too many bad partitions: heapsort");
                kit::heapsort(t, v, begin, end);
                return;
            }
            t.phase("unbalanced partition: break patterns");
            if l_size >= INSERTION_SORT_THRESHOLD {
                t.swap(v, begin, begin + l_size / 4);
                t.swap(v, pivot_pos - 1, pivot_pos - l_size / 4);
                if l_size > NINTHER_THRESHOLD {
                    t.swap(v, begin + 1, begin + (l_size / 4 + 1));
                    t.swap(v, begin + 2, begin + (l_size / 4 + 2));
                    t.swap(v, pivot_pos - 2, pivot_pos - (l_size / 4 + 1));
                    t.swap(v, pivot_pos - 3, pivot_pos - (l_size / 4 + 2));
                }
            }
            if r_size >= INSERTION_SORT_THRESHOLD {
                t.swap(v, pivot_pos + 1, pivot_pos + (1 + r_size / 4));
                t.swap(v, end - 1, end - r_size / 4);
                if r_size > NINTHER_THRESHOLD {
                    t.swap(v, pivot_pos + 2, pivot_pos + (2 + r_size / 4));
                    t.swap(v, pivot_pos + 3, pivot_pos + (3 + r_size / 4));
                    t.swap(v, end - 2, end - (1 + r_size / 4));
                    t.swap(v, end - 3, end - (2 + r_size / 4));
                }
            }
        } else if already
            && partial_insertion(t, v, begin, pivot_pos)
            && partial_insertion(t, v, pivot_pos + 1, end)
        {
            return;
        }
        pdq_loop(t, v, begin, pivot_pos, bad_allowed, leftmost);
        begin = pivot_pos + 1;
        leftmost = false;
    }
}
