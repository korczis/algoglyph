//! Merge-insertion sort (Ford and Johnson 1959, "A Tournament Problem", The American
//! Mathematical Monthly 66(5), 387-389; Knuth, TAOCP Vol. 3, 2nd ed., section 5.3.1).
//!
//! The documented strategy, without simplification of the comparisons:
//! 1. compare the elements in pairs (the straggler of an odd count waits);
//! 2. sort the larger element of every pair recursively by merge insertion;
//! 3. the main chain is b1, a1, a2, ... (b1 is a1's smaller partner, so it goes first);
//! 4. insert the pending b's in the Jacobsthal order b3 b2, b5 b4, b11 ... b6, ... by binary
//!    search, each b_i only into the part of the chain before its partner a_i, so every
//!    search spans at most 2^k - 1 elements.
//!
//! The algorithm works on positions: comparisons are made between the input positions
//! (that is what the trace highlights) and the final order is written back at the end.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "ford-johnson",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut partner = vec![usize::MAX; n];
    let order = merge_insertion(t, v, (0..n).collect(), &mut partner, 0);
    if !t.ok() {
        return Outcome::Truncated;
    }
    t.phase("write the main chain back");
    let items: Vec<Item> = order.iter().map(|&p| v[p]).collect();
    t.aux("main chain", &items);
    for (i, it) in items.into_iter().enumerate() {
        t.set(v, i, it);
    }
    Outcome::Sorted
}

/// Sorts the positions `elems` of `v` by merge insertion and returns them in order.
fn merge_insertion(
    t: &mut Tracer,
    v: &[Item],
    elems: Vec<usize>,
    partner: &mut Vec<usize>,
    level: usize,
) -> Vec<usize> {
    let n = elems.len();
    if n < 2 || !t.ok() {
        return elems;
    }
    t.phase(&format!("level {level}: compare {} pairs", n / 2));
    let mut bigs = Vec::with_capacity(n / 2);
    let mut small_of = Vec::with_capacity(n / 2);
    for k in 0..n / 2 {
        let (a, b) = (elems[2 * k], elems[2 * k + 1]);
        let (big, small) = if t.cmp(v, a, b) == Ordering::Greater {
            (a, b)
        } else {
            (b, a)
        };
        bigs.push(big);
        small_of.push((big, small));
    }
    let straggler = if n % 2 == 1 { Some(elems[n - 1]) } else { None };
    // Partners are looked up by position, saved per level because recursion reuses them.
    let saved: Vec<(usize, usize)> = small_of.clone();
    for &(big, small) in &saved {
        partner[big] = small;
    }
    let sorted_bigs = merge_insertion(t, v, bigs, partner, level + 1);
    // The recursion overwrote partners of deeper levels; restore this level's pairs.
    for &(big, small) in &saved {
        partner[big] = small;
    }
    if !t.ok() {
        return sorted_bigs;
    }
    t.phase(&format!(
        "level {level}: insert the pending elements in Jacobsthal order"
    ));
    // pend[i] = (b_{i+1}, Some(a_{i+1})) for i >= 1; the straggler has no partner.
    let mut chain: Vec<usize> = Vec::with_capacity(n);
    chain.push(partner[sorted_bigs[0]]);
    chain.extend_from_slice(&sorted_bigs);
    let mut pend: Vec<(usize, Option<usize>)> = sorted_bigs
        .iter()
        .skip(1)
        .map(|&a| (partner[a], Some(a)))
        .collect();
    if let Some(s) = straggler {
        pend.push((s, None));
    }
    let m = pend.len(); // pending elements b_2 .. b_{m+1}
    let mut done = 0usize; // how many b's (from b_2) are inserted
    let (mut prev, mut cur) = (1usize, 3usize); // Jacobsthal t_{k-1}, t_k (1-based b index)
    while done < m {
        let hi_b = cur.min(m + 1); // insert b_hi_b down to b_{prev+1}
        let mut b = hi_b;
        while b > prev {
            let (x, a) = pend[b - 2];
            let bound = match a {
                Some(a) => chain.iter().position(|&c| c == a).unwrap_or(chain.len()),
                None => chain.len(),
            };
            let pos = binary_search(t, v, &chain[..bound], x);
            chain.insert(pos, x);
            done += 1;
            b -= 1;
        }
        let next = cur + 2 * prev; // t_{k+1} = t_k + 2 t_{k-1}
        prev = cur;
        cur = next;
    }
    chain
}

/// First position in `chain` whose element is greater than `x`.
fn binary_search(t: &mut Tracer, v: &[Item], chain: &[usize], x: usize) -> usize {
    let (mut lo, mut hi) = (0usize, chain.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp(v, x, chain[mid]) == Ordering::Less {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
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
}
