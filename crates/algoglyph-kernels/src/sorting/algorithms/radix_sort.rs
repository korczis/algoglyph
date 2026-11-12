//! Radix Sort (the method of punched-card sorting machines; Cormen et al. 2022, §8.3
//! RADIX-SORT; Knuth 1998, §5.2.5): least significant digit first, every digit pass a
//! stable counting sort (aux `count` and `output`), so after the pass on digit d the keys are sorted by their last
//! d digits. Decimal digits by default, as in the textbook (`options.base` sets 2…65536).
//! Keys are offset by the minimum, so negative keys work. Θ(d (n + b)) for d digits in base
//! b. Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "radix-sort",
    stable: Stability::Yes,
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
    let off = |x: &Item| (x.key as i64 - lo as i64) as u64;
    let mut place = 1u64;
    let mut digit = 0;
    while max / place > 0 {
        digit += 1;
        t.phase(&format!("counting sort on digit {digit} (base {base})"));
        let mut count = vec![0usize; base as usize];
        for i in 0..n {
            let x = t.read(v, i);
            count[((off(&x) / place) % base) as usize] += 1;
        }
        let snap: Vec<Item> = count
            .iter()
            .enumerate()
            .map(|(d, &c)| Item::new(c as i32, d as u32))
            .collect();
        t.aux("count", &snap);
        for d in 1..base as usize {
            count[d] += count[d - 1];
        }
        let mut out = vec![Item::default(); n];
        for i in (0..n).rev() {
            let x = t.read(v, i);
            let d = ((off(&x) / place) % base) as usize;
            count[d] -= 1;
            out[count[d]] = x;
        }
        t.aux("output", &out);
        kit::write_back(t, v, 0, &out);
        match place.checked_mul(base) {
            Some(p) => place = p,
            None => break,
        }
    }
    t.aux_clear("count");
    t.aux_clear("output");
    Outcome::Sorted
}
