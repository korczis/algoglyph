//! Shared traced building blocks for plugins (insertion, rotation, merges, heaps, runs).
//!
//! Every function works on the range `[lo, hi)` of `v`, records its operations through the
//! [`Tracer`] and changes `v` only through `swap` / `set`, so plugins that use it keep the
//! replay property of the trace. Any plugin may use it; nobody needs to.
use crate::sorting::prelude::*;

/// Stable insertion sort of `[lo, hi)` by adjacent swaps.
pub fn insertion(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    for i in (lo + 1)..hi {
        let mut j = i;
        while j > lo && t.cmp(v, j - 1, j) == Ordering::Greater {
            t.swap(v, j - 1, j);
            j -= 1;
        }
    }
}

/// Stable binary insertion sort of `[lo, hi)` whose prefix `[lo, start)` is sorted
/// (Timsort's `binarysort`): the position is found by binary search, the rest is shifted.
pub fn binary_insertion(t: &mut Tracer, v: &mut [Item], lo: usize, start: usize, hi: usize) {
    let start = start.max(lo + 1);
    for i in start..hi {
        let x = t.read(v, i);
        let pos = upper_bound(t, v, lo, i, &x);
        let mut j = i;
        while j > pos {
            let y = v[j - 1];
            t.set(v, j, y);
            j -= 1;
        }
        if pos != i {
            t.set(v, pos, x);
        }
    }
}

/// First index in the sorted range `[lo, hi)` whose key is `>= x` (lower bound).
pub fn lower_bound(t: &mut Tracer, v: &[Item], mut lo: usize, mut hi: usize, x: &Item) -> usize {
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_at(x, v, mid) == Ordering::Greater {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    lo
}

/// First index in the sorted range `[lo, hi)` whose key is `> x` (upper bound).
pub fn upper_bound(t: &mut Tracer, v: &[Item], mut lo: usize, mut hi: usize, x: &Item) -> usize {
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_at(x, v, mid) == Ordering::Less {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

/// Reverses `[lo, hi)`.
pub fn reverse(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    if hi <= lo + 1 {
        return;
    }
    let (mut i, mut j) = (lo, hi - 1);
    while i < j {
        t.swap(v, i, j);
        i += 1;
        j -= 1;
    }
}

/// Swaps the blocks `[a, a+len)` and `[b, b+len)` (they must not overlap).
pub fn block_swap(t: &mut Tracer, v: &mut [Item], a: usize, b: usize, len: usize) {
    for k in 0..len {
        t.swap(v, a + k, b + k);
    }
}

/// Rotates `[lo, hi)` so that `[mid, hi)` comes first (Gries & Mills block swaps).
pub fn rotate(t: &mut Tracer, v: &mut [Item], lo: usize, mid: usize, hi: usize) {
    if lo >= mid || mid >= hi {
        return;
    }
    let mut i = mid - lo;
    let mut j = hi - mid;
    while i != j {
        if i > j {
            block_swap(t, v, mid - i, mid, j);
            i -= j;
        } else {
            block_swap(t, v, mid - i, mid + j - i, i);
            j -= i;
        }
    }
    block_swap(t, v, mid - i, mid, i);
}

/// Length of the run starting at `lo` (strictly descending runs are reversed in place,
/// as in Timsort, so equal keys keep their order). Returns the end of the run.
pub fn ascending_run(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> usize {
    let mut end = lo + 1;
    if end >= hi {
        return hi;
    }
    if t.cmp(v, end, lo) == Ordering::Less {
        while end + 1 < hi && t.cmp(v, end + 1, end) == Ordering::Less {
            end += 1;
        }
        end += 1;
        reverse(t, v, lo, end);
    } else {
        while end + 1 < hi && t.cmp(v, end + 1, end) != Ordering::Less {
            end += 1;
        }
        end += 1;
    }
    end
}

/// End of the weakly increasing run starting at `lo` (no reversal).
pub fn weak_run(t: &mut Tracer, v: &[Item], lo: usize, hi: usize) -> usize {
    let mut end = lo + 1;
    while end < hi && t.cmp(v, end - 1, end) != Ordering::Greater {
        end += 1;
    }
    end.min(hi)
}

/// Stable merge of the sorted runs `[lo, mid)` and `[mid, hi)` through an auxiliary buffer
/// holding a copy of the smaller run (shown as aux `name`).
pub fn merge(t: &mut Tracer, v: &mut [Item], lo: usize, mid: usize, hi: usize, name: &str) {
    if lo >= mid || mid >= hi {
        return;
    }
    if mid - lo <= hi - mid {
        let buf: Vec<Item> = (lo..mid).map(|i| t.read(v, i)).collect();
        t.aux(name, &buf);
        let (mut i, mut j, mut k) = (0usize, mid, lo);
        while i < buf.len() && j < hi {
            if t.cmp_at(&buf[i], v, j) != Ordering::Greater {
                t.set(v, k, buf[i]);
                i += 1;
            } else {
                let y = v[j];
                t.set(v, k, y);
                j += 1;
            }
            k += 1;
        }
        while i < buf.len() {
            t.set(v, k, buf[i]);
            i += 1;
            k += 1;
        }
    } else {
        let buf: Vec<Item> = (mid..hi).map(|i| t.read(v, i)).collect();
        t.aux(name, &buf);
        let mut i = mid; // one past the next left element
        let mut j = buf.len(); // one past the next right element
        let mut k = hi;
        while i > lo && j > 0 {
            k -= 1;
            if t.cmp_at(&buf[j - 1], v, i - 1) == Ordering::Less {
                let y = v[i - 1];
                t.set(v, k, y);
                i -= 1;
            } else {
                t.set(v, k, buf[j - 1]);
                j -= 1;
            }
        }
        while j > 0 {
            k -= 1;
            t.set(v, k, buf[j - 1]);
            j -= 1;
        }
    }
    t.aux_clear(name);
}

/// Stable in-place merge by binary search and rotation, no buffer (GrailSort's
/// `grail_MergeWithoutBuffer`, after Dudziński & Dydek 1981).
pub fn merge_rotations(t: &mut Tracer, v: &mut [Item], lo: usize, mid: usize, hi: usize) {
    let (mut a, mut l1, mut l2) = (lo, mid - lo, hi - mid);
    if l1 == 0 || l2 == 0 {
        return;
    }
    if l1 < l2 {
        while l1 > 0 {
            // first position in the right run whose key is >= v[a]
            let x = v[a];
            let h = lower_bound(t, v, a + l1, a + l1 + l2, &x) - (a + l1);
            if h != 0 {
                rotate(t, v, a, a + l1, a + l1 + h);
                a += h;
                l2 -= h;
            }
            if l2 == 0 {
                break;
            }
            loop {
                a += 1;
                l1 -= 1;
                if l1 == 0 || t.cmp(v, a, a + l1) == Ordering::Greater {
                    break;
                }
            }
        }
    } else {
        while l2 > 0 {
            // first position in the left run whose key is > the last right element
            let x = v[a + l1 + l2 - 1];
            let h = upper_bound(t, v, a, a + l1, &x) - a;
            if h != l1 {
                rotate(t, v, a + h, a + l1, a + l1 + l2);
                l1 = h;
            }
            if l1 == 0 {
                break;
            }
            loop {
                l2 -= 1;
                if l2 == 0 || t.cmp(v, a + l1 - 1, a + l1 + l2 - 1) == Ordering::Greater {
                    break;
                }
            }
        }
    }
}

/// Stable merge of `[lo, mid)` and `[mid, hi)` through an internal buffer `[buf, buf+m)`
/// elsewhere in `v` with `m >= mid - lo`, by swaps only (the buffer's contents are
/// permuted, never lost): the technique of Huang & Langston and GrailSort.
pub fn merge_swap_buffer(
    t: &mut Tracer,
    v: &mut [Item],
    buf: usize,
    lo: usize,
    mid: usize,
    hi: usize,
) {
    let l1 = mid - lo;
    if l1 == 0 || mid >= hi {
        return;
    }
    block_swap(t, v, lo, buf, l1);
    let (mut i, iend) = (buf, buf + l1);
    let mut j = mid;
    let mut out = lo;
    while i < iend && j < hi {
        if t.cmp(v, i, j) != Ordering::Greater {
            t.swap(v, out, i);
            i += 1;
        } else {
            t.swap(v, out, j);
            j += 1;
        }
        out += 1;
    }
    while i < iend {
        t.swap(v, out, i);
        out += 1;
        i += 1;
    }
}

/// Like [`merge_swap_buffer`] but the right run is the one moved to the buffer
/// (`m >= hi - mid`); merges from the back.
pub fn merge_swap_buffer_right(
    t: &mut Tracer,
    v: &mut [Item],
    buf: usize,
    lo: usize,
    mid: usize,
    hi: usize,
) {
    let l2 = hi - mid;
    if l2 == 0 || lo >= mid {
        return;
    }
    block_swap(t, v, mid, buf, l2);
    let mut i = mid; // one past next left
    let mut j = buf + l2; // one past next right (in buffer)
    let mut out = hi;
    while i > lo && j > buf {
        out -= 1;
        if t.cmp(v, i - 1, j - 1) == Ordering::Greater {
            t.swap(v, out, i - 1);
            i -= 1;
        } else {
            t.swap(v, out, j - 1);
            j -= 1;
        }
    }
    while j > buf {
        out -= 1;
        t.swap(v, out, j - 1);
        j -= 1;
    }
}

/// Sift-down in the max-heap stored in `[lo, end)` (node `root` is relative to `lo`).
pub fn sift_down(t: &mut Tracer, v: &mut [Item], lo: usize, mut root: usize, end: usize) {
    let n = end - lo;
    loop {
        let mut child = 2 * root + 1;
        if child >= n {
            break;
        }
        if child + 1 < n && t.cmp(v, lo + child, lo + child + 1) == Ordering::Less {
            child += 1;
        }
        if t.cmp(v, lo + root, lo + child) != Ordering::Less {
            break;
        }
        t.swap(v, lo + root, lo + child);
        root = child;
    }
}

/// Heapsort of `[lo, hi)` (Williams 1964 with Floyd's 1964 heap construction).
pub fn heapsort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    let n = hi - lo;
    if n < 2 {
        return;
    }
    for root in (0..n / 2).rev() {
        sift_down(t, v, lo, root, hi);
    }
    for end in (1..n).rev() {
        t.swap(v, lo, lo + end);
        sift_down(t, v, lo, 0, lo + end);
    }
}

/// Sorts `v[a], v[b], v[c]` (by swaps) so that `v[a] <= v[b] <= v[c]`.
pub fn sort3(t: &mut Tracer, v: &mut [Item], a: usize, b: usize, c: usize) {
    if t.cmp(v, b, a) == Ordering::Less {
        t.swap(v, a, b);
    }
    if t.cmp(v, c, b) == Ordering::Less {
        t.swap(v, b, c);
        if t.cmp(v, b, a) == Ordering::Less {
            t.swap(v, a, b);
        }
    }
}

/// An `std::sort`-like comparison sort of `[lo, hi)`: median-of-3 quicksort with an
/// insertion-sort cutoff of 16 and a heapsort fallback at depth 2 log2 n (Musser 1997).
/// Used as the comparison fallback of hybrid distribution sorts (Spreadsort, SkaSort, …).
pub fn std_sort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    let n = hi - lo;
    if n < 2 {
        return;
    }
    let depth = 2 * (usize::BITS - n.leading_zeros()) as usize;
    std_sort_rec(t, v, lo, hi, depth);
}

fn std_sort_rec(t: &mut Tracer, v: &mut [Item], mut lo: usize, mut hi: usize, mut depth: usize) {
    loop {
        let n = hi - lo;
        if n <= 16 {
            insertion(t, v, lo, hi);
            return;
        }
        if depth == 0 {
            heapsort(t, v, lo, hi);
            return;
        }
        depth -= 1;
        let mid = lo + n / 2;
        sort3(t, v, lo, mid, hi - 1);
        t.swap(v, lo, mid);
        // Hoare partition around v[lo]
        let pivot = v[lo];
        let (mut i, mut j) = (lo, hi);
        loop {
            i += 1;
            while i < hi && t.cmp_at(&pivot, v, i) == Ordering::Greater {
                i += 1;
            }
            j -= 1;
            while t.cmp_at(&pivot, v, j) == Ordering::Less {
                j -= 1;
            }
            if i >= j {
                break;
            }
            t.swap(v, i, j);
        }
        t.swap(v, lo, j);
        if j - lo < hi - j - 1 {
            std_sort_rec(t, v, lo, j, depth);
            lo = j + 1;
        } else {
            std_sort_rec(t, v, j + 1, hi, depth);
            hi = j;
        }
    }
}

/// Smallest and largest key of `v` (reads every element once). `None` when empty.
pub fn key_range(t: &mut Tracer, v: &[Item]) -> Option<(i32, i32)> {
    if v.is_empty() {
        return None;
    }
    let first = t.read(v, 0);
    let (mut lo, mut hi) = (first.key, first.key);
    for i in 1..v.len() {
        let x = t.read(v, i);
        lo = lo.min(x.key);
        hi = hi.max(x.key);
    }
    Some((lo, hi))
}

/// Order-preserving map of a signed key to an unsigned one (flips the sign bit).
#[inline]
pub fn biased(key: i32) -> u32 {
    (key as u32) ^ 0x8000_0000
}

/// `floor(log2 n)` for `n >= 1`.
#[inline]
pub fn log2(n: usize) -> u32 {
    usize::BITS - 1 - n.max(1).leading_zeros()
}

/// Writes `items` into `v[lo..lo+items.len()]` through the tracer.
pub fn write_back(t: &mut Tracer, v: &mut [Item], lo: usize, items: &[Item]) {
    for (k, x) in items.iter().enumerate() {
        t.set(v, lo + k, *x);
    }
}

/// GrailSort's `grail_FindKeys`: gathers up to `want` distinct keys (the first occurrence of
/// each value, scanning left to right) into a sorted block at `lo`, moving the block along
/// with rotations so that the other elements keep their order. Returns how many were found.
pub fn find_keys(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, want: usize) -> usize {
    if hi <= lo {
        return 0;
    }
    let (mut h, mut h0, mut u) = (1usize, lo, lo + 1);
    while u < hi && h < want {
        let x = v[u];
        let r = lower_bound(t, v, h0, h0 + h, &x) - h0;
        if r == h || t.cmp(v, u, h0 + r) != Ordering::Equal {
            rotate(t, v, h0, h0 + h, u);
            h0 = u - h;
            rotate(t, v, h0 + r, u, u + 1);
            h += 1;
        }
        u += 1;
    }
    rotate(t, v, lo, h0, h0 + h);
    t.mark(lo, lo + h, "keys");
    h
}

/// GrailSort's `grail_LazyStableSort`: sorted pairs, then bottom-up merges by rotation.
pub fn lazy_stable_sort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    let len = hi - lo;
    let mut m = 1;
    while m < len {
        if t.cmp(v, lo + m - 1, lo + m) == Ordering::Greater {
            t.swap(v, lo + m - 1, lo + m);
        }
        m += 2;
    }
    let mut h = 2;
    while h < len {
        let mut p0 = 0;
        while p0 + 2 * h <= len {
            merge_rotations(t, v, lo + p0, lo + p0 + h, lo + p0 + 2 * h);
            p0 += 2 * h;
        }
        if len - p0 > h {
            merge_rotations(t, v, lo + p0, lo + p0 + h, hi);
        }
        h *= 2;
    }
}

/// How the local merges of a block merge are done.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LocalMerge {
    /// Through the internal buffer at this position (swaps; buffer size >= block size).
    Buffer(usize),
    /// Through an external cache of at most this many items (aux `cache`).
    Cache(usize),
    /// By binary search and rotation (no buffer).
    Rotation,
}

fn local_merge(t: &mut Tracer, v: &mut [Item], how: LocalMerge, lo: usize, mid: usize, hi: usize) {
    if lo >= mid || mid >= hi {
        return;
    }
    match how {
        LocalMerge::Buffer(b) => merge_swap_buffer(t, v, b, lo, mid, hi),
        LocalMerge::Cache(c) if mid - lo <= c => {
            let cache: Vec<Item> = (lo..mid).map(|i| t.read(v, i)).collect();
            t.aux("cache", &cache);
            let (mut i, mut j, mut k) = (0usize, mid, lo);
            while i < cache.len() && j < hi {
                if t.cmp_at(&cache[i], v, j) != Ordering::Greater {
                    t.set(v, k, cache[i]);
                    i += 1;
                } else {
                    let y = v[j];
                    t.set(v, k, y);
                    j += 1;
                }
                k += 1;
            }
            while i < cache.len() {
                t.set(v, k, cache[i]);
                i += 1;
                k += 1;
            }
        }
        _ => merge_rotations(t, v, lo, mid, hi),
    }
}

/// Merges `[a0, a1)` and `[a1, b1)` with `how` (no block rolling).
pub fn plain_local_merge(
    t: &mut Tracer,
    v: &mut [Item],
    how: LocalMerge,
    a0: usize,
    a1: usize,
    b1: usize,
) {
    local_merge(t, v, how, a0, a1, b1);
}

/// The block merge of Kim & Kutzner 2008 as implemented by WikiSort (McFadden): the A run is
/// cut into blocks of `bl` (an uneven first part stays in front); the A blocks are "rolled"
/// through B (each roll swaps the leftmost A block with the next B block), and the smallest
/// A block is "dropped" behind the last B block as soon as its first element is <= that B
/// block's last element; each dropped block is merged locally with the B values before it.
/// A blocks are told apart by distinct tag keys at `keys` (one per block, ascending), which
/// move with their blocks; ties between equal A heads are broken by the tags (stability).
pub fn roll_merge(
    t: &mut Tracer,
    v: &mut [Item],
    keys: usize,
    how: LocalMerge,
    bl: usize,
    a0: usize,
    a1: usize,
    b1: usize,
) {
    let r = (a1 - a0) % bl;
    let m = (a1 - a0 - r) / bl;
    if m == 0 || b1 <= a1 {
        local_merge(t, v, how, a0, a1, b1);
        return;
    }
    t.mark(a0, b1, "block merge");
    let mut kstart = keys;
    let (mut ba0, mut ba1) = (a0 + r, a1); // the region of A blocks
    let (mut la0, mut la1) = (a0, a0 + r); // last A
    let (mut lb0, mut lb1) = (a1, a1); // last B
    let (mut bb0, mut bb1) = (a1, (a1 + bl).min(b1)); // next B block
    let mut min_a = ba0;
    loop {
        let drop = (lb1 > lb0 && t.cmp(v, lb1 - 1, min_a) != Ordering::Less) || bb1 == bb0;
        if drop {
            let x = v[min_a];
            let b_split = lower_bound(t, v, lb0, lb1, &x);
            let b_rem = lb1 - b_split;
            if min_a != ba0 {
                block_swap(t, v, ba0, min_a, bl);
                let ks = kstart + (min_a - ba0) / bl;
                t.swap(v, kstart, ks);
            }
            local_merge(t, v, how, la0, la1, b_split);
            rotate(t, v, b_split, ba0, ba0 + bl);
            la0 = ba0 - b_rem;
            la1 = la0 + bl;
            lb0 = la1;
            lb1 = la1 + b_rem;
            ba0 += bl;
            kstart += 1;
            if ba0 == ba1 {
                break;
            }
            min_a = ba0;
            let mut p = ba0 + bl;
            while p < ba1 {
                let c = t.cmp(v, p, min_a);
                let smaller = c == Ordering::Less
                    || (c == Ordering::Equal
                        && t.cmp(v, kstart + (p - ba0) / bl, kstart + (min_a - ba0) / bl)
                            == Ordering::Less);
                if smaller {
                    min_a = p;
                }
                p += bl;
            }
        } else if bb1 - bb0 < bl {
            let lb = bb1 - bb0;
            rotate(t, v, ba0, bb0, bb1);
            lb0 = ba0;
            lb1 = ba0 + lb;
            ba0 += lb;
            ba1 += lb;
            min_a += lb;
            bb0 = bb1;
        } else {
            let cnt = (ba1 - ba0) / bl;
            block_swap(t, v, ba0, bb0, bl);
            lb0 = ba0;
            lb1 = ba0 + bl;
            if min_a == ba0 {
                min_a = ba1;
            }
            rotate(t, v, kstart, kstart + 1, kstart + cnt);
            ba0 += bl;
            ba1 += bl;
            bb0 += bl;
            bb1 = (bb1 + bl).min(b1);
        }
    }
    local_merge(t, v, how, la0, la1, b1);
    insertion(t, v, keys, keys + m);
}
