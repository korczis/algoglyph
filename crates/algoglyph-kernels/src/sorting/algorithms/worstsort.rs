//! Worstsort (Lerma 2014, "How inefficient can a sort algorithm be?", arXiv:1406.1077).
//!
//! Built from badsort: badsort(L, 0) is bubble sort; badsort(L, k) lists all permutations
//! of L, sorts that list lexicographically with badsort(., k - 1) and returns its first
//! element, which is L sorted. Worstsort(L) = badsort(L, f(n)) for an increasing f, which
//! makes the running time grow as fast as f is chosen to. The algorithm is real and
//! correct; only the size is limited.
//!
//! In this simulation f(n) = 2 for n <= 2 and f(n) = 1 for 3 <= n <= 5 (badsort over the
//! n! permutations, bubble-sorted lexicographically: 120 permutations at n = 5). For n >= 6
//! the run does not start and returns `Outcome::Truncated`: at n = 6, f = 1 already means
//! about 260 000 lexicographic comparisons, beyond any useful trace. Every key comparison
//! inside the lexicographic comparisons is counted.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "worstsort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Joke,
};

const MAX_N: usize = 5;

#[derive(Clone)]
enum Val {
    Leaf(Item),
    List(Vec<Val>),
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    if n > MAX_N {
        t.phase("worstsort beyond n = 5 is infeasible: not started");
        return Outcome::Truncated;
    }
    let k = if n <= 2 { 2 } else { 1 };
    let list: Vec<Val> = (0..n).map(|i| Val::Leaf(t.read(v, i))).collect();
    t.phase(&format!("worstsort = badsort(L, f(n) = {k})"));
    let Some(sorted) = badsort(t, list, k) else {
        return Outcome::Truncated;
    };
    for (i, x) in sorted.into_iter().enumerate() {
        if let Val::Leaf(it) = x {
            t.set(v, i, it);
        }
    }
    Outcome::Sorted
}

fn badsort(t: &mut Tracer, list: Vec<Val>, k: usize) -> Option<Vec<Val>> {
    if k == 0 {
        return bubble(t, list);
    }
    t.phase(&format!(
        "badsort level {k}: all {} permutations",
        factorial(list.len())
    ));
    let perms: Vec<Val> = permutations(&list).into_iter().map(Val::List).collect();
    let sorted = badsort(t, perms, k - 1)?;
    match sorted.into_iter().next() {
        Some(Val::List(first)) => Some(first),
        _ => Some(Vec::new()),
    }
}

fn bubble(t: &mut Tracer, mut a: Vec<Val>) -> Option<Vec<Val>> {
    let n = a.len();
    for pass in 0..n {
        if !t.ok() {
            return None;
        }
        let mut swapped = false;
        for i in 0..n.saturating_sub(1 + pass) {
            if lex(t, &a[i], &a[i + 1]) == Ordering::Greater {
                a.swap(i, i + 1);
                swapped = true;
            }
        }
        if !swapped {
            break;
        }
    }
    Some(a)
}

fn lex(t: &mut Tracer, a: &Val, b: &Val) -> Ordering {
    match (a, b) {
        (Val::Leaf(x), Val::Leaf(y)) => t.cmp_items(x, y),
        (Val::List(x), Val::List(y)) => {
            for (p, q) in x.iter().zip(y.iter()) {
                let o = lex(t, p, q);
                if o != Ordering::Equal {
                    return o;
                }
            }
            x.len().cmp(&y.len())
        }
        (Val::Leaf(_), Val::List(_)) => Ordering::Less,
        (Val::List(_), Val::Leaf(_)) => Ordering::Greater,
    }
}

/// All permutations, in lexicographic order of the original positions (the identity
/// first). Among permutations with the same key sequence the earliest one keeps equal keys
/// in input order, and the bubble sorts never reorder lexicographically equal lists, so the
/// permutation badsort picks is the stable one.
fn permutations(list: &[Val]) -> Vec<Vec<Val>> {
    let n = list.len();
    let mut idx: Vec<usize> = (0..n).collect();
    let mut out = Vec::new();
    loop {
        out.push(idx.iter().map(|&i| list[i].clone()).collect());
        // next permutation of idx in lexicographic order
        let Some(i) = (1..n).rev().find(|&i| idx[i - 1] < idx[i]) else {
            break;
        };
        let j = (i..n).rev().find(|&j| idx[j] > idx[i - 1]).unwrap();
        idx.swap(i - 1, j);
        idx[i..].reverse();
    }
    out
}

fn factorial(n: usize) -> usize {
    (1..=n).product()
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

    #[test]
    fn small_inputs_are_sorted_or_truncated() {
        let mut r = SplitMix64::new(0xB060);
        let opt = Options {
            trace: false,
            ..Options::default()
        };
        for n in 0..=5usize {
            for _ in 0..40 {
                let input = random(n, -3, 3, &mut r);
                let (out, outcome, _) = run(&input, &opt);
                match outcome {
                    Outcome::Sorted => {
                        assert!(out.windows(2).all(|w| w[0].key <= w[1].key));
                        let mut a = out.clone();
                        let mut b = input.clone();
                        a.sort_by_key(|x| (x.key, x.tag));
                        b.sort_by_key(|x| (x.key, x.tag));
                        assert_eq!(a, b);
                    }
                    Outcome::Truncated | Outcome::NotASort(_) => {}
                    o => panic!("unexpected outcome {o:?}"),
                }
            }
        }
    }

    #[test]
    fn step_limit_stops_the_run() {
        let input = keyed((0..40).rev());
        let opt = Options {
            max_steps: 200,
            ..Options::default()
        };
        let (_, outcome, t) = run(&input, &opt);
        assert_ne!(
            outcome,
            Outcome::Sorted,
            "40 reversed keys cannot finish in 200 steps"
        );
        assert!(t.steps().len() <= 200);
    }

    #[test]
    fn sorts_up_to_five_and_refuses_six() {
        let mut r = SplitMix64::new(4);
        for n in 0..=5usize {
            let input = random(n, -3, 3, &mut r);
            let (out, o, _) = run(&input, &count_only());
            assert_eq!(o, Outcome::Sorted);
            let mut want: Vec<i32> = input.iter().map(|x| x.key).collect();
            want.sort();
            assert_eq!(out.iter().map(|x| x.key).collect::<Vec<_>>(), want);
        }
        let (_, o, _) = run(&keyed(0..6), &count_only());
        assert_eq!(o, Outcome::Truncated);
    }
}
