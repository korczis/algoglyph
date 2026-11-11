//! Sleep sort (posted anonymously on 4chan's /prog/ board in 2011; a folklore joke with no
//! formal publication).
//!
//! Start one thread per element; thread i sleeps for a time proportional to its key and
//! then appends its element to the output. The elements come out in key order because the
//! operating system's timer queue wakes the threads in order of their deadlines, which is
//! where the sorting really happens (with O(n log n) work in a heap-based timer queue) and
//! why the "algorithm" takes time proportional to the largest key.
//!
//! The simulation uses a virtual clock instead of real time: every thread is a lane
//! (`t.lane(i)`) that sleeps until time key - min; the timer queue is a binary heap of
//! deadlines whose comparisons are counted, and the clock jumps from one deadline to the
//! next (`t.phase("t = ...")`), where the threads that wake append their element. Threads
//! with equal deadlines wake in thread order here; real threads would race.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "sleep-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Joke,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n == 0 {
        return Outcome::Sorted;
    }
    let items: Vec<Item> = (0..n).map(|i| t.read(v, i)).collect();
    let min = items.iter().map(|x| x.key as i64).min().unwrap_or(0);
    t.phase(&format!(
        "spawn {n} threads; thread i sleeps key - min = key - {min} ticks"
    ));
    let mut heap: Vec<usize> = Vec::with_capacity(n);
    for i in 0..n {
        t.lane(i as u32);
        push(t, &items, &mut heap, i);
    }
    let mut pos = 0;
    let mut now: Option<i64> = None;
    while let Some(i) = pop(t, &items, &mut heap) {
        if !t.ok() {
            return Outcome::Truncated;
        }
        let wake = items[i].key as i64 - min;
        if now != Some(wake) {
            now = Some(wake);
            t.phase(&format!("t = {wake}"));
        }
        t.lane(i as u32);
        t.set(v, pos, items[i]);
        pos += 1;
    }
    Outcome::Sorted
}

fn earlier(t: &mut Tracer, items: &[Item], a: usize, b: usize) -> bool {
    match t.cmp_items(&items[a], &items[b]) {
        Ordering::Less => true,
        Ordering::Greater => false,
        Ordering::Equal => a < b,
    }
}

fn push(t: &mut Tracer, items: &[Item], h: &mut Vec<usize>, x: usize) {
    h.push(x);
    let mut i = h.len() - 1;
    while i > 0 {
        let p = (i - 1) / 2;
        if earlier(t, items, h[i], h[p]) {
            h.swap(i, p);
            i = p;
        } else {
            break;
        }
    }
}

fn pop(t: &mut Tracer, items: &[Item], h: &mut Vec<usize>) -> Option<usize> {
    if h.is_empty() {
        return None;
    }
    let last = h.len() - 1;
    h.swap(0, last);
    let top = h.pop();
    let n = h.len();
    let mut i = 0;
    loop {
        let (l, r) = (2 * i + 1, 2 * i + 2);
        let mut s = i;
        if l < n && earlier(t, items, h[l], h[s]) {
            s = l;
        }
        if r < n && earlier(t, items, h[r], h[s]) {
            s = r;
        }
        if s == i {
            break;
        }
        h.swap(i, s);
        i = s;
    }
    top
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
    fn wakes_in_key_order() {
        let mut r = SplitMix64::new(3);
        for n in [0usize, 1, 5, 100, 1000] {
            let input = random(n, -500, 500, &mut r);
            let (out, o, _) = run(&input, &count_only());
            assert_eq!(o, Outcome::Sorted);
            let mut want = input.clone();
            want.sort_by_key(|x| x.key);
            assert_eq!(out, want);
        }
    }
}
