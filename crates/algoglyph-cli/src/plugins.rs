//! Checks written in Rhai, discovered by convention: every `tools/checks/<name>.rhai` is the check
//! `<name>`. A script defines `fn check(file)` and returns its findings; the host decides which
//! files it sees, applies the policy's exemptions by the check's name and reports what it finds.
//!
//! The contract a script sees:
//!
//! ```text
//! file.path    the repository-relative path
//! file.text    the file's whole text
//! file.lines   the lines the gate judges, each #{ number, text }: derived regions blanked,
//!              YAML record subtrees and closed plan objects left out
//! returns      an array of #{ line, text }: the line number and the offending text
//!
//! find_all(text, pattern)          every match of a JavaScript-syntax pattern
//! find_all(text, pattern, flags)   with JavaScript flags ("i" case-insensitive; "g" implied)
//!                                  each match is #{ text, start } (start counts characters)
//! ```

use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::rc::Rc;

use fancy_regex::Regex;
use rhai::{Array, Dynamic, Engine, EvalAltResult, Map, Scope, AST};

use crate::jsre;

pub struct Plugin {
    pub name: String,
    path: PathBuf,
    ast: AST,
}

pub struct Plugins {
    engine: Engine,
    pub list: Vec<Plugin>,
}

/// One line the gate judges, as a script sees it.
pub struct Line<'a> {
    pub number: usize,
    pub text: &'a str,
}

/// A finding a script returned, before the host stamps it with the file and the check.
pub struct Raw {
    pub line: usize,
    pub text: String,
}

type Cache = Rc<RefCell<HashMap<(String, String), Rc<Regex>>>>;

fn matches(
    cache: &Cache,
    text: &str,
    pattern: &str,
    flags: &str,
) -> Result<Array, Box<EvalAltResult>> {
    let key = (pattern.to_string(), flags.to_string());
    let cached = cache.borrow().get(&key).cloned();
    let re = match cached {
        Some(re) => re,
        None => {
            let re = Rc::new(jsre::compile(pattern, flags).map_err(|e| e.to_string())?);
            cache.borrow_mut().insert(key, Rc::clone(&re));
            re
        }
    };
    Ok(jsre::find_all(&re, text)
        .into_iter()
        .map(|(start, found)| {
            let mut m = Map::new();
            m.insert("text".into(), Dynamic::from(found.to_string()));
            m.insert(
                "start".into(),
                Dynamic::from(text[..start].chars().count() as rhai::INT),
            );
            Dynamic::from_map(m)
        })
        .collect())
}

fn engine() -> Engine {
    let mut engine = Engine::new();
    // Rhai's default nesting limits (lower in a debug build) refuse a check's nested loops
    engine.set_max_expr_depths(256, 256);
    let cache: Cache = Rc::default();
    let two = Rc::clone(&cache);
    engine.register_fn("find_all", move |text: &str, pattern: &str| {
        matches(&two, text, pattern, "")
    });
    engine.register_fn("find_all", move |text: &str, pattern: &str, flags: &str| {
        matches(&cache, text, pattern, flags)
    });
    engine
}

impl Plugins {
    /// Every `*.rhai` in `dir`, in name order; a directory that does not exist holds none.
    pub fn discover(dir: &Path) -> Result<Self, String> {
        let engine = engine();
        let mut paths: Vec<PathBuf> = match fs::read_dir(dir) {
            Ok(listing) => listing
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.extension().is_some_and(|x| x == "rhai"))
                .collect(),
            Err(_) => Vec::new(),
        };
        paths.sort();
        let mut list = Vec::new();
        for path in paths {
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            let ast = engine
                .compile_file(path.clone())
                .map_err(|e| format!("{}: {e}", path.display()))?;
            if !ast
                .iter_functions()
                .any(|f| f.name == "check" && f.params.len() == 1)
            {
                return Err(format!("{}: defines no fn check(file)", path.display()));
            }
            list.push(Plugin { name, path, ast });
        }
        Ok(Self { engine, list })
    }

    /// Runs one check over one file.
    pub fn run(
        &self,
        plugin: &Plugin,
        path: &str,
        text: &str,
        lines: &[Line],
    ) -> Result<Vec<Raw>, String> {
        let where_ = || format!("{} on {path}", plugin.path.display());
        let mut file = Map::new();
        file.insert("path".into(), Dynamic::from(path.to_string()));
        file.insert("text".into(), Dynamic::from(text.to_string()));
        let rows: Array = lines
            .iter()
            .map(|l| {
                let mut row = Map::new();
                row.insert("number".into(), Dynamic::from(l.number as rhai::INT));
                row.insert("text".into(), Dynamic::from(l.text.to_string()));
                Dynamic::from_map(row)
            })
            .collect();
        file.insert("lines".into(), Dynamic::from_array(rows));
        let found: Array = self
            .engine
            .call_fn(
                &mut Scope::new(),
                &plugin.ast,
                "check",
                (Dynamic::from_map(file),),
            )
            .map_err(|e| format!("{}: {e}", where_()))?;
        found
            .into_iter()
            .map(|item| {
                let map = item
                    .try_cast::<Map>()
                    .ok_or_else(|| format!("{}: a finding is not a map", where_()))?;
                let line = map.get("line").and_then(|v| v.as_int().ok());
                let text = map.get("text").and_then(|v| v.clone().into_string().ok());
                match (line, text) {
                    (Some(line), Some(text)) if line > 0 => Ok(Raw {
                        line: line as usize,
                        text,
                    }),
                    _ => Err(format!("{}: a finding needs #{{ line, text }}", where_())),
                }
            })
            .collect()
    }
}
