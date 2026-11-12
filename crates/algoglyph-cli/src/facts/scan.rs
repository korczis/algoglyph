//! One file through the gate: prepare its lines (derived regions blanked, YAML records marked),
//! run the built-in checks, then every Rhai check the policy does not exempt for the path.

use fancy_regex::Regex;
use serde_yaml::Value;

use super::{Finding, Policy};
use crate::catalogue::Model;
use crate::jsre::{self, find_all, is_js_space};
use crate::pathx::{dirname, join, normalize};
use crate::plugins::{Line, Plugins};

/// Top-level directories a backticked path in prose must start with to be judged; the same
/// constant as `ROOTS` in `scripts/lib/facts-gate.mjs`.
const ROOTS: &[&str] = &[
    "src",
    "scripts",
    "test",
    "catalogue",
    "docs",
    "crates",
    ".ai",
    ".github",
    "public",
    "config",
];

pub struct Gate<'a> {
    policy: &'a Policy,
    model: &'a Model,
    plugins: &'a Plugins,
    count: Regex,
    evidence: Vec<Regex>,
    region: Regex,
    yaml_key: Regex,
    route: Regex,
    hole: Regex,
    markdown_link: Regex,
    attribute: Regex,
    code_path: Regex,
    external: Regex,
    placeholder: Regex,
}

/// The `count` pattern, built from the policy as `countPattern` builds it.
fn count_pattern(policy: &Policy) -> Result<Regex, String> {
    let nums = std::iter::once(r"\d[\d,]*".to_string())
        .chain(policy.number_words.iter().cloned())
        .collect::<Vec<_>>()
        .join("|");
    let quals = format!("(?:(?:{})[- ])?", policy.qualifiers.join("|"));
    let mut nouns = policy.nouns.clone();
    // longest first, by JavaScript length (UTF-16 units); the sort is stable in both
    nouns.sort_by_key(|n| std::cmp::Reverse(n.encode_utf16().count()));
    let nouns = nouns
        .iter()
        .map(|n| n.replace(' ', r"\s+"))
        .collect::<Vec<_>>()
        .join("|");
    jsre::compile(
        &format!(r"(?<![\w.^/#-])({nums})\s+{quals}({nouns})\b"),
        "gi",
    )
}

/// JavaScript's truthiness of a parsed YAML value.
fn truthy(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

impl<'a> Gate<'a> {
    pub fn new(policy: &'a Policy, model: &'a Model, plugins: &'a Plugins) -> Result<Self, String> {
        let re = |source: &str, flags: &str| jsre::compile(source, flags);
        Ok(Self {
            policy,
            model,
            plugins,
            count: count_pattern(policy)?,
            evidence: policy
                .evidence_markers
                .iter()
                .map(|m| re(m, ""))
                .collect::<Result<_, _>>()?,
            region: re(
                r"<!-- algoglyph:derived:begin (\S+) -->[\s\S]*?<!-- algoglyph:derived:end \1 -->",
                "g",
            )?,
            yaml_key: re(r"^(\s*)-?\s*([A-Za-z_][\w-]*):", "")?,
            route: re(r"#\/(p|c|lab)\/([a-z0-9][a-z0-9/-]*)", "g")?,
            hole: re(r#"\$\{|['"`]\s*\+"#, "")?,
            markdown_link: re(r"\]\(([^)\s]+)\)", "g")?,
            attribute: re(r#"(?<![:\w-])(?:href|src)="([^"]+)""#, "g")?,
            code_path: re(r"`([.\w-]+(?:\/[.\w@-]+)+\/?)`", "g")?,
            external: re(r"^(?:[a-z]+:|\/\/|#|mailto:)", "i")?,
            placeholder: re(r"[<>*{}$]", "")?,
        })
    }

    /// A plan object that is closed (completed, or verified by evidence pinned to a commit) is a
    /// record of what was true then: its text is history, not a claim about now.
    fn closed_record(&self, text: &str) -> bool {
        let Ok(Value::Mapping(doc)) = serde_yaml::from_str::<Value>(text) else {
            return false;
        };
        if self
            .policy
            .closed_when
            .iter()
            .any(|k| truthy(doc.get(k.as_str())))
        {
            return true;
        }
        match doc.get("evidence") {
            Some(Value::Sequence(list)) => list
                .iter()
                .any(|e| truthy(Some(e)) && truthy(e.get("commit"))),
            _ => false,
        }
    }

    /// Blank out derived regions (keeping line numbers and UTF-16 lengths) and mark the lines of
    /// YAML record subtrees.
    fn prepare(&self, path: &str, text: &str) -> (Vec<String>, Vec<bool>) {
        let mut blanked = String::with_capacity(text.len());
        let mut last = 0;
        for m in self.region.find_iter(text).filter_map(Result::ok) {
            blanked.push_str(&text[last..m.start()]);
            for c in m.as_str().chars() {
                if c == '\n' {
                    blanked.push('\n');
                } else {
                    blanked.extend(std::iter::repeat_n(' ', c.len_utf16()));
                }
            }
            last = m.end();
        }
        blanked.push_str(&text[last..]);
        let lines: Vec<String> = blanked.split('\n').map(str::to_string).collect();
        let mut record = vec![false; lines.len()];
        let yaml = path.ends_with(".yaml") || path.ends_with(".yml");
        if yaml && self.closed_record(text) {
            return (lines, vec![true; record.len()]);
        }
        if yaml {
            let mut indent: Option<usize> = None;
            for (i, l) in lines.iter().enumerate() {
                let lead = l.chars().take_while(|c| is_js_space(*c)).count();
                let blank = l.chars().all(is_js_space);
                if indent.is_some_and(|at| !blank && lead <= at) {
                    indent = None;
                }
                if indent.is_some() {
                    record[i] = true;
                    continue;
                }
                let key = self.yaml_key.captures(l).ok().flatten();
                if let Some(name) = key.as_ref().and_then(|c| c.get(2)) {
                    if self.policy.record_keys.iter().any(|k| k == name.as_str()) {
                        indent = Some(lead);
                        record[i] = true;
                    }
                }
            }
        }
        (lines, record)
    }

    /// Whether a route names something the catalogue holds.
    fn resolves(&self, kind: &str, target: &str) -> bool {
        match kind {
            "p" => self.model.entries.contains(target),
            "c" => self.model.nodes.contains(target),
            _ => self.model.labs.contains(target),
        }
    }

    /// The first three UTF-16 units after a byte offset, as JavaScript's `slice` cuts them.
    fn after(line: &str, at: usize) -> &str {
        let mut units = 0;
        let mut end = at;
        for c in line[at..].chars() {
            if units >= 3 {
                break;
            }
            units += c.len_utf16();
            end += c.len_utf8();
        }
        &line[at..end]
    }

    fn links(&self, line: &str, at: usize, path: &str, out: &mut Vec<Finding>) {
        for caps in self.route.captures_iter(line).filter_map(Result::ok) {
            let (Some(whole), Some(kind), Some(raw)) = (caps.get(0), caps.get(1), caps.get(2))
            else {
                continue;
            };
            if self.resolves(kind.as_str(), raw.as_str().trim_end_matches('/')) {
                continue;
            }
            // a route built in code ends at a template hole: '#/p/' + id is not a link to judge
            if self
                .hole
                .is_match(Self::after(line, whole.end()))
                .unwrap_or(false)
            {
                continue;
            }
            out.push(finding(path, at, "link", whole.as_str()));
        }
    }

    fn paths(
        &self,
        line: &str,
        at: usize,
        path: &str,
        exists: &dyn Fn(&str) -> bool,
        out: &mut Vec<Finding>,
    ) {
        let mut refs: Vec<(&str, bool)> = Vec::new();
        for re in [&self.markdown_link, &self.attribute] {
            for caps in re.captures_iter(line).filter_map(Result::ok) {
                if let Some(r) = caps.get(1) {
                    refs.push((r.as_str(), false));
                }
            }
        }
        for caps in self.code_path.captures_iter(line).filter_map(Result::ok) {
            if let Some(r) = caps.get(1) {
                refs.push((r.as_str(), true));
            }
        }
        for (reference, code) in refs {
            if self.external.is_match(reference).unwrap_or(false)
                || self.placeholder.is_match(reference).unwrap_or(false)
            {
                continue;
            }
            let clean = reference.split(['#', '?']).next().unwrap_or_default();
            if clean.is_empty() {
                continue;
            }
            if code && !ROOTS.contains(&clean.split('/').next().unwrap_or_default()) {
                continue;
            }
            let repo_path = if code {
                normalize(clean)
            } else {
                join(&[&dirname(path), clean])
            };
            let candidates = [repo_path, join(&["public", clean])];
            let found = candidates
                .iter()
                .any(|c| exists(c.strip_suffix('/').unwrap_or(c)));
            if !found {
                out.push(finding(path, at, "path", reference));
            }
        }
    }

    /// Findings for one file; `exists` says whether a repository-relative path exists.
    pub fn scan(
        &self,
        path: &str,
        text: &str,
        exists: &dyn Fn(&str) -> bool,
    ) -> Result<Vec<Finding>, String> {
        let mut out = Vec::new();
        let policy = self.policy;
        let (lines, record) = self.prepare(path, text);
        let prose = path.ends_with(".md") || path.ends_with(".html");
        for (i, line) in lines.iter().enumerate() {
            if record[i] {
                continue;
            }
            let at = i + 1;
            let evidenced = || {
                self.evidence
                    .iter()
                    .any(|re| re.is_match(line).unwrap_or(false))
            };
            if !policy.exempts("count", path) && !evidenced() {
                for (_, m) in find_all(&self.count, line) {
                    out.push(finding(path, at, "count", m));
                }
            }
            if !policy.exempts("link", path) {
                self.links(line, at, path, &mut out);
            }
            if prose && !policy.exempts("path", path) {
                self.paths(line, at, path, exists, &mut out);
            }
        }
        let judged: Vec<Line> = lines
            .iter()
            .enumerate()
            .filter(|(i, _)| !record[*i])
            .map(|(i, text)| Line {
                number: i + 1,
                text,
            })
            .collect();
        for plugin in &self.plugins.list {
            if policy.exempts(&plugin.name, path) {
                continue;
            }
            for raw in self.plugins.run(plugin, path, text, &judged)? {
                out.push(finding(path, raw.line, &plugin.name, &raw.text));
            }
        }
        Ok(out)
    }
}

fn finding(file: &str, line: usize, check: &str, text: &str) -> Finding {
    Finding {
        file: file.to_string(),
        line,
        check: check.to_string(),
        text: text.to_string(),
    }
}
