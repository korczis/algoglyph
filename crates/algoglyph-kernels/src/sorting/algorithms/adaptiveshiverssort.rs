//! AdaptiveShiversSort (Jugé 2020, "Adaptive Shivers Sort: An Alternative Sorting
//! Algorithm", SODA; Algorithm 3). Like ShiversSort it keeps a stack of runs with levels
//! ℓ = ⌊log2 r⌋, but after each push it merges the second and third runs from the top
//! (R_{h-2} and R_{h-1}) while ℓ_{h-2} <= max(ℓ_{h-1}, ℓ_h); the run just pushed is not
//! merged until a later run arrives. This makes it optimal up to an additive O(n) with
//! respect to the run-length entropy: O(n + n H), where H is the entropy of the run lengths.
//! At the end the stack is merged from the top. Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "adaptiveshiverssort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut stack: Vec<(usize, usize)> = Vec::new();
    let mut i = 0;
    while i < n {
        let end = kit::ascending_run(t, v, i, n);
        t.mark(i, end, "run");
        stack.push((i, end - i));
        i = end;
        loop {
            let h = stack.len();
            if h < 3 {
                break;
            }
            let l = |x: usize| kit::log2(stack[x].1);
            if l(h - 3) <= l(h - 2).max(l(h - 1)) {
                // merge R_{h-2} and R_{h-1} (1-based), i.e. stack[h-3] and stack[h-2]
                let (sa, la) = stack[h - 3];
                let (sb, lb) = stack[h - 2];
                t.mark(sa, sb + lb, "merge");
                kit::merge(t, v, sa, sb, sb + lb, "buffer");
                stack[h - 3] = (sa, la + lb);
                stack.remove(h - 2);
            } else {
                break;
            }
        }
    }
    while stack.len() >= 2 {
        let (sb, lb) = stack.pop().unwrap();
        let (sa, la) = stack.pop().unwrap();
        t.mark(sa, sb + lb, "merge");
        kit::merge(t, v, sa, sb, sb + lb, "buffer");
        stack.push((sa, la + lb));
    }
    Outcome::Sorted
}
