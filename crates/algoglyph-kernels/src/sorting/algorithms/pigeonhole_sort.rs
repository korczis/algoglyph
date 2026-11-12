//! Pigeonhole Sort (Black, "pigeonhole sort", NIST Dictionary of Algorithms and Data
//! Structures): one pigeonhole per
//! possible key value between the minimum and the maximum; every element is moved into the
//! hole of its key (keeping arrival order), then the holes are emptied in key order. Θ(n + k)
//! for a key range k; unlike counting sort the elements themselves travel through the holes
//! (aux `holes`, shown in hole order). Stable. A range above 2^20 values is refused.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "pigeonhole-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Distribution,
};

const MAX_RANGE: i64 = 1 << 20;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let Some((lo, hi)) = kit::key_range(t, v) else {
        return Outcome::Sorted;
    };
    let k = hi as i64 - lo as i64 + 1;
    if k > MAX_RANGE {
        return Outcome::Unsupported("pigeonhole sort: key range above 2^20 values");
    }
    let mut holes: Vec<Vec<Item>> = vec![Vec::new(); k as usize];
    t.phase(&format!("move into {k} pigeonholes"));
    let mut held = 0usize;
    for i in 0..n {
        let x = t.read(v, i);
        holes[(x.key as i64 - lo as i64) as usize].push(x);
        held += 1;
        if (k <= 4096 && held % 8 == 0) || held == n {
            let flat: Vec<Item> = holes.iter().flatten().copied().collect();
            t.aux("holes", &flat);
        }
    }
    t.phase("empty the holes in order");
    let mut pos = 0;
    for h in holes.iter() {
        for x in h {
            t.set(v, pos, *x);
            pos += 1;
        }
    }
    t.aux_clear("holes");
    Outcome::Sorted
}
