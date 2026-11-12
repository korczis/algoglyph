//! Block Merge Sort (block sort; Kim & Kutzner 2008, "Ratio Based Stable In-Place Merging",
//! TAMC, LNCS 4978; the algorithm as implemented by WikiSort, without its cache). A
//! bottom-up merge sort with O(1) extra memory and O(n log n) time: groups of 16 are
//! insertion-sorted, and every merge of two runs A and B uses block merging: A is cut into
//! blocks of √n, the blocks are rolled through B and dropped where they belong, and each
//! dropped block is merged locally with the B values before it through an internal buffer.
//! Already ordered pairs are skipped, fully reversed pairs rotated.
//!
//! Simplified: the two internal buffers (block tags and merge buffer, about √n distinct
//! values each) are extracted once for the whole sort, as in GrailSort, not per level as in
//! Kim & Kutzner; the tags stay in their own area instead of being swapped into the blocks.
//! Without enough distinct values, merges fall back to rotation-based merging (as WikiSort
//! does). Stable, in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "block-merge-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    block_sort(t, v, 0);
    Outcome::Sorted
}

/// Shared with WikiSort: `cache` = size of the external cache (0 = none).
pub fn block_sort(t: &mut Tracer, v: &mut [Item], cache: usize) {
    let n = v.len();
    if n <= 16 {
        kit::insertion(t, v, 0, n);
        return;
    }
    let mut bl = 1;
    while bl * bl < n {
        bl *= 2;
    }
    let kl = (n - 1) / bl + 1;
    // a level needs the internal buffers only if some A run exceeds the cache
    let needs_buffers = n / 2 > cache;
    let mut s = 0;
    let mut have = false;
    if needs_buffers {
        t.phase("extract the tag keys and the buffer");
        let want = kl + bl;
        let found = kit::find_keys(t, v, 0, n, want);
        if found == want {
            have = true;
            s = want;
            t.mark(0, kl, "tags");
            t.mark(kl, s, "buffer");
        } else {
            t.phase("not enough distinct values: rotation merges");
            // the found keys are a sorted prefix; keep them in the data
        }
    }
    t.phase("insertion-sort groups of 16");
    let mut lo = s;
    while lo < n {
        let hi = (lo + 16).min(n);
        kit::insertion(t, v, lo, hi);
        lo = hi;
    }
    let mut w = 16;
    while w < n - s {
        t.phase(&format!("merge runs of {w}"));
        let mut lo = s;
        while lo + w < n {
            let (a0, a1, b1) = (lo, lo + w, (lo + 2 * w).min(n));
            lo += 2 * w;
            if t.cmp(v, a1 - 1, a1) != Ordering::Greater {
                continue;
            }
            if t.cmp(v, b1 - 1, a0) == Ordering::Less {
                t.mark(a0, b1, "rotate");
                kit::rotate(t, v, a0, a1, b1);
                continue;
            }
            if cache > 0 && w <= cache {
                kit::plain_local_merge(t, v, kit::LocalMerge::Cache(cache), a0, a1, b1);
            } else if have && w <= bl {
                kit::plain_local_merge(t, v, kit::LocalMerge::Buffer(kl), a0, a1, b1);
            } else if have {
                let how = if cache >= bl {
                    kit::LocalMerge::Cache(cache)
                } else {
                    kit::LocalMerge::Buffer(kl)
                };
                kit::roll_merge(t, v, 0, how, bl, a0, a1, b1);
            } else {
                kit::plain_local_merge(t, v, kit::LocalMerge::Rotation, a0, a1, b1);
            }
        }
        w *= 2;
    }
    t.aux_clear("cache");
    if s > 0 {
        t.phase("sort the buffers and merge them back");
        kit::insertion(t, v, 0, s);
        kit::merge_rotations(t, v, 0, s, n);
    }
}
