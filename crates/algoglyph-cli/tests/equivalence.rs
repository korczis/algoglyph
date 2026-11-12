//! The Rust port of the derived-facts gate against the Node gate it ports (ADR 0005 §6): both run
//! on the repository and on `test/fixtures/derived-facts/`, and must report the same findings,
//! the same number of files and the same exemptions. The Node script stays the gate; this test
//! is what lets the port replace it.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("repository root")
}

/// Runs a gate with `--json`; exit 0 (clean) and 1 (findings) both carry a report.
fn report(program: &str, args: &[&str]) -> Value {
    let out = Command::new(program)
        .args(args)
        .current_dir(root())
        .output()
        .unwrap_or_else(|e| panic!("{program} could not run ({e}); the equivalence test needs it"));
    let code = out.status.code();
    assert!(
        matches!(code, Some(0 | 1)),
        "{program} {args:?} exited {code:?}: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    serde_json::from_slice(&out.stdout)
        .unwrap_or_else(|e| panic!("{program} {args:?}: not JSON: {e}"))
}

/// Findings as a sorted list: the order of checks within a line is not part of the contract.
fn findings(report: &Value) -> Vec<String> {
    let mut list: Vec<String> = report["findings"]
        .as_array()
        .expect("findings")
        .iter()
        .map(|f| {
            format!(
                "{} {}:{} {:?}",
                f["check"],
                f["file"].as_str().unwrap(),
                f["line"],
                f["text"]
            )
        })
        .collect();
    list.sort();
    list
}

fn both(extra: &[&str]) -> (Value, Value) {
    let mut node = vec!["scripts/check-facts.mjs", "--json"];
    node.extend_from_slice(extra);
    let mut rust = vec!["facts", "--json"];
    rust.extend_from_slice(extra);
    (
        report("node", &node),
        report(env!("CARGO_BIN_EXE_algoglyph"), &rust),
    )
}

fn assert_equivalent(node: &Value, rust: &Value) {
    assert_eq!(
        findings(node),
        findings(rust),
        "findings differ (left: node, right: rust)"
    );
    assert_eq!(node["files"], rust["files"], "files scanned differ");
    assert_eq!(node["exempt"], rust["exempt"], "declared exemptions differ");
}

#[test]
fn the_repository_gets_the_same_findings_from_both() {
    let (node, rust) = both(&[]);
    assert_equivalent(&node, &rust);
}

#[test]
fn the_fixtures_get_the_same_findings_from_both() {
    let dir = root().join("test/fixtures/derived-facts");
    let (node, rust) = both(&["--fixtures", dir.to_str().unwrap()]);
    assert_equivalent(&node, &rust);
}

#[test]
fn the_fixtures_cover_every_finding_kind() {
    // the built-in checks, plus one per Rhai check discovered under tools/checks
    let mut kinds: BTreeSet<String> = ["count", "link", "path"].map(String::from).into();
    for item in fs::read_dir(root().join("tools/checks"))
        .expect("tools/checks")
        .flatten()
    {
        let path = item.path();
        if path.extension().is_some_and(|x| x == "rhai") {
            kinds.insert(path.file_stem().unwrap().to_string_lossy().into_owned());
        }
    }
    let dir = root().join("test/fixtures/derived-facts");
    let rust = report(
        env!("CARGO_BIN_EXE_algoglyph"),
        &["facts", "--json", "--fixtures", dir.to_str().unwrap()],
    );
    let found: BTreeSet<String> = rust["findings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["check"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(
        found, kinds,
        "every check needs a refused case in test/fixtures/derived-facts"
    );
}
