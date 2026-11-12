//! Cycle Sort (Haddon 1990, "Cycle-sort: a linear sorting method", The Computer Journal
//! 33(4)): the permutation is decomposed into cycles; for each start position the held
//! element's final position is computed by counting the smaller elements after the start,
//! skipping past equal ones, and it is written there, picking up the element it displaces,
//! until the cycle closes. Every element is written at most once to its final place, so the
//! number of writes is minimal (Θ(n^2) comparisons). Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "cycle-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    for start in 0..n.saturating_sub(1) {
        let mut item = t.read(v, start);
        let mut pos = position(t, v, start, &item);
        if pos == start {
            continue;
        }
        t.mark(start, n, "cycle");
        while t.cmp_at(&item, v, pos) == Ordering::Equal {
            pos += 1;
        }
        let displaced = t.read(v, pos);
        t.set(v, pos, item);
        item = displaced;
        while pos != start {
            pos = position(t, v, start, &item);
            while pos != start && t.cmp_at(&item, v, pos) == Ordering::Equal {
                pos += 1;
            }
            let displaced = t.read(v, pos);
            t.set(v, pos, item);
            item = displaced;
        }
    }
    Outcome::Sorted
}

/// `start` plus the number of elements after `start` that are smaller than `item`.
fn position(t: &mut Tracer, v: &[Item], start: usize, item: &Item) -> usize {
    let mut pos = start;
    for i in (start + 1)..v.len() {
        if t.cmp_at(item, v, i) == Ordering::Greater {
            pos += 1;
        }
    }
    pos
}
