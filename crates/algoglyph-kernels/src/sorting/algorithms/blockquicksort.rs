//! BlockQuicksort (Edelkamp & Weiß 2016, "BlockQuicksort: How Branch Mispredictions don't
//! affect Quicksort", ESA; journal version ACM JEA 2019). Hoare-style partitioning in blocks:
//! a block of B elements on each side is scanned first and the offsets of the elements on
//! the wrong side are stored in two offset buffers (`offsetsL`, `offsetsR`, shown as aux),
//! without branching on the comparison; then the stored elements are exchanged pairwise.
//! A side whose buffer is empty advances by one block. Pivot: median of three; ranges of at
//! most 16 use insertion sort.
//!
//! Simplified: the paper's cyclic permutation of the stored pairs is replaced by plain
//! pairwise swaps (same result, more moves), the leftover of fewer than 2B elements is
//! finished by a classical Hoare partition, and there is no worst-case fallback (O(n^2)
//! worst case, as in the basic algorithm). B = 128 as in the paper.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "blockquicksort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const BLOCK: usize = 128;
const CUTOFF: usize = 16;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    rec(t, v, 0, n);
    Outcome::Sorted
}

fn rec(t: &mut Tracer, v: &mut [Item], mut lo: usize, mut hi: usize) {
    while hi - lo > CUTOFF {
        let p = partition(t, v, lo, hi);
        if p - lo < hi - p {
            rec(t, v, lo, p);
            lo = p + 1;
        } else {
            rec(t, v, p + 1, hi);
            hi = p;
        }
    }
    kit::insertion(t, v, lo, hi);
}

fn offsets_aux(t: &mut Tracer, name: &str, offs: &[usize]) {
    let items: Vec<Item> = offs.iter().map(|&o| Item::new(o as i32, 0)).collect();
    t.aux(name, &items);
}

/// Partitions `[lo, hi)` around a median-of-3 pivot moved to `lo`; returns its final index.
fn partition(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> usize {
    t.mark(lo, hi, "block partition");
    let mid = lo + (hi - lo) / 2;
    kit::sort3(t, v, lo, mid, hi - 1);
    t.swap(v, lo, mid);
    // invariant: [lo+1, l) < pivot... no: elements left of l are <= pivot, right of r are >= pivot
    let mut l = lo + 1;
    let mut r = hi - 1; // inclusive
    let mut off_l: Vec<usize> = Vec::with_capacity(BLOCK);
    let mut off_r: Vec<usize> = Vec::with_capacity(BLOCK);
    let (mut start_l, mut start_r) = (0usize, 0usize);
    while r + 1 - l > 2 * BLOCK {
        if off_l.len() == start_l {
            off_l.clear();
            start_l = 0;
            for i in 0..BLOCK {
                // branch-free in the paper: offsets[num] = i; num += (v[l+i] >= pivot)
                if t.cmp(v, l + i, lo) != Ordering::Less {
                    off_l.push(i);
                }
            }
            offsets_aux(t, "offsetsL", &off_l);
        }
        if off_r.len() == start_r {
            off_r.clear();
            start_r = 0;
            for i in 0..BLOCK {
                if t.cmp(v, r - i, lo) != Ordering::Greater {
                    off_r.push(i);
                }
            }
            offsets_aux(t, "offsetsR", &off_r);
        }
        let num = (off_l.len() - start_l).min(off_r.len() - start_r);
        for k in 0..num {
            t.swap(v, l + off_l[start_l + k], r - off_r[start_r + k]);
        }
        start_l += num;
        start_r += num;
        if start_l == off_l.len() {
            l += BLOCK;
        }
        if start_r == off_r.len() {
            r -= BLOCK;
        }
    }
    t.aux_clear("offsetsL");
    t.aux_clear("offsetsR");
    // Classical Hoare partition of the rest [l, r]: everything left of l is <= pivot (the
    // blocks swapped so far), everything right of r is >= pivot.
    let (mut i, mut j) = (l as isize, r as isize);
    loop {
        while i <= j && t.cmp(v, i as usize, lo) == Ordering::Less {
            i += 1;
        }
        while i <= j && t.cmp(v, j as usize, lo) == Ordering::Greater {
            j -= 1;
        }
        if i >= j {
            break;
        }
        t.swap(v, i as usize, j as usize);
        i += 1;
        j -= 1;
    }
    // [lo+1, i) <= pivot and (j, hi) >= pivot with j < i; put the pivot at i - 1
    let p = (i - 1) as usize;
    t.swap(v, lo, p);
    p
}
