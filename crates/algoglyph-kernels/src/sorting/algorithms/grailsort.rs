//! Grailsort (Astrelin 2013, github.com/Mrrl/GrailSort; after Huang & Langston 1992, "Fast
//! stable merging and sorting in constant extra space", The Computer Journal 35(6)). A stable
//! in-place merge sort in O(n log n) worst case with O(1) extra memory:
//!
//! 1. `FindKeys` gathers about 2√n distinct elements to the front: `keys` (one tag per block)
//!    and an internal `buffer` of block length bl (a power of two with bl^2 >= n);
//! 2. `BuildBlocks`: bottom-up merging of the rest up to runs of 2 bl, every merge done by
//!    swaps through the buffer (whose elements are only permuted);
//! 3. `CombineBlocks`, for every pair of longer runs: both runs are cut into blocks of bl, the
//!    blocks are selection-sorted by their first element (ties broken by the tag keys, which
//!    move with the blocks and record whether a block came from the left run), and then
//!    neighbouring blocks of different origin are merged locally through the buffer; an
//!    uneven last block is merged at the end;
//! 4. the keys and the buffer are insertion-sorted and merged into the rest by rotations.
//!
//! Simplified: the buffer travels with the merges in Astrelin's code (MergeLeft/MergeRight);
//! here it stays in place and each merge swaps the left run into it first. When fewer
//! distinct keys exist than needed, Astrelin sorts with keys only (smaller blocks, rotation
//! merges) above 4 keys; here every shortfall uses his `LazyStableSort` (rotation merges),
//! which he uses below 4 keys. Stable, in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "grailsort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n <= 16 {
        kit::insertion(t, v, 0, n);
        return Outcome::Sorted;
    }
    let mut bl = 1;
    while bl * bl < n {
        bl *= 2;
    }
    let kl = (n - 1) / bl + 1;
    let want = kl + bl;
    t.phase(&format!("find {want} distinct keys"));
    let found = kit::find_keys(t, v, 0, n, want);
    if found < want {
        t.phase("not enough distinct keys: lazy stable sort");
        kit::lazy_stable_sort(t, v, 0, n);
        return Outcome::Sorted;
    }
    let buf = kl;
    let s = kl + bl;
    t.mark(0, kl, "keys");
    t.mark(kl, s, "buffer");
    t.phase("build runs through the buffer");
    let mut w = 1;
    while w <= bl {
        let mut lo = s;
        while lo + w < n {
            let hi = (lo + 2 * w).min(n);
            kit::merge_swap_buffer(t, v, buf, lo, lo + w, hi);
            lo += 2 * w;
        }
        w *= 2;
    }
    while w < n - s {
        t.phase(&format!("combine blocks: runs of {w}"));
        let mut lo = s;
        while lo + w < n {
            let hi = (lo + 2 * w).min(n);
            combine(t, v, buf, bl, lo, lo + w, hi);
            lo += 2 * w;
        }
        w *= 2;
    }
    t.phase("sort the keys and the buffer, merge them in");
    kit::insertion(t, v, 0, s);
    kit::merge_rotations(t, v, 0, s, n);
    Outcome::Sorted
}

/// Block merge of `[a0, a1)` and `[a1, b1)`; `|A|` is a multiple of `bl`.
fn combine(t: &mut Tracer, v: &mut [Item], buf: usize, bl: usize, a0: usize, a1: usize, b1: usize) {
    if t.cmp(v, a1 - 1, a1) != Ordering::Greater {
        return;
    }
    t.mark(a0, b1, "combine");
    let na = (a1 - a0) / bl;
    let nb = (b1 - a1) / bl;
    let full_end = a1 + nb * bl;
    if nb > 0 {
        let nblocks = na + nb;
        let midkey = v[na]; // the first B block's tag (keys are at [0, nblocks))
                            // selection sort of the blocks by (first element, tag)
        for i in 0..nblocks {
            let mut m = i;
            for j in (i + 1)..nblocks {
                let c = t.cmp(v, a0 + j * bl, a0 + m * bl);
                if c == Ordering::Less || (c == Ordering::Equal && t.cmp(v, j, m) == Ordering::Less)
                {
                    m = j;
                }
            }
            if m != i {
                kit::block_swap(t, v, a0 + i * bl, a0 + m * bl, bl);
                t.swap(v, i, m);
            }
        }
        // local merges of neighbouring blocks of different origin
        let from_a =
            |t: &mut Tracer, v: &[Item], j: usize| t.cmp_at(&midkey, v, j) == Ordering::Greater;
        let (mut p0, mut porig) = (a0, from_a(t, v, 0));
        for j in 1..nblocks {
            let x0 = a0 + j * bl;
            let x1 = x0 + bl;
            let o = from_a(t, v, j);
            if o == porig {
                p0 = x0;
                continue;
            }
            // merge P = [p0, x0) (origin porig) with X = [x0, x1) (origin o), A first on ties
            let l1 = x0 - p0;
            kit::block_swap(t, v, p0, buf, l1);
            let (mut i, iend) = (buf, buf + l1);
            let mut jx = x0;
            let mut out = p0;
            while i < iend && jx < x1 {
                let c = t.cmp(v, i, jx);
                let take_p = if porig {
                    c != Ordering::Greater
                } else {
                    c == Ordering::Less
                };
                if take_p {
                    t.swap(v, out, i);
                    i += 1;
                } else {
                    t.swap(v, out, jx);
                    jx += 1;
                }
                out += 1;
            }
            if i < iend {
                // X is exhausted: the rest of P stays pending
                let rest = out;
                while i < iend {
                    t.swap(v, out, i);
                    out += 1;
                    i += 1;
                }
                p0 = rest;
            } else {
                // P is exhausted: the rest of X becomes pending
                p0 = jx;
                porig = o;
            }
        }
        kit::insertion(t, v, 0, nblocks);
    }
    if full_end < b1 {
        kit::merge_swap_buffer_right(t, v, buf, a0, full_end, b1);
    }
}
