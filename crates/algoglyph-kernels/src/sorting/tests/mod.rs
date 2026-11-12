//! Conformance suite of every registered sorting plugin (ported from trideni).
//!
//! Environment knobs: `TRIDENI_RANDOM_CASES` (random arrays per algorithm, default 10 000),
//! `TRIDENI_ONLY` (comma-separated ids to restrict the per-algorithm checks).
use crate::sorting as engine;
use crate::sorting::prelude::*;
use crate::sorting::{scenario_checksum, REGISTRY};
use std::collections::BTreeMap;
use std::collections::BTreeSet;

mod harness;

use harness::*;

const FIXTURE: &str = include_str!("../fixture.json");

/// `"<kernel id>": "<16 hex digits>"` lines of the fixture.
fn fixture() -> BTreeMap<String, u64> {
    FIXTURE
        .lines()
        .filter_map(|l| {
            let l = l.trim().trim_end_matches(',');
            let (k, v) = l.split_once(':')?;
            let k = k.trim().trim_matches('"');
            let v = v.trim().trim_matches('"');
            if k == "schema" || v.len() != 16 {
                return None;
            }
            Some((k.to_string(), u64::from_str_radix(v, 16).ok()?))
        })
        .collect()
}

#[test]
fn every_kernel_reproduces_the_shared_fixture() {
    // the wasm build must reproduce the same checksums (test/kernels-sorting-wasm.test.ts)
    let want = fixture();
    let have: BTreeSet<&str> = REGISTRY.iter().map(|e| e.meta.id).collect();
    let listed: BTreeSet<&str> = want.keys().map(String::as_str).collect();
    assert_eq!(
        have, listed,
        "the fixture lists exactly the registered kernels"
    );
    let failures = for_each_entry(|e| {
        let got = scenario_checksum(e);
        match want.get(e.meta.id) {
            Some(&w) if w == got => Ok(()),
            w => Err(format!("checksum {got:016x} != fixture {w:x?}")),
        }
    });
    assert!(
        failures.is_empty(),
        "{} kernels differ:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn zero_option_words_reproduce_the_shared_fixture() {
    // the option words a run takes from the C ABI, all 0, leave every kernel's default run byte
    // for byte the one the fixture records; and any other word reaches the field it names
    let want = fixture();
    let zero = [0u32; Options::TUNABLE.len()];
    let failures = for_each_entry(|e| {
        let got = engine::scenario_checksum_with(e, &zero);
        match want.get(e.meta.id) {
            Some(&w) if w == got => Ok(()),
            w => Err(format!("checksum {got:016x} != fixture {w:x?}")),
        }
    });
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    for (i, name) in Options::TUNABLE.iter().enumerate() {
        let mut words = zero;
        words[i] = 7;
        let o = engine::with_option_words(Options::default(), &words);
        for other in Options::TUNABLE {
            assert_eq!(o.tunable(other), Some(if other == *name { 7 } else { 0 }), "{name} -> {other}");
        }
    }
    assert!(!Options::default().clone().set_tunable("edges", 1));
}

#[test]
fn every_kernels_options_are_the_tunable_fields_its_source_reads() {
    // build.rs derives Entry::reads from `opt.<field>` in the plugin's own code; each is a real
    // field, and the manifest's options are the tunable ones, never a field the kernel ignores
    const FIELDS: [&str; 6] = ["seed", "base", "k", "memory", "edges", "max_steps"];
    for e in REGISTRY {
        for r in e.reads {
            assert!(FIELDS.contains(r) || *r == "trace", "{}: reads unknown field {r}", e.meta.id);
        }
        let opts = engine::options_of(e);
        assert!(opts.iter().all(|o| e.reads.contains(o) && Options::TUNABLE.contains(o)));
    }
    let of = |id: &str| engine::options_of(engine::find(id).unwrap());
    assert_eq!(of("external-merge-sort"), ["k", "memory"]);
    assert_eq!(of("tape-merge-sort"), ["memory"]);
    assert_eq!(of("parallel-radix-sort"), ["base", "k"]);
    assert_eq!(of("d-ary-heapsort"), ["k"]);
    // `_opt`, an unused parameter, reads nothing
    assert!(of("bubble-sort").is_empty());
    assert_eq!(engine::find("topological-sort").unwrap().reads, ["edges"]);
}

#[test]
#[ignore = "writes the fixture; run with --ignored after changing a kernel or the tracer"]
fn write_fixture() {
    let mut s = String::from("{\n  \"schema\": \"algoglyph-sorting-fixture/v1\",\n");
    let rows: Vec<String> = REGISTRY
        .iter()
        .map(|e| format!("  \"{}\": \"{:016x}\"", e.meta.id, scenario_checksum(e)))
        .collect();
    s.push_str(&rows.join(",\n"));
    s.push_str("\n}\n");
    std::fs::write(
        concat!(env!("CARGO_MANIFEST_DIR"), "/src/sorting/fixture.json"),
        s,
    )
    .unwrap();
}

#[test]
fn the_checked_in_manifest_is_current() {
    let want = engine::manifest();
    let have = include_str!("../kernels.json");
    assert!(
        have == want,
        "src/sorting/kernels.json is stale: run cargo test -- --ignored write_manifest"
    );
}

#[test]
#[ignore = "writes the manifest; run with --ignored after adding a kernel or changing its META"]
fn write_manifest() {
    std::fs::write(
        concat!(env!("CARGO_MANIFEST_DIR"), "/src/sorting/kernels.json"),
        engine::manifest(),
    )
    .unwrap();
}

#[test]
fn aux_writes_count_the_cells_that_change() {
    let mut t = Tracer::new(&Options::default());
    let (a, b, c) = (Item::new(5, 0), Item::new(7, 1), Item::new(9, 2));
    t.aux("q", &[a]); // a new cell: 1
    t.aux("q", &[a, b]); // pushed: 1
    t.aux("q", &[a]); // popped: an emptied cell writes nothing
    t.aux("q", &[a, c]); // 1
    t.aux("q", &[c, a]); // both cells change: 2
    t.aux_cells("g", &[Some(a), None, Some(b)]); // a gap is no key: 2
    t.aux_cells("g", &[Some(a), Some(c), Some(b)]); // the gap filled: 1
    t.aux_clear("q"); // released: nothing
    t.aux("q", &[c]); // refilled: 1
    let c2 = t.counts();
    assert_eq!(c2.aux_writes, 9);
    assert_eq!(c2.aux, 5, "peak: q holds 2 while g holds 3");
    let writes = t
        .steps()
        .iter()
        .filter(|s| matches!(s, Step::AuxWrite { .. }))
        .count();
    assert_eq!(
        writes as u64, c2.aux_writes,
        "one recorded step per counted write"
    );
}

#[test]
fn emptied_cells_are_recorded_as_uncounted_clears() {
    let mut t = Tracer::new(&Options::default());
    let (a, b, c) = (Item::new(5, 0), Item::new(7, 1), Item::new(9, 2));
    t.aux("q", &[a, b, c]);
    t.aux("q", &[a]); // cells 1 and 2 emptied
    t.aux_cells("g", &[Some(a), Some(b), Some(c)]);
    t.aux_cells("g", &[None, Some(b), None]); // cells 0 and 2 emptied
    t.aux_clear("q"); // cell 0 emptied
    let clears: Vec<(String, u32, u32)> = t
        .steps()
        .iter()
        .filter_map(|s| match s {
            Step::AuxClear { name, from, to } => Some((name.clone(), *from, *to)),
            _ => None,
        })
        .collect();
    assert_eq!(
        clears,
        vec![
            ("q".into(), 1, 3),
            ("g".into(), 0, 1),
            ("g".into(), 2, 3),
            ("q".into(), 0, 1)
        ]
    );
    let c2 = t.counts();
    assert_eq!(c2.aux_writes, 6, "clears are not writes");
    assert_eq!(t.step_count(), 6, "clears are not counted steps");
}

#[test]
fn replaying_aux_writes_and_clears_reproduces_the_aux_state() {
    use std::collections::BTreeMap;
    let failures = for_each_entry(|e| {
        for &n in &[2usize, 16, 61, 128] {
            for (name, input) in presets(n, 29) {
                let opt = Options {
                    max_steps: 1_000_000,
                    ..Options::default()
                };
                let run = engine::run_entry(e, input, &opt);
                if run.truncated {
                    continue;
                }
                let mut state: BTreeMap<String, Vec<Option<i32>>> = BTreeMap::new();
                for s in run.tracer.steps() {
                    match s {
                        Step::AuxWrite { name, i, key } => {
                            let cells = state.entry(name.clone()).or_default();
                            if cells.len() <= *i as usize {
                                cells.resize(*i as usize + 1, None);
                            }
                            cells[*i as usize] = Some(*key);
                        }
                        Step::AuxClear { name, from, to } => {
                            let cells = state.entry(name.clone()).or_default();
                            for c in cells.iter_mut().take(*to as usize).skip(*from as usize) {
                                *c = None;
                            }
                        }
                        _ => {}
                    }
                }
                let trim = |mut v: Vec<Option<i32>>| {
                    while v.last() == Some(&None) {
                        v.pop();
                    }
                    v
                };
                let replayed: Vec<(String, Vec<Option<i32>>)> = state
                    .into_iter()
                    .map(|(k, v)| (k, trim(v)))
                    .filter(|(_, v)| !v.is_empty())
                    .collect();
                let held: Vec<(String, Vec<Option<i32>>)> = run
                    .tracer
                    .aux_state()
                    .into_iter()
                    .map(|(k, v)| (k, trim(v)))
                    .filter(|(_, v)| !v.is_empty())
                    .collect();
                if replayed != held {
                    return Err(format!(
                        "{name} n = {n}: replayed aux {replayed:?} != held {held:?}"
                    ));
                }
            }
        }
        Ok(())
    });
    assert!(
        failures.is_empty(),
        "{} algorithms failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn meta_ids_match_file_stems_and_are_unique() {
    let mut seen = BTreeSet::new();
    for e in REGISTRY {
        assert_eq!(
            e.meta.id,
            e.stem.replace('_', "-"),
            "META.id of {}.rs",
            e.stem
        );
        assert!(seen.insert(e.meta.id), "duplicate id {}", e.meta.id);
    }
}

#[test]
fn every_algorithm_sorts() {
    let failures = for_each_entry(|e| check_sorts(e, random_cases()));
    assert!(
        failures.is_empty(),
        "{} algorithms failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn stable_algorithms_keep_tag_order() {
    let failures = for_each_entry(|e| {
        if e.meta.stable != Stability::Yes {
            return Ok(());
        }
        check_stable(e)
    });
    assert!(
        failures.is_empty(),
        "{} stable algorithms failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn in_place_algorithms_use_logarithmic_aux() {
    let failures = for_each_entry(|e| {
        if !e.meta.in_place || e.meta.kind == Kind::Joke {
            return Ok(());
        }
        check_in_place(e)
    });
    assert!(
        failures.is_empty(),
        "{} in-place algorithms failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn count_only_mode_matches_trace_mode() {
    let failures = for_each_entry(check_trace_parity);
    assert!(
        failures.is_empty(),
        "{} algorithms failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn trace_replay_reproduces_output() {
    let failures = for_each_entry(check_replay);
    assert!(
        failures.is_empty(),
        "{} algorithms failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn typed_words_decode_to_the_recorded_steps() {
    let mut t = Tracer::new(&Options::default());
    let mut v = vec![Item::new(3, 0), Item::new(1, 1), Item::new(2, 2)];
    t.cmp(&v, 0, 2);
    t.cmp_items(&v[1], &v[0]);
    let x = v[2];
    t.cmp_at(&x, &v, 1);
    t.swap(&mut v, 0, 1);
    t.set(&mut v, 2, Item::new(-7, u32::MAX));
    t.read(&v, 1);
    t.mark(0, 3, "run");
    t.aux("buffer", &v[..2]);
    t.phase("merge");
    t.mark(1, 2, "run");
    t.lane(5);
    t.round();
    t.aux_clear("buffer");
    let steps = t.steps().to_vec();
    assert_eq!(
        steps,
        vec![
            Step::Cmp { i: 0, j: 2, r: 1 },
            Step::Cmpv {
                a: 1,
                b: 3,
                r: -1,
                at: None
            },
            Step::Cmpv {
                a: 2,
                b: 1,
                r: 1,
                at: Some(1)
            },
            Step::Swap { i: 0, j: 1 },
            Step::Set {
                i: 2,
                key: -7,
                tag: u32::MAX
            },
            Step::Read { i: 1 },
            Step::Mark {
                from: 0,
                to: 3,
                label: "run".into()
            },
            Step::AuxWrite {
                name: "buffer".into(),
                i: 0,
                key: 1
            },
            Step::AuxWrite {
                name: "buffer".into(),
                i: 1,
                key: 3
            },
            Step::Phase {
                text: "merge".into()
            },
            Step::Mark {
                from: 1,
                to: 2,
                label: "run".into()
            },
            Step::Lane { lane: 5 },
            Step::Round { n: 1 },
            Step::AuxClear {
                name: "buffer".into(),
                from: 0,
                to: 2
            },
        ]
    );
    assert_eq!(t.recorded(), steps.len());
    assert_eq!(t.words().len(), STRIDE * steps.len());
    assert_eq!(
        t.strings(),
        ["run", "buffer", "merge"],
        "labels are interned once"
    );
    assert_eq!(t.into_steps(), steps);
}

#[test]
fn aux_peak_is_exact_for_merge_sort_and_heapsort() {
    for &n in &[1usize, 2, 7, 64, 1000] {
        let input = random_input(n, -50, 50, 7 + n as u64);
        let opt = Options {
            trace: false,
            ..Options::default()
        };
        if let Ok(run) = engine::run("merge-sort", input.clone(), &opt) {
            let want = if n < 2 { 0 } else { n as u64 };
            assert_eq!(run.counts.aux, want, "merge-sort aux peak at n = {n}");
        } else {
            panic!("merge-sort is not registered");
        }
        let run = engine::run("heapsort", input, &opt).expect("heapsort is registered");
        assert_eq!(run.counts.aux, 0, "heapsort aux peak at n = {n}");
    }
}

#[test]
fn broken_variants_are_caught() {
    // One swapped comparison each: ties taken from the right run (stability), and a
    // selection sort that selects with the comparison reversed in one branch (order).
    let unstable_merge = Entry {
        stem: "broken_merge",
        meta: &BROKEN_MERGE_META,
        sort: broken_merge,
        source: 0,
        reads: &[],
    };
    assert!(
        check_sorts(&unstable_merge, 200).is_err(),
        "a stable-declared merge with a tie bug must fail"
    );
    assert!(
        check_stable(&unstable_merge).is_err(),
        "a tie-breaking bug must fail the stability check"
    );
    let bad_selection = Entry {
        stem: "broken_selection",
        meta: &BROKEN_SELECTION_META,
        sort: broken_selection,
        source: 0,
        reads: &[],
    };
    assert!(
        check_sorts(&bad_selection, 200).is_err(),
        "a reversed comparison must fail the sort check"
    );
    // And the harness accepts the correct versions of both.
    let fixed = Entry {
        stem: "fixed",
        meta: &BROKEN_MERGE_META,
        sort: fixed_merge,
        source: 0,
        reads: &[],
    };
    assert!(check_sorts(&fixed, 200).is_ok());
    assert!(check_stable(&fixed).is_ok());
}

#[test]
fn unknown_kernels_and_oversized_inputs_are_refused() {
    assert!(engine::run("no-such-sort", vec![Item::new(1, 0)], &Options::default()).is_err());
    let id = REGISTRY.first().expect("at least one plugin").meta.id;
    let big = vec![Item::default(); engine::MAX_N + 1];
    assert!(engine::run(id, big, &Options::default()).is_err());
}

#[test]
fn step_limit_truncates_the_trace() {
    let input = random_input(300, 0, 1000, 11);
    for e in REGISTRY
        .iter()
        .filter(|e| e.meta.kind != Kind::Joke)
        .take(20)
    {
        let opt = Options {
            max_steps: 50,
            ..Options::default()
        };
        let run = engine::run_entry(e, input.clone(), &opt);
        // emptied aux cells are recorded for drawing but are not steps of the algorithm
        let steps = run.tracer.steps();
        let clears = steps
            .iter()
            .filter(|s| matches!(s, Step::AuxClear { .. }))
            .count();
        let writes = steps
            .iter()
            .filter(|s| matches!(s, Step::AuxWrite { .. }))
            .count();
        assert!(
            steps.len() - clears <= 50,
            "{}: {} steps recorded",
            e.meta.id,
            steps.len() - clears
        );
        assert!(
            clears <= writes,
            "{}: a clear empties only what was written",
            e.meta.id
        );
        assert!(run.truncated, "{} must report truncated", e.meta.id);
    }
}

#[test]
fn runs_are_deterministic_for_a_seed() {
    let input = random_input(200, -100, 100, 5);
    for e in REGISTRY.iter().filter(|e| e.meta.kind != Kind::Joke) {
        let opt = Options {
            seed: 99,
            trace: false,
            ..Options::default()
        };
        let a = engine::run_entry(e, input.clone(), &opt);
        let b = engine::run_entry(e, input.clone(), &opt);
        assert_eq!(a.output, b.output, "{}", e.meta.id);
        assert_eq!(a.counts, b.counts, "{}", e.meta.id);
    }
}

/// The browser counts a kernel's rounds from its round steps, so no kernel may leave its round
/// count to the tracer's inference from lanes: a kernel that works in lanes calls `round()`,
/// and its rounds counter is exactly its recorded round steps.
#[test]
fn every_kernel_that_works_in_lanes_declares_its_rounds() {
    let failures = for_each_entry(|e| {
        for n in [2usize, 17, 64] {
            for (name, input) in presets(n, 5) {
                let run = engine::run_entry(e, input, &Options::default());
                if run.truncated {
                    continue;
                }
                let steps = run.tracer.steps();
                let lanes = steps.iter().any(|s| matches!(s, Step::Lane { .. }));
                let rounds = steps
                    .iter()
                    .filter(|s| matches!(s, Step::Round { .. }))
                    .count() as u64;
                if lanes && rounds == 0 {
                    return Err(format!("{name} n={n}: lanes without a round() call"));
                }
                if run.counts.rounds != rounds {
                    return Err(format!(
                        "{name} n={n}: rounds counter {} != {rounds} round steps",
                        run.counts.rounds
                    ));
                }
            }
        }
        Ok(())
    });
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn rounds_are_inferred_from_lanes() {
    let mut t = Tracer::new(&Options::default());
    for _round in 0..3 {
        for lane in 0..4 {
            t.lane(lane);
        }
    }
    assert_eq!(t.counts().rounds, 3);
    t.round();
    assert_eq!(t.counts().rounds, 1, "explicit rounds win");
}

/// `cargo test -- --ignored --nocapture counts_table`: operation counts per algorithm at
/// n = 1000 (random, sorted, reversed, few-unique), for eyeballing complexity.
#[test]
#[ignore]
fn counts_table() {
    let n = 1000;
    for e in REGISTRY {
        let mut row = format!("{:36}", e.meta.id);
        for (name, input) in presets(n, 9)
            .into_iter()
            .filter(|(p, _)| ["random", "sorted", "reversed", "few-unique"].contains(p))
        {
            let opt = Options {
                trace: false,
                ..Options::default()
            };
            let r = engine::run_entry(e, input, &opt);
            row.push_str(&format!(
                " {}:{}c/{}s/{}w/{}a{}",
                &name[..3],
                r.counts.cmp,
                r.counts.swap,
                r.counts.write,
                r.counts.aux,
                if r.truncated { "T" } else { "" }
            ));
        }
        println!("{row}");
    }
}
