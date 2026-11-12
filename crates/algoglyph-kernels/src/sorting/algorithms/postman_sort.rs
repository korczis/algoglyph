//! Postman Sort (Ramey 1992, "Postman's Sort", C Users Journal 10(8)): sorting the way mail is
//! sorted, by the most significant part of the address first (country, then city, then
//! street): an MSD bucket sort over decimal digits (`options.base` sets 2…65536) of the keys
//! offset by the minimum. Each pass distributes a group into the buckets of the current digit
//! in arrival order (aux `buckets`), and every bucket is sorted recursively on the next digit
//! before the buckets are concatenated. Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "postman-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let base = if (2..=65536).contains(&opt.base) {
        opt.base as u64
    } else {
        10
    };
    let n = v.len();
    let Some((lo, hi)) = kit::key_range(t, v) else {
        return Outcome::Sorted;
    };
    let max = (hi as i64 - lo as i64) as u64;
    let mut place = 1u64;
    while max / place >= base {
        place *= base;
    }
    let items: Vec<(u64, Item)> = (0..n)
        .map(|i| {
            let x = t.read(v, i);
            ((x.key as i64 - lo as i64) as u64, x)
        })
        .collect();
    let mut out = Vec::with_capacity(n);
    postman(t, items, place, base, &mut out);
    kit::write_back(t, v, 0, &out);
    t.aux_clear("buckets");
    Outcome::Sorted
}

fn postman(t: &mut Tracer, items: Vec<(u64, Item)>, place: u64, base: u64, out: &mut Vec<Item>) {
    if items.len() <= 1 || place == 0 {
        out.extend(items.into_iter().map(|(_, x)| x));
        return;
    }
    let mut buckets: Vec<Vec<(u64, Item)>> = vec![Vec::new(); base as usize];
    for (k, x) in items {
        buckets[((k / place) % base) as usize].push((k, x));
    }
    let flat: Vec<Item> = buckets.iter().flatten().map(|(_, x)| *x).collect();
    t.aux("buckets", &flat);
    for b in buckets {
        postman(t, b, place / base, base, out);
    }
}
