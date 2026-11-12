//! Kirkpatrick-Reisch Sort (Kirkpatrick & Reisch 1984, "Upper bounds for sorting integers on
//! random access machines", Theoretical Computer Science 28(3)): integer sorting by range
//! reduction in O(n log(w / log n)) for w-bit keys. Every w-bit key is split into its high
//! and low halves. Keys are grouped by high half; each group keeps its minimum low half
//! aside and contributes its high half once plus the low halves of its other members, so the
//! next level sorts n keys of w/2 bits. From that sorted list the group order (by high half)
//! and, inside each group, the order of the low halves are read off, and the groups are
//! written out minimum first. The recursion stops when 2^w is at most max(n, 256), where a
//! counting sort finishes. Keys are the 32-bit keys with the sign bit flipped. The lists of a
//! level are aux `level w`.
//!
//! Simplified: the grouping uses direct addressing over the 2^(w/2) high halves instead of the
//! hashing the paper uses for large words (for w <= 32 the table is at most 65 536 slots).
//! Not stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "kirkpatrick-reisch-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let items: Vec<Item> = (0..n).map(|i| t.read(v, i)).collect();
    let keys: Vec<u64> = items.iter().map(|x| kit::biased(x.key) as u64).collect();
    let order = kr(t, &keys, 32);
    let out: Vec<Item> = order.iter().map(|&i| items[i]).collect();
    kit::write_back(t, v, 0, &out);
    Outcome::Sorted
}

/// Returns the indices of `keys` (each < 2^w) in sorted order.
fn kr(t: &mut Tracer, keys: &[u64], w: u32) -> Vec<usize> {
    let n = keys.len();
    if n <= 1 {
        return (0..n).collect();
    }
    let shown = |k: u64| {
        if w == 32 {
            (k as u32 ^ 0x8000_0000) as i32
        } else {
            k as i32
        }
    };
    let snapshot: Vec<Item> = keys
        .iter()
        .enumerate()
        .map(|(i, &k)| Item::new(shown(k), i as u32))
        .collect();
    let name = format!("level {w}");
    t.aux(&name, &snapshot);
    if w <= 8 || (1u64 << w) <= (n as u64).max(256) {
        t.phase(&format!("counting sort on {w}-bit keys"));
        let r = 1usize << w;
        let mut count = vec![0usize; r + 1];
        for &k in keys {
            count[k as usize + 1] += 1;
        }
        for i in 0..r {
            count[i + 1] += count[i];
        }
        let mut out = vec![0usize; n];
        for (i, &k) in keys.iter().enumerate() {
            out[count[k as usize]] = i;
            count[k as usize] += 1;
        }
        t.aux_clear(&name);
        return out;
    }
    let h = w / 2;
    let lo_mask = (1u64 << h) - 1;
    t.phase(&format!("split {w}-bit keys into {h}-bit halves"));
    // group by high half: the minimum low half of each group stays aside
    let groups = 1usize << (w - h);
    let mut min_of: Vec<usize> = vec![usize::MAX; groups];
    for (i, &k) in keys.iter().enumerate() {
        let g = (k >> h) as usize;
        let m = min_of[g];
        if m == usize::MAX {
            min_of[g] = i;
        } else {
            let a = Item::new((k & lo_mask) as i32, i as u32);
            let b = Item::new((keys[m] & lo_mask) as i32, m as u32);
            if t.cmp_items(&a, &b) == Ordering::Less {
                min_of[g] = i;
            }
        }
    }
    // next level: one entry per group (its high half) + the low halves of non-minimum members
    #[derive(Clone, Copy)]
    enum Entry {
        Group(usize),
        Low(usize),
    }
    let mut sub_keys: Vec<u64> = Vec::with_capacity(n);
    let mut sub_what: Vec<Entry> = Vec::with_capacity(n);
    let mut seen = vec![false; groups];
    for (i, &k) in keys.iter().enumerate() {
        let g = (k >> h) as usize;
        if !seen[g] {
            seen[g] = true;
            sub_keys.push(g as u64);
            sub_what.push(Entry::Group(g));
        }
        if min_of[g] != i {
            sub_keys.push(k & lo_mask);
            sub_what.push(Entry::Low(i));
        }
    }
    let sorted = kr(t, &sub_keys, h.max(w - h));
    // read off: group order, and inside each group the low halves in order
    let mut group_order: Vec<usize> = Vec::new();
    let mut members: Vec<Vec<usize>> = vec![Vec::new(); groups];
    for &s in &sorted {
        match sub_what[s] {
            Entry::Group(g) => group_order.push(g),
            Entry::Low(i) => members[(keys[i] >> h) as usize].push(i),
        }
    }
    let mut out = Vec::with_capacity(n);
    for g in group_order {
        out.push(min_of[g]);
        out.extend_from_slice(&members[g]);
    }
    t.aux_clear(&name);
    out
}
