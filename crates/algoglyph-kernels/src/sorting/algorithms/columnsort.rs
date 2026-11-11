//! Columnsort (Leighton 1985, "Tight bounds on the complexity of parallel sorting", IEEE
//! Transactions on Computers C-34(4), 344-354).
//!
//! The N items fill an r x s matrix in column-major order, with r divisible by s and
//! r >= 2 (s - 1)^2; the input is padded with +infinity to N = r * s. The eight steps:
//! 1 sort the columns; 2 "transpose" (read column-major, write row-major); 3 sort columns;
//! 4 the inverse of step 2; 5 sort columns; 6 shift down by r/2 (opening an extra column,
//! with -infinity on top of the first and +infinity below the last); 7 sort columns;
//! 8 the inverse of step 6. The column-major order is then sorted. Every column sort is a
//! set of s independent lanes (`t.lane(column)`), one phase per step; after every step
//! the real items are written back to the array in column-major order, so the trace shows
//! the matrix as it changes. The columns themselves are sorted by a merge sort.
//! No simplification of the eight steps; s is the largest value the bound allows.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "columnsort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Network,
};

#[derive(Clone, Copy)]
enum Cell {
    NegInf,
    Val(Item),
    PosInf,
}

fn cmp_cell(t: &mut Tracer, a: &Cell, b: &Cell) -> Ordering {
    match (a, b) {
        (Cell::Val(x), Cell::Val(y)) => t.cmp_items(x, y),
        (Cell::NegInf, Cell::NegInf) | (Cell::PosInf, Cell::PosInf) => Ordering::Equal,
        (Cell::NegInf, _) | (_, Cell::PosInf) => Ordering::Less,
        (Cell::PosInf, _) | (_, Cell::NegInf) => Ordering::Greater,
    }
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    // Largest s with r = ceil(n / s) rounded up to a multiple of s and r >= 2 (s - 1)^2.
    let (mut r, mut s) = (n, 1usize);
    for cand in (1..=n).rev() {
        let rr = n.div_ceil(cand).div_ceil(cand) * cand;
        if rr >= 2 * (cand - 1) * (cand - 1) && rr >= 1 {
            r = rr;
            s = cand;
            break;
        }
    }
    if r % 2 == 1 && s > 1 {
        r += s; // keep r even for the half shift (still a multiple of s)
    }
    t.phase(&format!("matrix {r} x {s}"));
    let mut m: Vec<Cell> = (0..r * s)
        .map(|i| {
            if i < n {
                Cell::Val(t.read(v, i))
            } else {
                Cell::PosInf
            }
        })
        .collect();
    let steps: [&str; 8] = [
        "step 1: sort columns",
        "step 2: transpose",
        "step 3: sort columns",
        "step 4: untranspose",
        "step 5: sort columns",
        "step 6: shift by r/2",
        "step 7: sort columns",
        "step 8: unshift",
    ];
    for (k, name) in steps.iter().enumerate() {
        if !t.ok() {
            return Outcome::Truncated;
        }
        t.phase(name);
        match k {
            0 | 2 | 4 => sort_columns(t, &mut m, r, s),
            1 => {
                // read column-major, write row-major
                let mut out = m.clone();
                for (p, cell) in m.iter().enumerate() {
                    let (row, col) = (p / s, p % s);
                    out[col * r + row] = *cell;
                }
                m = out;
            }
            3 => {
                let mut out = m.clone();
                for (p, slot) in out.iter_mut().enumerate() {
                    let (row, col) = (p / s, p % s);
                    *slot = m[col * r + row];
                }
                m = out;
            }
            5 => {
                let half = r / 2;
                let mut out = vec![Cell::NegInf; half];
                out.extend_from_slice(&m);
                out.extend(core::iter::repeat_n(Cell::PosInf, r - half));
                m = out;
            }
            6 => sort_columns(t, &mut m, r, s + 1),
            _ => {
                let half = r / 2;
                m = m[half..half + r * s].to_vec();
            }
        }
        write_back(t, v, &m);
    }
    Outcome::Sorted
}

fn sort_columns(t: &mut Tracer, m: &mut [Cell], r: usize, cols: usize) {
    for c in 0..cols {
        t.lane(c as u32);
        let col = &mut m[c * r..(c + 1) * r];
        merge_sort(t, col);
    }
}

fn merge_sort(t: &mut Tracer, a: &mut [Cell]) {
    let n = a.len();
    if n < 2 {
        return;
    }
    let mid = n / 2;
    merge_sort(t, &mut a[..mid]);
    merge_sort(t, &mut a[mid..]);
    let left = a[..mid].to_vec();
    let (mut i, mut j, mut k) = (0, mid, 0);
    while i < left.len() && j < n {
        if cmp_cell(t, &a[j], &left[i]) == Ordering::Less {
            a[k] = a[j];
            j += 1;
        } else {
            a[k] = left[i];
            i += 1;
        }
        k += 1;
    }
    while i < left.len() {
        a[k] = left[i];
        i += 1;
        k += 1;
    }
}

/// Writes the real items in column-major order back to the array.
fn write_back(t: &mut Tracer, v: &mut [Item], m: &[Cell]) {
    let mut i = 0;
    for cell in m {
        if let Cell::Val(x) = cell {
            if v[i].key != x.key || v[i].tag != x.tag {
                t.set(v, i, *x);
            }
            i += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(input: &[Item], opt: &Options) -> (Vec<Item>, Outcome, Tracer) {
        let mut t = Tracer::new(opt);
        let mut v = input.to_vec();
        let o = sort(&mut t, &mut v, opt);
        (v, o, t)
    }

    fn count_only() -> Options {
        Options {
            trace: false,
            max_steps: u32::MAX,
            ..Options::default()
        }
    }

    fn random(n: usize, lo: i64, hi: i64, r: &mut SplitMix64) -> Vec<Item> {
        (0..n)
            .map(|i| Item::new((lo + r.below((hi - lo + 1) as u64) as i64) as i32, i as u32))
            .collect()
    }

    fn keyed(keys: impl IntoIterator<Item = i32>) -> Vec<Item> {
        keys.into_iter()
            .enumerate()
            .map(|(i, k)| Item::new(k, i as u32))
            .collect()
    }

    const MAX_N: usize = 1000;

    fn inputs(max_n: usize) -> Vec<Vec<Item>> {
        let mut r = SplitMix64::new(0x7E57_5EED);
        let mut all = Vec::new();
        let sizes = [
            0usize, 1, 2, 3, 4, 5, 7, 8, 9, 13, 16, 17, 31, 33, 64, 100, 257, max_n,
        ];
        for &n in sizes.iter().filter(|&&n| n <= max_n) {
            let ni = n as i32;
            for &(lo, hi) in &[(0i64, 3i64), (-50, 50), (-100_000, 100_000)] {
                for _ in 0..3 {
                    all.push(random(n, lo, hi, &mut r));
                }
            }
            all.push(keyed(0..ni));
            all.push(keyed((0..ni).rev()));
            all.push(keyed((0..ni).map(|_| 7)));
            all.push(keyed((0..ni).map(|i| i.min(ni - 1 - i))));
            all.push(keyed((0..ni).map(|i| match i % 4 {
                0 => i32::MAX,
                1 => i32::MIN,
                2 => 0,
                _ => i * 1000,
            })));
        }
        all
    }

    fn check(input: &[Item]) {
        let (out, outcome, _) = run(input, &count_only());
        let span = input.iter().map(|x| x.key as i64).max().unwrap_or(0)
            - input.iter().map(|x| x.key as i64).min().unwrap_or(0);
        if matches!(outcome, Outcome::Unsupported(_)) && span > 100_000 {
            assert_eq!(out, input, "unsupported input must be left unchanged");
            return;
        }
        assert_eq!(outcome, Outcome::Sorted, "outcome on n = {}", input.len());
        let mut want = input.to_vec();
        want.sort_by_key(|x| x.key);
        let got: Vec<i32> = out.iter().map(|x| x.key).collect();
        let exp: Vec<i32> = want.iter().map(|x| x.key).collect();
        assert_eq!(got, exp, "order on n = {}", input.len());
        let mut a = out.clone();
        let mut b = input.to_vec();
        a.sort_by_key(|x| (x.key, x.tag));
        b.sort_by_key(|x| (x.key, x.tag));
        assert_eq!(a, b, "not a permutation on n = {}", input.len());
        if META.stable == Stability::Yes {
            assert_eq!(
                out,
                want,
                "equal keys lost their order on n = {}",
                input.len()
            );
        }
    }

    #[test]
    fn sorts_random_and_adversarial_inputs() {
        for input in inputs(MAX_N) {
            check(&input);
        }
    }

    #[test]
    fn stable_when_declared_or_at_least_correct_on_duplicates() {
        let mut r = SplitMix64::new(99);
        for &n in &[2usize, 9, 33, 100, 300] {
            for &hi in &[1i64, 2, 4, 10] {
                check(&random(n, 0, hi, &mut r));
            }
        }
    }

    #[test]
    fn step_limit_truncates() {
        let input = random(300, 0, 1000, &mut SplitMix64::new(11));
        let opt = Options {
            max_steps: 50,
            ..Options::default()
        };
        let (_, outcome, t) = run(&input, &opt);
        assert!(t.truncated() || outcome == Outcome::Truncated);
        assert!(t.steps().len() <= 50);
    }

    #[test]
    fn trace_replays_to_the_output_and_matches_count_only() {
        let input = random(50, -20, 20, &mut SplitMix64::new(23));
        let opt = Options {
            max_steps: 1_000_000,
            ..Options::default()
        };
        let (out, outcome, t) = run(&input, &opt);
        assert_eq!(outcome, Outcome::Sorted);
        let mut v = input.clone();
        for s in t.steps() {
            match *s {
                Step::Swap { i, j } => v.swap(i as usize, j as usize),
                Step::Set { i, key, tag } => v[i as usize] = Item::new(key, tag),
                _ => {}
            }
        }
        assert_eq!(v, out, "replaying swap/set does not give the output");
        let (out2, _, t2) = run(&input, &count_only());
        assert_eq!(out2, out);
        assert_eq!(t2.counts(), t.counts());
    }

    #[test]
    fn zero_one_principle_exhaustive() {
        for n in 0..=11usize {
            for mask in 0u32..(1u32 << n) {
                let input = keyed((0..n).map(|i| ((mask >> i) & 1) as i32));
                let (out, outcome, _) = run(&input, &count_only());
                assert_eq!(outcome, Outcome::Sorted);
                assert!(
                    out.windows(2).all(|w| w[0].key <= w[1].key),
                    "n = {n}, mask = {mask:b}"
                );
            }
        }
    }
}
