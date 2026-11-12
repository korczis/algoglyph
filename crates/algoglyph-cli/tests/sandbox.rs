//! A Rhai check runs on every commit, so it is bounded and sandboxed: a runaway script is
//! refused fast with exit 2 at a limit of config/derived-facts.yaml, `import` resolves nothing,
//! print and debug never reach stdout (the --json report), and a checks directory that cannot be
//! read is an error rather than no checks.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{Duration, Instant};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("repository root")
}

/// A fresh directory with one check, `<dir>/checks/<name>.rhai`, and one fixture file to scan.
fn setup(case: &str, script: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("algoglyph-sandbox-{case}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.join("checks")).unwrap();
    fs::create_dir_all(dir.join("fixtures/docs")).unwrap();
    fs::write(dir.join("fixtures/docs/x.md"), "A line to judge.\n").unwrap();
    fs::write(dir.join(format!("checks/{case}.rhai")), script).unwrap();
    dir
}

fn facts(dir: &Path, checks: &Path) -> (Output, Duration) {
    let started = Instant::now();
    let out = Command::new(env!("CARGO_BIN_EXE_algoglyph"))
        .args(["facts", "--json", "--root"])
        .arg(root())
        .arg("--fixtures")
        .arg(dir.join("fixtures"))
        .arg("--checks")
        .arg(checks)
        .output()
        .expect("algoglyph runs");
    (out, started.elapsed())
}

fn stderr(out: &Output) -> String {
    String::from_utf8_lossy(&out.stderr).into_owned()
}

#[test]
fn an_endless_check_is_refused_fast_at_the_operations_limit() {
    let dir = setup("endless", "fn check(file) { loop {} }");
    let (out, took) = facts(&dir, &dir.join("checks"));
    assert_eq!(out.status.code(), Some(2), "{}", stderr(&out));
    assert!(stderr(&out).contains("max_operations"), "{}", stderr(&out));
    assert!(took < Duration::from_secs(5), "refused only after {took:?}");
}

#[test]
fn endless_recursion_is_refused_at_the_call_level_limit() {
    let dir = setup(
        "recursion",
        "fn deeper(n) { deeper(n + 1) }\nfn check(file) { deeper(0) }",
    );
    let (out, _) = facts(&dir, &dir.join("checks"));
    assert_eq!(out.status.code(), Some(2), "{}", stderr(&out));
    assert!(stderr(&out).contains("max_call_levels"), "{}", stderr(&out));
}

#[test]
fn a_growing_string_is_refused_at_the_size_limit() {
    let dir = setup(
        "growing",
        "fn check(file) { let s = \"x\"; loop { s += s; } }",
    );
    let (out, _) = facts(&dir, &dir.join("checks"));
    assert_eq!(out.status.code(), Some(2), "{}", stderr(&out));
    assert!(stderr(&out).contains("max_string_size"), "{}", stderr(&out));
}

#[test]
fn print_and_debug_go_to_stderr_and_the_json_stays_whole() {
    let dir = setup(
        "chatty",
        "fn check(file) { print(\"said by a check\"); debug(\"debugged by a check\"); [] }",
    );
    let (out, _) = facts(&dir, &dir.join("checks"));
    assert_eq!(out.status.code(), Some(0), "{}", stderr(&out));
    let report: serde_json::Value =
        serde_json::from_slice(&out.stdout).expect("stdout is the JSON report alone");
    assert_eq!(report["findings"], serde_json::json!([]));
    assert!(stderr(&out).contains("said by a check"));
    assert!(stderr(&out).contains("debugged by a check"));
}

#[test]
fn a_check_cannot_import_another_script() {
    let dir = setup("importer", "import \"helper\" as h;\nfn check(file) { [] }");
    fs::write(dir.join("checks/helper.rhai"), "fn check(file) { [] }").unwrap();
    let (out, _) = facts(&dir, &dir.join("checks"));
    assert_eq!(out.status.code(), Some(2), "{}", stderr(&out));
    assert!(stderr(&out).contains("helper"), "{}", stderr(&out));
}

#[test]
fn a_checks_directory_that_cannot_be_read_is_an_error() {
    let dir = setup("missing", "fn check(file) { [] }");
    let (out, _) = facts(&dir, &dir.join("no-such-directory"));
    assert_eq!(out.status.code(), Some(2), "{}", stderr(&out));
    assert!(
        stderr(&out).contains("no-such-directory"),
        "{}",
        stderr(&out)
    );
}
