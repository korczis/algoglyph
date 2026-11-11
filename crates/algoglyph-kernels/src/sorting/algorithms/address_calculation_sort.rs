//! Address Calculation Sort (Isaac & Singleton 1956, "Sorting by Address Calculation",
//! Journal of the ACM 3(3)): every key is sent to an address of a larger table (aux
//! `table`, 2n cells) by a monotone address function, here linear interpolation
//! ⌊(2n - 1)(x - min) / (max - min)⌋. If the cell is taken, the key is placed next to its
//! neighbours so that the occupied cells stay in key order, shifting keys towards the
//! nearest empty cell; finally the occupied cells are read out in order. O(n) expected for
//! uniform keys, O(n^2) in the worst case. Equal keys go after the ones already placed
//! (stable).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "address-calculation-sort",
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
    let m = 2 * n;
    let span = hi as i64 - lo as i64;
    let addr =
        |x: &Item| ((m - 1) as i128 * (x.key as i64 - lo as i64) as i128 / span as i128) as usize;
    let mut table: Vec<Option<Item>> = vec![None; m];
    t.phase("place keys at their computed addresses");
    for i in 0..n {
        let x = t.read(v, i);
        let mut pos = addr(&x);
        // move left past occupied cells with larger keys
        loop {
            let mut q = pos;
            while q > 0 && table[q - 1].is_none() {
                q -= 1;
            }
            if q > 0 && t.cmp_items(table[q - 1].as_ref().unwrap(), &x) == Ordering::Greater {
                pos = q - 1;
            } else {
                break;
            }
        }
        // move right past occupied cells with keys <= x
        loop {
            let mut q = pos;
            while q < m && table[q].is_none() {
                q += 1;
            }
            if q < m && t.cmp_items(table[q].as_ref().unwrap(), &x) != Ordering::Greater {
                pos = q + 1;
            } else {
                break;
            }
        }
        // x belongs between cells pos - 1 and pos
        if pos < m && table[pos].is_none() {
            table[pos] = Some(x);
        } else if pos > 0 && table[pos - 1].is_none() {
            table[pos - 1] = Some(x);
        } else {
            let mut r = pos;
            while r < m && table[r].is_some() {
                r += 1;
            }
            if r < m {
                for k in (pos..r).rev() {
                    table[k + 1] = table[k];
                }
                table[pos] = Some(x);
            } else {
                let mut l = pos - 1;
                while table[l].is_some() {
                    l -= 1;
                }
                for k in (l + 1)..pos {
                    table[k - 1] = table[k];
                }
                table[pos - 1] = Some(x);
            }
        }
        if i % 8 == 7 || i + 1 == n {
            let snap: Vec<Item> = table.iter().flatten().copied().collect();
            t.aux("table", &snap);
        }
    }
    let out: Vec<Item> = table.into_iter().flatten().collect();
    kit::write_back(t, v, 0, &out);
    t.aux_clear("table");
    Outcome::Sorted
}
