//! ShiversSort (Shivers 2002, "A simple and efficient natural merge sort", Georgia Tech
//! technical report; stated as below by Jugé 2020 (Algorithm 2)): a natural merge sort on a
//! stack of runs. Runs are maximal non-decreasing (strictly descending runs are reversed);
//! after each push, while the run below the top has level ⌊log2 r⌋ at most that of the top
//! run, the two top runs are merged. At the end the stack is merged from the top. Merges
//! copy the smaller run to aux `buffer`. Stable, not in place, O(n log n).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "shiverssort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

fn level(len: usize) -> u32 {
    kit::log2(len)
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut stack: Vec<(usize, usize)> = Vec::new(); // (start, len)
    let mut i = 0;
    while i < n {
        let end = kit::ascending_run(t, v, i, n);
        t.mark(i, end, "run");
        stack.push((i, end - i));
        i = end;
        while stack.len() >= 2 && level(stack[stack.len() - 2].1) <= level(stack[stack.len() - 1].1)
        {
            merge_top(t, v, &mut stack);
        }
    }
    while stack.len() >= 2 {
        merge_top(t, v, &mut stack);
    }
    Outcome::Sorted
}

fn merge_top(t: &mut Tracer, v: &mut [Item], stack: &mut Vec<(usize, usize)>) {
    let (sb, lb) = stack.pop().unwrap();
    let (sa, la) = stack.pop().unwrap();
    t.mark(sa, sb + lb, "merge");
    kit::merge(t, v, sa, sb, sb + lb, "buffer");
    stack.push((sa, la + lb));
}
