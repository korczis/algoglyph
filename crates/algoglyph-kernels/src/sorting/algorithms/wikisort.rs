//! WikiSort (McFadden, github.com/BonzaiThePenguin/WikiSort, public domain; an implementation
//! of Kim & Kutzner 2008, "Ratio Based Stable In-Place Merging"). A bottom-up merge sort with
//! a fixed cache of 512 items (O(1) memory): groups of 16 are insertion-sorted, then every
//! level merges pairs of runs A and B. A pair already in order is skipped, a reversed pair is
//! rotated; when A fits the cache, A is copied there (aux `cache`) and merged forward; larger
//! runs use block merging: A is cut into blocks of √n tagged by distinct values, the blocks
//! are rolled through B and each is dropped where it belongs and merged locally with the B
//! values before it (through the cache when the block fits, else an internal buffer).
//! Without enough distinct values the merge falls back to rotation-based merging, as in
//! WikiSort's `MergeInPlace`.
//!
//! Simplified: WikiSort sorts the base groups (4–8 items) with sorting networks and extracts
//! its two internal buffers per level; here groups of 16 use insertion sort and the buffers
//! are extracted once, only when some A run exceeds the cache. Shares the block merge code
//! with `block-merge-sort`. Stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "wikisort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

const CACHE_SIZE: usize = 512;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    super::block_merge_sort::block_sort(t, v, CACHE_SIZE);
    Outcome::Sorted
}
