//! Spreadsort (Ross 2002, "The Spreadsort High-performance General-case Sorting Algorithm",
//! PDPTA; implemented as Boost.Sort `integer_sort`, boost.org/libs/sort). A hybrid of radix
//! and comparison sorting: the range [min, max] is split into 2^(log range - log divisor)
//! bins, where the divisor is chosen from the element count and the range so that bins hold
//! about 2^log_mean_bin_size elements and at most 2^max_splits bins are used; the elements
//! are moved into their bins in place (American-flag style cycles), and every bin is either
//! spread again recursively or, when it is small, sorted by a comparison sort (`std::sort`,
//! here the kit introsort). An already sorted range is detected while finding min and max.
//!
//! Boost constants: max_splits = 11, log_mean_bin_size = 2, max_finishing_splits = 10.
//! Simplified: Boost falls back to `std::sort` below min_sort_size = 1000 elements and uses
//! `get_min_count` per level; here the threshold is 16 elements by default (`options.k`
//! sets it, k = 1000 gives Boost's behaviour), so the spreading is visible on small inputs.
//! Not stable, in place (the bin counters are not items).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "spreadsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Distribution,
};

const MAX_SPLITS: u32 = 11;
const LOG_MEAN_BIN_SIZE: u32 = 2;
const MAX_FINISHING_SPLITS: u32 = 10;

fn rough_log_2_size(x: u64) -> u32 {
    64 - x.leading_zeros()
}

fn get_log_divisor(count: usize, log_range: u32) -> u32 {
    let lc = rough_log_2_size(count as u64);
    let mut log_divisor = log_range as i64 - lc as i64;
    if log_divisor <= 0 && log_range <= MAX_FINISHING_SPLITS {
        return 0;
    }
    log_divisor += LOG_MEAN_BIN_SIZE as i64;
    if log_divisor < 0 {
        log_divisor = 0;
    }
    if log_range as i64 - log_divisor > MAX_SPLITS as i64 {
        log_divisor = log_range as i64 - MAX_SPLITS as i64;
    }
    log_divisor as u32
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let min_sort = if opt.k >= 2 { opt.k as usize } else { 16 };
    let n = v.len();
    spread(t, v, 0, n, min_sort);
    Outcome::Sorted
}

fn spread(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, min_sort: usize) {
    let n = hi - lo;
    if n < 2 {
        return;
    }
    if n < min_sort {
        kit::std_sort(t, v, lo, hi);
        return;
    }
    // is_sorted_or_find_extremes
    let mut sorted = true;
    let (mut mn, mut mx) = (lo, lo);
    for i in lo + 1..hi {
        if sorted && t.cmp(v, i, i - 1) == Ordering::Less {
            sorted = false;
        }
        if t.cmp(v, i, mn) == Ordering::Less {
            mn = i;
        }
        if t.cmp(v, i, mx) == Ordering::Greater {
            mx = i;
        }
    }
    if sorted {
        return;
    }
    let min = v[mn].key as i64;
    let max = v[mx].key as i64;
    let log_range = rough_log_2_size((max - min) as u64);
    let log_divisor = get_log_divisor(n, log_range);
    let div_min = min >> log_divisor;
    let div_max = max >> log_divisor;
    let bins = (div_max - div_min + 1) as usize;
    if bins < 2 {
        kit::std_sort(t, v, lo, hi);
        return;
    }
    t.mark(lo, hi, &format!("spread into {bins} bins"));
    let bin_of = |x: &Item| ((x.key as i64 >> log_divisor) - div_min) as usize;
    let mut count = vec![0usize; bins];
    for i in lo..hi {
        let x = t.read(v, i);
        count[bin_of(&x)] += 1;
    }
    let mut start = vec![0usize; bins + 1];
    start[0] = lo;
    for b in 0..bins {
        start[b + 1] = start[b] + count[b];
    }
    let mut next: Vec<usize> = start[..bins].to_vec();
    for b in 0..bins {
        while next[b] < start[b + 1] {
            let i = next[b];
            let mut bx = bin_of(&v[i]);
            while bx != b {
                let j = next[bx];
                next[bx] += 1;
                t.swap(v, i, j);
                bx = bin_of(&v[i]);
            }
            next[b] += 1;
        }
    }
    if log_divisor == 0 {
        return; // every bin holds equal keys
    }
    for b in 0..bins {
        let (a, e) = (start[b], start[b + 1]);
        if e - a > 1 {
            t.mark(a, e, "bin");
            spread(t, v, a, e, min_sort);
        }
    }
}
