//! Timsort (Peters 2002, CPython `Objects/listsort.txt` and `listobject.c`; the merge-stack
//! invariant as corrected after de Gouw et al. 2015, "OpenJDK's java.utils.Collection.sort()
//! is broken", CAV). A port of CPython's pre-3.11 list sort:
//!
//! - `count_run`: the next maximal non-descending or strictly descending run (reversed);
//! - runs shorter than `minrun` (32…64, so that n / minrun is a power of two or just below)
//!   are extended by binary insertion sort;
//! - the run stack keeps |Z| > |Y| + |X| and |Y| > |X| (`merge_collapse`, checking the
//!   fourth entry too), merging the smaller neighbour first;
//! - `merge_at` trims with `gallop_right` / `gallop_left` the parts of both runs that are
//!   already in place, then `merge_lo` or `merge_hi` copies the smaller run to a temporary
//!   buffer (aux `tmp`) and merges, switching to galloping mode after `min_gallop`
//!   consecutive wins of one run (initially 7, adapted per merge).
//!
//! Stable, not in place. No simplification.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "timsort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

const MIN_GALLOP: usize = 7;

fn minrun(mut n: usize) -> usize {
    let mut r = 0;
    while n >= 64 {
        r |= n & 1;
        n >>= 1;
    }
    n + r
}

struct State {
    runs: Vec<(usize, usize)>,
    min_gallop: usize,
    tmp: Vec<Item>,
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let min_run = minrun(n);
    let mut st = State {
        runs: Vec::new(),
        min_gallop: MIN_GALLOP,
        tmp: Vec::new(),
    };
    let mut lo = 0;
    while lo < n {
        let mut end = kit::ascending_run(t, v, lo, n);
        if end - lo < min_run {
            let force = (lo + min_run).min(n);
            t.phase("extend run by binary insertion");
            kit::binary_insertion(t, v, lo, end, force);
            end = force;
        }
        t.mark(lo, end, "run");
        st.runs.push((lo, end - lo));
        merge_collapse(t, v, &mut st);
        lo = end;
    }
    // merge_force_collapse
    while st.runs.len() > 1 {
        let mut k = st.runs.len() - 2;
        if k > 0 && st.runs[k - 1].1 < st.runs[k + 1].1 {
            k -= 1;
        }
        merge_at(t, v, &mut st, k);
    }
    t.aux_clear("tmp");
    Outcome::Sorted
}

fn merge_collapse(t: &mut Tracer, v: &mut [Item], st: &mut State) {
    while st.runs.len() > 1 {
        let mut k = st.runs.len() - 2;
        let r = &st.runs;
        if (k > 0 && r[k - 1].1 <= r[k].1 + r[k + 1].1)
            || (k > 1 && r[k - 2].1 <= r[k - 1].1 + r[k].1)
        {
            if r[k - 1].1 < r[k + 1].1 {
                k -= 1;
            }
            merge_at(t, v, st, k);
        } else if r[k].1 <= r[k + 1].1 {
            merge_at(t, v, st, k);
        } else {
            break;
        }
    }
}

/// `key` compared with `v[base + i]`.
#[inline]
fn kcmp(t: &mut Tracer, key: &Item, v: &[Item], base: usize, i: usize) -> Ordering {
    t.cmp_at(key, v, base + i)
}

/// `key` compared with `tmp[i]` (a held element).
#[inline]
fn tcmp(t: &mut Tracer, key: &Item, tmp: &[Item], i: usize) -> Ordering {
    t.cmp_items(key, &tmp[i])
}

/// Where the slice is: in `v` at `base`, or in the temporary buffer.
#[derive(Clone, Copy)]
enum Src {
    V(usize),
    Tmp(usize),
}

fn cmp_src(t: &mut Tracer, key: &Item, v: &[Item], tmp: &[Item], src: Src, i: usize) -> Ordering {
    match src {
        Src::V(b) => kcmp(t, key, v, b, i),
        Src::Tmp(b) => tcmp(t, key, tmp, b + i),
    }
}

/// k such that a[k-1] < key <= a[k] (a = the n elements at src), searching from `hint`.
fn gallop_left(
    t: &mut Tracer,
    key: &Item,
    v: &[Item],
    tmp: &[Item],
    src: Src,
    n: usize,
    hint: usize,
) -> usize {
    let mut ofs: usize = 1;
    let mut lastofs: isize;
    let mut ofs_i: isize;
    // a[hint] < key  <=>  key > a[hint]
    if cmp_src(t, key, v, tmp, src, hint) == Ordering::Greater {
        let maxofs = n - hint;
        let mut last = 0usize;
        while ofs < maxofs {
            if cmp_src(t, key, v, tmp, src, hint + ofs) == Ordering::Greater {
                last = ofs;
                ofs = (ofs << 1) + 1;
            } else {
                break;
            }
        }
        if ofs > maxofs {
            ofs = maxofs;
        }
        lastofs = (last + hint) as isize;
        ofs_i = (ofs + hint) as isize;
    } else {
        let maxofs = hint + 1;
        let mut last = 0usize;
        while ofs < maxofs {
            if cmp_src(t, key, v, tmp, src, hint - ofs) == Ordering::Greater {
                break;
            }
            last = ofs;
            ofs = (ofs << 1) + 1;
        }
        if ofs > maxofs {
            ofs = maxofs;
        }
        lastofs = hint as isize - ofs as isize;
        ofs_i = (hint - last) as isize;
    }
    lastofs += 1;
    while lastofs < ofs_i {
        let m = lastofs + ((ofs_i - lastofs) >> 1);
        if cmp_src(t, key, v, tmp, src, m as usize) == Ordering::Greater {
            lastofs = m + 1;
        } else {
            ofs_i = m;
        }
    }
    ofs_i as usize
}

/// k such that a[k-1] <= key < a[k], searching from `hint`.
fn gallop_right(
    t: &mut Tracer,
    key: &Item,
    v: &[Item],
    tmp: &[Item],
    src: Src,
    n: usize,
    hint: usize,
) -> usize {
    let mut ofs: usize = 1;
    let mut lastofs: isize;
    let mut ofs_i: isize;
    if cmp_src(t, key, v, tmp, src, hint) == Ordering::Less {
        let maxofs = hint + 1;
        let mut last = 0usize;
        while ofs < maxofs {
            if cmp_src(t, key, v, tmp, src, hint - ofs) == Ordering::Less {
                last = ofs;
                ofs = (ofs << 1) + 1;
            } else {
                break;
            }
        }
        if ofs > maxofs {
            ofs = maxofs;
        }
        lastofs = hint as isize - ofs as isize;
        ofs_i = (hint - last) as isize;
    } else {
        let maxofs = n - hint;
        let mut last = 0usize;
        while ofs < maxofs {
            if cmp_src(t, key, v, tmp, src, hint + ofs) == Ordering::Less {
                break;
            }
            last = ofs;
            ofs = (ofs << 1) + 1;
        }
        if ofs > maxofs {
            ofs = maxofs;
        }
        lastofs = (last + hint) as isize;
        ofs_i = (ofs + hint) as isize;
    }
    lastofs += 1;
    while lastofs < ofs_i {
        let m = lastofs + ((ofs_i - lastofs) >> 1);
        if cmp_src(t, key, v, tmp, src, m as usize) == Ordering::Less {
            ofs_i = m;
        } else {
            lastofs = m + 1;
        }
    }
    ofs_i as usize
}

fn merge_at(t: &mut Tracer, v: &mut [Item], st: &mut State, i: usize) {
    let (mut pa, mut na) = st.runs[i];
    let (pb, mut nb) = st.runs[i + 1];
    st.runs[i] = (pa, na + nb);
    st.runs.remove(i + 1);
    t.mark(pa, pb + nb, "merge");
    // elements of A already in place
    let key = v[pb];
    let k = gallop_right(t, &key, v, &[], Src::V(pa), na, 0);
    pa += k;
    na -= k;
    if na == 0 {
        return;
    }
    // elements of B already in place
    let key = v[pa + na - 1];
    nb = gallop_left(t, &key, v, &[], Src::V(pb), nb, nb - 1);
    if nb == 0 {
        return;
    }
    if na <= nb {
        merge_lo(t, v, st, pa, na, pb, nb);
    } else {
        merge_hi(t, v, st, pa, na, pb, nb);
    }
}

fn merge_lo(
    t: &mut Tracer,
    v: &mut [Item],
    st: &mut State,
    pa0: usize,
    mut na: usize,
    pb0: usize,
    mut nb: usize,
) {
    st.tmp.clear();
    for k in 0..na {
        let x = t.read(v, pa0 + k);
        st.tmp.push(x);
    }
    t.aux("tmp", &st.tmp);
    let tmp = std::mem::take(&mut st.tmp);
    let mut dest = pa0;
    let mut pa = 0usize; // into tmp
    let mut pb = pb0;
    let y = v[pb];
    t.set(v, dest, y);
    dest += 1;
    pb += 1;
    nb -= 1;
    let mut min_gallop = st.min_gallop;
    'outer: {
        if nb == 0 {
            break 'outer;
        }
        if na == 1 {
            // CopyB
            copy_b_lo(t, v, &tmp, dest, pa, pb, nb);
            st.tmp = tmp;
            return;
        }
        loop {
            let mut acount = 0usize;
            let mut bcount = 0usize;
            loop {
                if t.cmp_at(&tmp[pa], v, pb) == Ordering::Greater {
                    let y = v[pb];
                    t.set(v, dest, y);
                    dest += 1;
                    pb += 1;
                    bcount += 1;
                    acount = 0;
                    nb -= 1;
                    if nb == 0 {
                        break 'outer;
                    }
                    if bcount >= min_gallop {
                        break;
                    }
                } else {
                    t.set(v, dest, tmp[pa]);
                    dest += 1;
                    pa += 1;
                    acount += 1;
                    bcount = 0;
                    na -= 1;
                    if na == 1 {
                        copy_b_lo(t, v, &tmp, dest, pa, pb, nb);
                        st.tmp = tmp;
                        st.min_gallop = min_gallop;
                        return;
                    }
                    if acount >= min_gallop {
                        break;
                    }
                }
            }
            min_gallop += 1;
            t.phase("galloping");
            loop {
                min_gallop -= (min_gallop > 1) as usize;
                st.min_gallop = min_gallop;
                let key = v[pb];
                let k = gallop_right(t, &key, v, &tmp, Src::Tmp(pa), na, 0);
                acount = k;
                if k > 0 {
                    for x in 0..k {
                        t.set(v, dest + x, tmp[pa + x]);
                    }
                    dest += k;
                    pa += k;
                    na -= k;
                    if na == 1 {
                        copy_b_lo(t, v, &tmp, dest, pa, pb, nb);
                        st.tmp = tmp;
                        return;
                    }
                    if na == 0 {
                        break 'outer;
                    }
                }
                let y = v[pb];
                t.set(v, dest, y);
                dest += 1;
                pb += 1;
                nb -= 1;
                if nb == 0 {
                    break 'outer;
                }
                let key = tmp[pa];
                let k = gallop_left(t, &key, v, &tmp, Src::V(pb), nb, 0);
                bcount = k;
                if k > 0 {
                    for x in 0..k {
                        let y = v[pb + x];
                        t.set(v, dest + x, y);
                    }
                    dest += k;
                    pb += k;
                    nb -= k;
                    if nb == 0 {
                        break 'outer;
                    }
                }
                t.set(v, dest, tmp[pa]);
                dest += 1;
                pa += 1;
                na -= 1;
                if na == 1 {
                    copy_b_lo(t, v, &tmp, dest, pa, pb, nb);
                    st.tmp = tmp;
                    return;
                }
                if !(acount >= MIN_GALLOP || bcount >= MIN_GALLOP) {
                    break;
                }
            }
            min_gallop += 1;
            st.min_gallop = min_gallop;
        }
    }
    // Succeed: copy the rest of A
    for x in 0..na {
        t.set(v, dest + x, tmp[pa + x]);
    }
    st.min_gallop = st.min_gallop.max(1);
    st.tmp = tmp;
}

/// na == 1: the remaining B moves left, the last A element goes after it.
fn copy_b_lo(
    t: &mut Tracer,
    v: &mut [Item],
    tmp: &[Item],
    dest: usize,
    pa: usize,
    pb: usize,
    nb: usize,
) {
    for x in 0..nb {
        let y = v[pb + x];
        t.set(v, dest + x, y);
    }
    t.set(v, dest + nb, tmp[pa]);
}

fn merge_hi(
    t: &mut Tracer,
    v: &mut [Item],
    st: &mut State,
    pa0: usize,
    mut na: usize,
    pb0: usize,
    mut nb: usize,
) {
    st.tmp.clear();
    for k in 0..nb {
        let x = t.read(v, pb0 + k);
        st.tmp.push(x);
    }
    t.aux("tmp", &st.tmp);
    let tmp = std::mem::take(&mut st.tmp);
    let basea = pa0;
    // positions as isize: dest, pa (in v), pb (in tmp)
    let mut dest = (pb0 + nb - 1) as isize;
    let mut pa = (pa0 + na - 1) as isize;
    let mut pb = (nb - 1) as isize;
    let y = v[pa as usize];
    t.set(v, dest as usize, y);
    dest -= 1;
    pa -= 1;
    na -= 1;
    let mut min_gallop = st.min_gallop;
    'outer: {
        if na == 0 {
            break 'outer;
        }
        if nb == 1 {
            copy_a_hi(t, v, &tmp, dest, pa, pb, na);
            st.tmp = tmp;
            return;
        }
        loop {
            let mut acount = 0usize;
            let mut bcount = 0usize;
            loop {
                if t.cmp_at(&tmp[pb as usize], v, pa as usize) == Ordering::Less {
                    let y = v[pa as usize];
                    t.set(v, dest as usize, y);
                    dest -= 1;
                    pa -= 1;
                    acount += 1;
                    bcount = 0;
                    na -= 1;
                    if na == 0 {
                        break 'outer;
                    }
                    if acount >= min_gallop {
                        break;
                    }
                } else {
                    t.set(v, dest as usize, tmp[pb as usize]);
                    dest -= 1;
                    pb -= 1;
                    bcount += 1;
                    acount = 0;
                    nb -= 1;
                    if nb == 1 {
                        copy_a_hi(t, v, &tmp, dest, pa, pb, na);
                        st.tmp = tmp;
                        st.min_gallop = min_gallop;
                        return;
                    }
                    if bcount >= min_gallop {
                        break;
                    }
                }
            }
            min_gallop += 1;
            t.phase("galloping");
            loop {
                min_gallop -= (min_gallop > 1) as usize;
                st.min_gallop = min_gallop;
                let key = tmp[pb as usize];
                let k = gallop_right(t, &key, v, &tmp, Src::V(basea), na, na - 1);
                let k = na - k;
                acount = k;
                if k > 0 {
                    dest -= k as isize;
                    pa -= k as isize;
                    for x in (1..=k).rev() {
                        let y = v[(pa + x as isize) as usize];
                        t.set(v, (dest + x as isize) as usize, y);
                    }
                    na -= k;
                    if na == 0 {
                        break 'outer;
                    }
                }
                t.set(v, dest as usize, tmp[pb as usize]);
                dest -= 1;
                pb -= 1;
                nb -= 1;
                if nb == 1 {
                    copy_a_hi(t, v, &tmp, dest, pa, pb, na);
                    st.tmp = tmp;
                    return;
                }
                let key = v[pa as usize];
                let k = gallop_left(t, &key, v, &tmp, Src::Tmp(0), nb, nb - 1);
                let k = nb - k;
                bcount = k;
                if k > 0 {
                    dest -= k as isize;
                    pb -= k as isize;
                    for x in 1..=k {
                        t.set(
                            v,
                            (dest + x as isize) as usize,
                            tmp[(pb + x as isize) as usize],
                        );
                    }
                    nb -= k;
                    if nb == 1 {
                        copy_a_hi(t, v, &tmp, dest, pa, pb, na);
                        st.tmp = tmp;
                        return;
                    }
                    if nb == 0 {
                        break 'outer;
                    }
                }
                let y = v[pa as usize];
                t.set(v, dest as usize, y);
                dest -= 1;
                pa -= 1;
                na -= 1;
                if na == 0 {
                    break 'outer;
                }
                if !(acount >= MIN_GALLOP || bcount >= MIN_GALLOP) {
                    break;
                }
            }
            min_gallop += 1;
            st.min_gallop = min_gallop;
        }
    }
    // Succeed: copy the rest of B (tmp[0..nb]) to the front
    for x in 0..nb {
        t.set(v, (dest - (nb as isize - 1)) as usize + x, tmp[x]);
    }
    st.min_gallop = st.min_gallop.max(1);
    st.tmp = tmp;
}

/// nb == 1: the remaining A moves right, the first B element goes before it.
fn copy_a_hi(
    t: &mut Tracer,
    v: &mut [Item],
    tmp: &[Item],
    dest: isize,
    pa: isize,
    pb: isize,
    na: usize,
) {
    let dest = dest - na as isize;
    let pa = pa - na as isize;
    for x in (1..=na).rev() {
        let y = v[(pa + x as isize) as usize];
        t.set(v, (dest + x as isize) as usize, y);
    }
    t.set(v, dest as usize, tmp[pb as usize]);
}
