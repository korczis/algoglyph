//! What the gate needs of the catalogue: the ids a route may name. Validation stays with
//! `scripts/lib/catalogue.mjs` (`npm run catalogue -- --check`); this reads the same files by the
//! same conventions (ADR 0004): an entry's id is its file name, a taxonomy key is the path of
//! node ids from the root, a lab is an id of `labs.yaml`.

use std::collections::HashSet;
use std::fs;
use std::path::Path;

use serde_yaml::Value;

#[derive(Debug, Default)]
pub struct Model {
    pub entries: HashSet<String>,
    pub nodes: HashSet<String>,
    pub labs: HashSet<String>,
}

fn read_yaml(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_yaml::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))
}

/// A YAML scalar as JavaScript's `String(x)` would print it.
fn scalar(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => String::new(),
    }
}

fn walk(nodes: &Value, prefix: &str, out: &mut HashSet<String>) {
    let Value::Sequence(list) = nodes else { return };
    for node in list {
        if !node.is_mapping() {
            continue;
        }
        let id = node.get("id").map(scalar).unwrap_or_default();
        let key = if prefix.is_empty() {
            id
        } else {
            format!("{prefix}/{id}")
        };
        if let Some(children) = node.get("children") {
            walk(children, &key, out);
        }
        out.insert(key);
    }
}

fn is_id(s: &str) -> bool {
    let mut chars = s.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

pub fn load(root: &Path) -> Result<Model, String> {
    let dir = root.join("catalogue");
    let mut model = Model::default();
    let taxonomy = read_yaml(&dir.join("taxonomy.yaml"))?;
    walk(
        taxonomy.get("nodes").unwrap_or(&Value::Null),
        "",
        &mut model.nodes,
    );
    let labs = read_yaml(&dir.join("labs.yaml"))?;
    if let Some(Value::Sequence(list)) = labs.get("labs") {
        model.labs = list
            .iter()
            .filter_map(|l| l.get("id"))
            .map(scalar)
            .filter(|id| is_id(id))
            .collect();
    }
    let entries = dir.join("entries");
    let listing = fs::read_dir(&entries).map_err(|e| format!("{}: {e}", entries.display()))?;
    for item in listing.flatten() {
        let name = item.file_name().to_string_lossy().into_owned();
        if let Some(id) = name.strip_suffix(".md") {
            model.entries.insert(id.to_string());
        }
    }
    Ok(model)
}
