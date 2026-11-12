//! The derived-facts gate (rule project.derived-facts), ported from `scripts/lib/facts-gate.mjs`.
//! Same policy file (`config/derived-facts.yaml`), same files, same findings; the Node script
//! stays the gate until this port replaces it, and `tests/equivalence.rs` holds the two equal.
//!
//! Built in: `count`, `link` and `path`. Every other check is a Rhai script under
//! `tools/checks/` (the `plate-number` family is one), run by `crate::plugins`.

mod policy;
mod scan;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};

use serde::Serialize;

use crate::{catalogue, plugins::Plugins};
pub use policy::{Limits, Policy};

#[derive(Debug, clap::Args)]
pub struct Args {
    /// Print the report as JSON ({ findings, files, exempt, scanned, applied }), as
    /// `check-facts.mjs --json` prints it.
    #[arg(long)]
    json: bool,
    /// Repository root (default: the enclosing git work tree).
    #[arg(long)]
    root: Option<PathBuf>,
    /// Scan every file under this directory instead of the tracked tree, each judged as the
    /// repository path it has below the directory (the equivalence fixtures).
    #[arg(long, value_name = "DIR")]
    fixtures: Option<PathBuf>,
    /// Where the Rhai checks live (default: <root>/tools/checks).
    #[arg(long, value_name = "DIR")]
    checks: Option<PathBuf>,
}

#[derive(Debug, Serialize, PartialEq, Eq, PartialOrd, Ord, Clone)]
pub struct Finding {
    pub file: String,
    pub line: usize,
    pub check: String,
    pub text: String,
}

#[derive(Serialize)]
struct Report<'a> {
    findings: &'a [Finding],
    files: usize,
    exempt: &'a [policy::Exempt],
    scanned: &'a [String],
    applied: Vec<policy::Applied<'a>>,
}

fn git(root: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|e| format!("git {}: {e}", args.join(" ")))?;
    if !out.status.success() {
        return Err(format!(
            "git {}: {}",
            args.join(" "),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// A path the repository ignores (.ai/local/, dist/, build output) is local state by contract:
/// no checkout can prove it, so it counts as present. Asked both ways: a directory pattern
/// matches a missing path only with its slash.
fn ignored(root: &Path, path: &str) -> bool {
    [path.to_string(), format!("{path}/")].iter().any(|q| {
        Command::new("git")
            .args(["check-ignore", "-q", "--no-index", q])
            .current_dir(root)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    })
}

/// Files under `dir`, relative to it, sorted.
fn walk(dir: &Path, base: &Path, out: &mut Vec<String>) -> Result<(), String> {
    for item in fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        let path = item.map_err(|e| format!("{}: {e}", dir.display()))?.path();
        if path.is_dir() {
            walk(&path, base, out)?;
        } else if let Ok(rel) = path.strip_prefix(base) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

pub fn run(args: &Args) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let root = match &args.root {
        Some(root) => root.clone(),
        None => PathBuf::from(git(&cwd, &["rev-parse", "--show-toplevel"])?.trim()),
    };
    let policy = Policy::load(&root)?;
    let model = catalogue::load(&root)?;
    let checks = args
        .checks
        .clone()
        .unwrap_or_else(|| root.join("tools/checks"));
    let plugins = Plugins::discover(&checks, &policy.rhai)?;
    let gate = scan::Gate::new(&policy, &model, &plugins)?;
    let exists = |p: &str| root.join(p).exists() || ignored(&root, p);

    let mut findings = Vec::new();
    let mut scanned: Vec<String> = Vec::new();
    let files = match &args.fixtures {
        Some(dir) => {
            let mut list = Vec::new();
            walk(dir, dir, &mut list)?;
            list.sort();
            for rel in &list {
                let text = fs::read_to_string(dir.join(rel)).map_err(|e| format!("{rel}: {e}"))?;
                findings.extend(gate.scan(rel, &text, &exists)?);
                scanned.push(rel.clone());
            }
            list.len()
        }
        None => {
            let tracked = git(&root, &["ls-files", "-co", "--exclude-standard"])?;
            let selected: Vec<&str> = tracked
                .lines()
                .filter(|f| !f.is_empty() && policy.selects(f))
                .collect();
            for f in &selected {
                let full = root.join(f);
                if !full.exists() {
                    continue;
                }
                let bytes = fs::read(&full).map_err(|e| format!("{f}: {e}"))?;
                let text = String::from_utf8_lossy(&bytes);
                findings.extend(gate.scan(f, &text, &exists)?);
                scanned.push(f.to_string());
            }
            selected.len()
        }
    };

    if args.json {
        let report = Report {
            findings: &findings,
            files,
            exempt: &policy.exempt,
            scanned: &scanned,
            applied: scanned.iter().flat_map(|f| policy.applied(f)).collect(),
        };
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?
        );
    } else {
        for f in &findings {
            eprintln!("FAIL {:<12} {}:{}  \"{}\"", f.check, f.file, f.line, f.text);
        }
        for x in &policy.exempt {
            println!("exempt {} {} — {}", x.checks.join(","), x.path, x.because);
        }
        println!(
            "algoglyph facts: {files} file(s) scanned, {} finding(s)",
            findings.len()
        );
    }
    if findings.is_empty() {
        return Ok(ExitCode::SUCCESS);
    }
    eprintln!(
        "algoglyph facts: derive the number (scripts/build-readme.mjs regions, src/core/facts.ts, \
         the catalogue model) or cite the run or commit it was measured on; link plates by id."
    );
    Ok(ExitCode::from(1))
}
