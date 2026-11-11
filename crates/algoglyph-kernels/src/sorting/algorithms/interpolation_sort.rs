//! Interpolation Sort (a recursive bucket sort by linear interpolation, in the form of the
//! common textbook description; its first publication is not established here): with min
//! and max of the current range,
//! every element goes to bucket ⌊(m - 1)(x - min) / (max - min)⌋ of m = (range size) buckets
//! by linear interpolation; the buckets are recursively sorted the same way (a bucket whose
//! keys are all equal is done) and concatenated. Buckets are aux `buckets` (in order). O(n)
//! expected for uniform keys. Stable (elements keep their order inside a bucket).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "interpolation-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let items: Vec<Item> = (0..n).map(|i| t.read(v, i)).collect();
    let mut out = Vec::with_capacity(n);
    interp(t, items, &mut out, 0);
    kit::write_back(t, v, 0, &out);
    t.aux_clear("buckets");
    Outcome::Sorted
}

fn interp(t: &mut Tracer, items: Vec<Item>, out: &mut Vec<Item>, depth: usize) {
    let m = items.len();
    if m <= 1 {
        out.extend(items);
        return;
    }
    let (mut lo, mut hi) = (items[0], items[0]);
    for x in &items[1..] {
        if t.cmp_items(x, &lo) == Ordering::Less {
            lo = *x;
        }
        if t.cmp_items(x, &hi) == Ordering::Greater {
            hi = *x;
        }
    }
    if lo.key == hi.key {
        out.extend(items);
        return;
    }
    let span = hi.key as i64 - lo.key as i64;
    let mut buckets: Vec<Vec<Item>> = vec![Vec::new(); m];
    for x in items {
        let b = ((m - 1) as i128 * (x.key as i64 - lo.key as i64) as i128 / span as i128) as usize;
        buckets[b].push(x);
    }
    if depth == 0 {
        let flat: Vec<Item> = buckets.iter().flatten().copied().collect();
        t.phase(&format!("interpolate into {m} buckets"));
        t.aux("buckets", &flat);
    }
    for b in buckets {
        interp(t, b, out, depth + 1);
    }
}
