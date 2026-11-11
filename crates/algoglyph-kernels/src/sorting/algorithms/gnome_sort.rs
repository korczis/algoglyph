//! Gnome Sort (Sarbazi-Azad 2000, "Stupid sort: a new sorting algorithm", Newsletter of the
//! Computing Science Department, Univ. of Glasgow; renamed by Grune): a single position moves
//! forward while neighbours are in order and steps back after swapping an out-of-order pair,
//! which amounts to insertion sort by adjacent swaps without a nested loop. Stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "gnome-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let mut pos = 0;
    while pos < n {
        if pos == 0 || t.cmp(v, pos - 1, pos) != Ordering::Greater {
            pos += 1;
        } else {
            t.swap(v, pos - 1, pos);
            pos -= 1;
        }
    }
    Outcome::Sorted
}
