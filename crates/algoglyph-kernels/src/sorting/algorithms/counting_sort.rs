//! Counting Sort (Seward 1954, MIT M.S. thesis "Information sorting in the application of
//! electronic digital computers to business operations"; Cormen et al. 2022, §8.2
//! COUNTING-SORT): the keys are counted in an array C over the key range (aux `C`), the
//! counts are turned into prefix sums (C[k] = number of keys <= k), and a backward pass
//! places every element at position C[key] - 1 of the output array B (aux `B`), which is
//! copied back. Θ(n + k) time and space for k distinct key values; stable. Keys are offset by
//! the minimum; a range above 2^20 values is refused.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "counting-sort",
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
        return Outcome::Unsupported("counting sort: key range above 2^20 values");
    }
    let k = k as usize;
    let mut c = vec![0u32; k];
    t.phase("count the keys");
    for i in 0..n {
        let x = t.read(v, i);
        c[(x.key as i64 - lo as i64) as usize] += 1;
    }
    let snap = |c: &[u32]| -> Vec<Item> {
        c.iter()
            .enumerate()
            .map(|(i, &x)| Item::new(x as i32, i as u32))
            .collect()
    };
    t.aux("C", &snap(&c));
    t.phase("prefix sums");
    for i in 1..k {
        c[i] += c[i - 1];
    }
    t.aux("C", &snap(&c));
    t.phase("place from the back into B");
    let mut b = vec![Item::default(); n];
    for i in (0..n).rev() {
        let x = t.read(v, i);
        let d = (x.key as i64 - lo as i64) as usize;
        c[d] -= 1;
        b[c[d] as usize] = x;
    }
    t.aux("B", &b);
    t.phase("copy back");
    kit::write_back(t, v, 0, &b);
    t.aux_clear("B");
    t.aux_clear("C");
    Outcome::Sorted
}
