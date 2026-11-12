//! Radix Exchange Sort (Hildebrandt & Isbitz 1959, "Radix exchange — an internal sorting
//! method for digital computers", Journal of the ACM 6(2); Knuth 1998, TAOCP 3, §5.2.2,
//! Algorithm R): binary MSD radix sort by exchanges. Looking at one bit (from the most
//! significant; keys with the sign bit flipped), a left index skips keys with bit 0 and a
//! right index skips keys with bit 1, the two found keys are exchanged, and the two parts are
//! sorted recursively on the next bit — quicksort with a bit as the "pivot". Not stable, in
//! place, Θ(n w) for w-bit keys.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "radix-exchange-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    exchange(t, v, 0, n, 31);
    Outcome::Sorted
}

fn bit(x: &Item, b: u32) -> bool {
    (kit::biased(x.key) >> b) & 1 == 1
}

fn exchange(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, b: i32) {
    if hi - lo < 2 || b < 0 {
        return;
    }
    let bb = b as u32;
    t.mark(lo, hi, &format!("bit {b}"));
    let (mut i, mut j) = (lo, hi);
    loop {
        while i < j && !bit(&t.read(v, i), bb) {
            i += 1;
        }
        while i < j && bit(&t.read(v, j - 1), bb) {
            j -= 1;
        }
        if i >= j {
            break;
        }
        t.swap(v, i, j - 1);
        i += 1;
        j -= 1;
    }
    exchange(t, v, lo, i, b - 1);
    exchange(t, v, i, hi, b - 1);
}
