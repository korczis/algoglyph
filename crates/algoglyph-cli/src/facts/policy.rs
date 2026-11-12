//! `config/derived-facts.yaml`: what the gate looks for. Data only; the gate lists nothing itself.

use std::fs;
use std::path::Path;

use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Files {
    pub include: Vec<String>,
    pub exclude: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Exempt {
    pub path: String,
    pub checks: Vec<String>,
    pub because: String,
}

/// Bounds on every Rhai check (the policy's `rhai` block).
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Limits {
    pub max_operations: u64,
    pub max_call_levels: usize,
    pub max_expr_depth: usize,
    pub max_function_expr_depth: usize,
    pub max_string_size: usize,
    pub max_array_size: usize,
    pub max_map_size: usize,
}

/// One exemption that applies to one scanned file.
#[derive(Debug, Serialize)]
pub struct Applied<'a> {
    pub file: String,
    pub path: &'a str,
    pub checks: &'a [String],
}

#[derive(Debug, Deserialize)]
pub struct Policy {
    pub nouns: Vec<String>,
    pub qualifiers: Vec<String>,
    pub number_words: Vec<String>,
    #[serde(default)]
    pub evidence_markers: Vec<String>,
    pub files: Files,
    #[serde(default)]
    pub closed_when: Vec<String>,
    pub record_keys: Vec<String>,
    #[serde(default)]
    pub exempt: Vec<Exempt>,
    pub rhai: Limits,
    #[serde(skip)]
    include: Vec<Regex>,
    #[serde(skip)]
    exclude: Vec<Regex>,
    #[serde(skip)]
    exempt_paths: Vec<Regex>,
}

/// A glob with `**` and `*` over `/`-separated paths, exactly as `globToRegExp` in the Node gate.
pub fn glob(glob: &str) -> Result<Regex, String> {
    let mut escaped = String::with_capacity(glob.len() * 2);
    for c in glob.chars() {
        if ".+^${}()|[]\\".contains(c) {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    let body = escaped
        .replace("**/", "\u{0}")
        .replace("**", "\u{1}")
        .replace('*', "[^/]*")
        .replace('\u{0}', "(?:.*/)?")
        .replace('\u{1}', ".*");
    Regex::new(&format!("^{body}$")).map_err(|e| format!("glob {glob}: {e}"))
}

fn globs(list: &[String]) -> Result<Vec<Regex>, String> {
    list.iter().map(|g| glob(g)).collect()
}

impl Policy {
    pub fn load(root: &Path) -> Result<Self, String> {
        let path = root.join("config/derived-facts.yaml");
        let text = fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
        let mut policy: Policy =
            serde_yaml::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
        policy.include = globs(&policy.files.include)?;
        policy.exclude = globs(&policy.files.exclude)?;
        policy.exempt_paths = policy
            .exempt
            .iter()
            .map(|x| glob(&x.path))
            .collect::<Result<_, _>>()?;
        Ok(policy)
    }

    /// Whether the gate scans a tracked file.
    pub fn selects(&self, path: &str) -> bool {
        self.include.iter().any(|re| re.is_match(path))
            && !self.exclude.iter().any(|re| re.is_match(path))
    }

    /// The declared exemptions a scanned file falls under.
    pub fn applied<'a>(&'a self, file: &str) -> Vec<Applied<'a>> {
        self.exempt
            .iter()
            .zip(&self.exempt_paths)
            .filter(|(_, re)| re.is_match(file))
            .map(|(x, _)| Applied {
                file: file.to_string(),
                path: &x.path,
                checks: &x.checks,
            })
            .collect()
    }

    /// Whether a check is exempt for a path, by a declared exemption with its reason.
    pub fn exempts(&self, check: &str, path: &str) -> bool {
        self.exempt
            .iter()
            .zip(&self.exempt_paths)
            .any(|(x, re)| x.checks.iter().any(|c| c == check) && re.is_match(path))
    }
}

#[cfg(test)]
mod tests {
    use super::glob;

    #[test]
    fn globs_match_like_the_node_gate() {
        assert!(glob("**/*.md").unwrap().is_match("README.md"));
        assert!(glob("**/*.md").unwrap().is_match("docs/a/b.md"));
        assert!(!glob("crates/*/target/**")
            .unwrap()
            .is_match("crates/a/b/target/x"));
        assert!(glob(".ai/repo/adrs/**")
            .unwrap()
            .is_match(".ai/repo/adrs/0001-x.md"));
    }
}
