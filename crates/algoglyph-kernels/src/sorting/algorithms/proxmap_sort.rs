//! Proxmap Sort (Standish 1995, Data Structures, Algorithms and Software Principles in C,
//! Addison-Wesley; Standish & Jacobson 2005, "Using O(n) Proxmap Sort and O(lg n)
//! Proxmap Search to motivate CS2 students"): a map key ⌊(n - 1)(x - min) / (max - min)⌋
//! sends every key to one of n subarrays; the hit counts (aux `hits`) give the "proxmap", the
//! start of each subarray in the output; every element is then inserted into its subarray of
//! the output array (aux `A2`) by insertion sort among the elements already there. Since map
//! keys are monotone, concatenated subarrays are sorted. O(n) expected for uniform keys.
//! Insertion after equal keys keeps it stable.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "proxmap-sort",
    stable: Stability::Yes,
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
    let span = hi as i64 - lo as i64;
    let map_key =
        |x: &Item| ((n - 1) as i128 * (x.key as i64 - lo as i64) as i128 / span as i128) as usize;
    t.phase("hit counts");
    let mut hits = vec![0usize; n];
    let mut loc = vec![0usize; n];
    for i in 0..n {
        let x = t.read(v, i);
        loc[i] = map_key(&x);
        hits[loc[i]] += 1;
    }
    let snap: Vec<Item> = hits
        .iter()
        .enumerate()
        .map(|(k, &c)| Item::new(c as i32, k as u32))
        .collect();
    t.aux("hits", &snap);
    t.phase("proxmap");
    let mut prox = vec![0usize; n];
    let mut run = 0;
    for k in 0..n {
        prox[k] = run;
        run += hits[k];
    }
    t.phase("insert into subarrays");
    let mut a2: Vec<Option<Item>> = vec![None; n];
    let mut filled = vec![0usize; n];
    for i in 0..n {
        let x = t.read(v, i);
        let k = loc[i];
        let start = prox[k];
        let mut j = start + filled[k];
        while j > start && t.cmp_items(&x, a2[j - 1].as_ref().unwrap()) == Ordering::Less {
            a2[j] = a2[j - 1];
            j -= 1;
        }
        a2[j] = Some(x);
        filled[k] += 1;
        if i % 8 == 7 || i + 1 == n {
            let snap: Vec<Item> = a2.iter().flatten().copied().collect();
            t.aux("A2", &snap);
        }
    }
    let out: Vec<Item> = a2.into_iter().map(|x| x.unwrap()).collect();
    kit::write_back(t, v, 0, &out);
    t.aux_clear("A2");
    t.aux_clear("hits");
    Outcome::Sorted
}
