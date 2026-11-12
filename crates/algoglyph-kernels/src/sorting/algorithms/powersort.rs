//! Powersort (Munro & Wild 2018, "Nearly-Optimal Mergesorts: Fast, Practical Sorting Methods
//! That Optimally Adapt to Existing Runs", ESA, LIPIcs 112; the merge policy of CPython's
//! `list.sort` since 3.11, Objects/listsort.txt). Runs are found left to right; between two
//! adjacent runs the "power" of their boundary is the depth at which the boundary's
//! midpoints first fall into different halves in the binary subdivision of [0, n): the
//! smallest l with ⌊a 2^l⌋ != ⌊b 2^l⌋ for the normalised midpoints a, b (CPython's
//! `powerloop`). The stack is merged while its top boundary has a larger power than the
//! new one, which yields a nearly optimal merge tree (cost within n of the run-length
//! entropy bound). As in CPython, short runs are extended to `minrun` by binary insertion.
//! Simplified: plain merges through a buffer (aux `buffer`) instead of CPython's galloping
//! merges. Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "powersort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

fn minrun(mut n: usize) -> usize {
    let mut r = 0;
    while n >= 64 {
        r |= n & 1;
        n >>= 1;
    }
    n + r
}

/// CPython's `powerloop(s1, n1, n2, n)`.
fn power(s1: usize, n1: usize, n2: usize, n: usize) -> u32 {
    let mut result = 0;
    let mut a = 2 * s1 + n1;
    let mut b = a + n1 + n2;
    loop {
        result += 1;
        if a >= n {
            a -= n;
            b -= n;
        } else if b >= n {
            break;
        }
        a <<= 1;
        b <<= 1;
    }
    result
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let min_run = minrun(n);
    // (start, len, power of the boundary to the run above it)
    let mut stack: Vec<(usize, usize, u32)> = Vec::new();
    let mut lo = 0;
    while lo < n {
        let mut end = kit::ascending_run(t, v, lo, n);
        if end - lo < min_run {
            let force = (lo + min_run).min(n);
            kit::binary_insertion(t, v, lo, end, force);
            end = force;
        }
        t.mark(lo, end, "run");
        let len = end - lo;
        if let Some(&(s1, n1, _)) = stack.last() {
            let p = power(s1, n1, len, n);
            while stack.len() > 1 && stack[stack.len() - 2].2 > p {
                merge_at(t, v, &mut stack);
            }
            let top = stack.len() - 1;
            stack[top].2 = p;
        }
        stack.push((lo, len, 0));
        lo = end;
    }
    while stack.len() > 1 {
        merge_at(t, v, &mut stack);
    }
    Outcome::Sorted
}

/// Merges the two runs below the top-most pending boundary (stack[h-2] and stack[h-1]).
fn merge_at(t: &mut Tracer, v: &mut [Item], stack: &mut Vec<(usize, usize, u32)>) {
    let (sb, lb, pb) = stack.pop().unwrap();
    let (sa, la, _) = stack.pop().unwrap();
    t.mark(sa, sb + lb, "merge");
    kit::merge(t, v, sa, sb, sb + lb, "buffer");
    stack.push((sa, la + lb, pb));
}
