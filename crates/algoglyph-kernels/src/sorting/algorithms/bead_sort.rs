//! Bead Sort / Gravity Sort (Arulanandham, Calude & Dinneen 2002, "Bead-Sort: A Natural
//! Sorting Algorithm", Bulletin of the EATCS 76): every number is a row of beads on vertical
//! poles of an abacus; when the beads fall, pole j holds as many beads as there are numbers
//! greater than j, and reading the rows from the top gives the numbers in ascending order.
//! The simulation drops one row at a time (aux `poles`, the bead count per pole) and reads
//! the rows back. Keys are offset by the minimum so that negative keys work. O(n · max) bead
//! moves; a range above 2^17 or more than 2^26 beads is refused.
//!
//! Bead sort sorts numbers, not records: the beads do not remember which row they came from.
//! The tags (record identities) are re-attached to the output keys afterwards, equal keys in
//! input order; that bookkeeping is not part of the algorithm.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "bead-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Special,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let Some((lo, hi)) = kit::key_range(t, v) else {
        return Outcome::Sorted;
    };
    let max = hi as i64 - lo as i64;
    if max > (1 << 17) || (n as i64) * max > (1 << 26) {
        return Outcome::Unsupported(
            "bead sort: too many beads (range above 2^17 or n·range above 2^26)",
        );
    }
    let max = max as usize;
    let mut poles = vec![0usize; max];
    let snap = |p: &[usize]| -> Vec<Item> {
        p.iter()
            .enumerate()
            .map(|(j, &c)| Item::new(c as i32, j as u32))
            .collect()
    };
    t.phase("drop the beads");
    let mut tags: Vec<Vec<u32>> = vec![Vec::new(); max + 1];
    for i in 0..n {
        let x = t.read(v, i);
        let u = (x.key as i64 - lo as i64) as usize;
        for p in poles.iter_mut().take(u) {
            *p += 1;
        }
        tags[u].push(x.tag);
        if max > 0 && (i % 4 == 3 || i + 1 == n) {
            t.aux("poles", &snap(&poles));
        }
    }
    t.phase("read the rows from the top");
    // row r (0 = top) has as many beads as poles with height > n - 1 - r
    let mut next_tag = vec![0usize; max + 1];
    for r in 0..n {
        let level = n - r; // a pole contributes a bead to this row if its height >= level
        let mut u = 0;
        while u < max && poles[u] >= level {
            u += 1;
        }
        let tag = tags[u][next_tag[u]];
        next_tag[u] += 1;
        t.set(v, r, Item::new((lo as i64 + u as i64) as i32, tag));
    }
    t.aux_clear("poles");
    Outcome::Sorted
}
