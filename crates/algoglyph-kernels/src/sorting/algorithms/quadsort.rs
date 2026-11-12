//! Quadsort (van den Hoven 2020, github.com/scandum/quadsort, public domain / Unlicense). A
//! stable bottom-up merge sort built around three ideas of its author:
//!
//! - quad swap: the input is processed in groups of four; a strictly descending group starts
//!   or extends a descending run that is reversed as a whole (descending inputs cost O(n)),
//!   any other group is sorted stably, and the groups are merged into blocks of 32;
//! - parity merge: two sorted halves of equal length are merged from both ends at once (the
//!   head takes the smaller, the tail the larger element), n/2 steps with no bounds checks;
//! - quad merge: four sorted blocks are merged two by two into the swap memory (aux `swap`)
//!   and then back, so every element moves twice per factor of four instead of four times;
//!   pairs already in order are copied instead of merged and four ordered blocks are skipped.
//!
//! What does not fill a group of four blocks is finished by a tail merge that doubles the
//! run width. Simplified: the branchless swap networks are ordinary compare-and-swap code,
//! the tail of fewer than 32 elements uses insertion sort, and partial (unequal) merges use a
//! buffered merge instead of quadsort's partial backward merge. Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "quadsort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 32 {
        kit::insertion(t, v, 0, n);
        return Outcome::Sorted;
    }
    t.phase("quad swap");
    quad_swap(t, v);
    let mut block = 32;
    while block * 4 <= n {
        t.phase(&format!("quad merge blocks of {block}"));
        let mut p = 0;
        while p + 4 * block <= n {
            quad_merge_block(t, v, p, block);
            p += 4 * block;
        }
        tail_merge(t, v, p, n, block);
        block *= 4;
    }
    t.phase("tail merge");
    tail_merge(t, v, 0, n, block);
    t.aux_clear("swap");
    Outcome::Sorted
}

fn quad_swap(t: &mut Tracer, v: &mut [Item]) {
    let n = v.len();
    let full = n / 4 * 4;
    let mut rev: Option<usize> = None;
    let mut i = 0;
    while i < full {
        let desc = t.cmp(v, i, i + 1) == Ordering::Greater
            && t.cmp(v, i + 1, i + 2) == Ordering::Greater
            && t.cmp(v, i + 2, i + 3) == Ordering::Greater;
        if desc {
            match rev {
                Some(_) if t.cmp(v, i - 1, i) == Ordering::Greater => {}
                _ => {
                    close(t, v, rev, i);
                    rev = Some(i);
                }
            }
        } else {
            close(t, v, rev, i);
            rev = None;
            sort4(t, v, i);
        }
        i += 4;
    }
    close(t, v, rev, full);
    kit::insertion(t, v, full, n);
    // groups of 4 -> blocks of 32 by parity merges
    let n32 = n / 32 * 32;
    let mut w = 4;
    while w < 32 {
        let mut p = 0;
        while p + 2 * w <= n32 {
            if t.cmp(v, p + w - 1, p + w) == Ordering::Greater {
                parity_merge_in_place(t, v, p, w);
            }
            p += 2 * w;
        }
        w *= 2;
    }
    kit::insertion(t, v, n32, n);
}

fn close(t: &mut Tracer, v: &mut [Item], rev: Option<usize>, end: usize) {
    if let Some(s) = rev {
        t.mark(s, end, "reversed run");
        kit::reverse(t, v, s, end);
    }
}

/// Stable sort of four elements: two pairs, then a parity merge if they overlap.
fn sort4(t: &mut Tracer, v: &mut [Item], i: usize) {
    if t.cmp(v, i, i + 1) == Ordering::Greater {
        t.swap(v, i, i + 1);
    }
    if t.cmp(v, i + 2, i + 3) == Ordering::Greater {
        t.swap(v, i + 2, i + 3);
    }
    if t.cmp(v, i + 1, i + 2) == Ordering::Greater {
        parity_merge_in_place(t, v, i, 2);
    }
}

/// Parity merge of `src[0..h]` and `src[h..2h]` (held items) into `v[lo..lo+2h]`.
fn parity_merge_into_v(t: &mut Tracer, v: &mut [Item], lo: usize, src: &[Item], h: usize) {
    let (mut l, mut r) = (0usize, h);
    let (mut tl, mut tr) = (h - 1, 2 * h - 1);
    let (mut d, mut td) = (lo, lo + 2 * h - 1);
    for _ in 0..h - 1 {
        if t.cmp_items(&src[l], &src[r]) != Ordering::Greater {
            t.set(v, d, src[l]);
            l += 1;
        } else {
            t.set(v, d, src[r]);
            r += 1;
        }
        d += 1;
        if t.cmp_items(&src[tl], &src[tr]) == Ordering::Greater {
            t.set(v, td, src[tl]);
            tl -= 1;
        } else {
            t.set(v, td, src[tr]);
            tr -= 1;
        }
        td -= 1;
    }
    let head = if t.cmp_items(&src[l], &src[r]) != Ordering::Greater {
        src[l]
    } else {
        src[r]
    };
    t.set(v, d, head);
    let tail = if t.cmp_items(&src[tl], &src[tr]) == Ordering::Greater {
        src[tl]
    } else {
        src[tr]
    };
    t.set(v, td, tail);
}

/// Parity merge of `v[lo..lo+h]` and `v[lo+h..lo+2h]` into `dst` (the swap memory).
fn parity_merge_from_v(t: &mut Tracer, v: &[Item], lo: usize, h: usize, dst: &mut [Item]) {
    let (mut l, mut r) = (lo, lo + h);
    let (mut tl, mut tr) = (lo + h - 1, lo + 2 * h - 1);
    let (mut d, mut td) = (0usize, 2 * h - 1);
    for _ in 0..h - 1 {
        if t.cmp(v, l, r) != Ordering::Greater {
            dst[d] = t.read(v, l);
            l += 1;
        } else {
            dst[d] = t.read(v, r);
            r += 1;
        }
        d += 1;
        if t.cmp(v, tl, tr) == Ordering::Greater {
            dst[td] = t.read(v, tl);
            tl -= 1;
        } else {
            dst[td] = t.read(v, tr);
            tr -= 1;
        }
        td -= 1;
    }
    dst[d] = if t.cmp(v, l, r) != Ordering::Greater {
        t.read(v, l)
    } else {
        t.read(v, r)
    };
    dst[td] = if t.cmp(v, tl, tr) == Ordering::Greater {
        t.read(v, tl)
    } else {
        t.read(v, tr)
    };
}

fn parity_merge_in_place(t: &mut Tracer, v: &mut [Item], lo: usize, h: usize) {
    let src: Vec<Item> = (lo..lo + 2 * h).map(|i| t.read(v, i)).collect();
    t.aux("swap", &src);
    parity_merge_into_v(t, v, lo, &src, h);
}

fn quad_merge_block(t: &mut Tracer, v: &mut [Item], p: usize, b: usize) {
    let (p1, p2, p3) = (p + b, p + 2 * b, p + 3 * b);
    let c1 = t.cmp(v, p1 - 1, p1) != Ordering::Greater;
    let c2 = t.cmp(v, p3 - 1, p3) != Ordering::Greater;
    if c1 && c2 && t.cmp(v, p2 - 1, p2) != Ordering::Greater {
        return;
    }
    t.mark(p, p + 4 * b, "quad merge");
    let mut swap = vec![Item::default(); 4 * b];
    if c1 {
        for k in 0..2 * b {
            swap[k] = t.read(v, p + k);
        }
    } else {
        parity_merge_from_v(t, v, p, b, &mut swap[..2 * b]);
    }
    if c2 {
        for k in 0..2 * b {
            swap[2 * b + k] = t.read(v, p2 + k);
        }
    } else {
        parity_merge_from_v(t, v, p2, b, &mut swap[2 * b..]);
    }
    t.aux("swap", &swap);
    parity_merge_into_v(t, v, p, &swap, 2 * b);
}

/// Merges runs of width `block` in `[lo, hi)` pairwise, doubling, until one run remains.
fn tail_merge(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, block: usize) {
    let mut w = block;
    while w < hi - lo {
        let mut a = lo;
        while a + w < hi {
            let b = (a + 2 * w).min(hi);
            if t.cmp(v, a + w - 1, a + w) == Ordering::Greater {
                if b - a == 2 * w {
                    parity_merge_in_place(t, v, a, w);
                } else {
                    kit::merge(t, v, a, a + w, b, "swap");
                }
            }
            a += 2 * w;
        }
        w *= 2;
    }
}
