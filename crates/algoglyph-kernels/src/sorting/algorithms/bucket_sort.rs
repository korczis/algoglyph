//! Bucket Sort (Isaac & Singleton 1956; Cormen et al. 2022, §8.4 BUCKET-SORT): the key range
//! is divided into n equal intervals (buckets); every element is appended to the bucket of
//! its key, each bucket is sorted by insertion sort, and the buckets are concatenated.
//! Expected Θ(n) when the keys are uniformly distributed, Θ(n^2) when they all fall into one
//! bucket. The buckets are shown together as aux `buckets` (in bucket order). Stable.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "bucket-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let Some((lo, hi)) = kit::key_range(t, v) else {
        return Outcome::Sorted;
    };
    if lo == hi {
        return Outcome::Sorted;
    }
    let span = hi as i64 - lo as i64 + 1;
    let mut buckets: Vec<Vec<Item>> = vec![Vec::new(); n];
    t.phase(&format!("distribute into {n} buckets"));
    for i in 0..n {
        let x = t.read(v, i);
        let b = ((x.key as i64 - lo as i64) as i128 * n as i128 / span as i128) as usize;
        buckets[b].push(x);
    }
    let flat = |bs: &[Vec<Item>]| -> Vec<Item> { bs.iter().flatten().copied().collect() };
    t.aux("buckets", &flat(&buckets));
    t.phase("insertion-sort each bucket");
    for b in buckets.iter_mut() {
        for i in 1..b.len() {
            let mut j = i;
            while j > 0 && t.cmp_items(&b[j - 1], &b[j]) == Ordering::Greater {
                b.swap(j - 1, j);
                j -= 1;
            }
        }
    }
    t.aux("buckets", &flat(&buckets));
    t.phase("concatenate");
    let out = flat(&buckets);
    kit::write_back(t, v, 0, &out);
    t.aux_clear("buckets");
    Outcome::Sorted
}
