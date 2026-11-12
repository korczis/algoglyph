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
//! limits      config/derived-facts.yaml `rhai`: operations, call levels, sizes; a check that
//!              reaches one is refused (exit 2); `import` resolves nothing; print and debug
//!              write to stderr
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
use rhai::module_resolvers::DummyModuleResolver;
use rhai::{Array, Dynamic, Engine, EvalAltResult, Map, Scope, AST};

use crate::facts::Limits;
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

fn engine(limits: &Limits) -> Engine {
    let mut engine = Engine::new();
    // a check runs on every commit: bounded by the policy, so a runaway script fails fast
    engine.set_max_operations(limits.max_operations);
    engine.set_max_call_levels(limits.max_call_levels);
    engine.set_max_expr_depths(limits.max_expr_depth, limits.max_function_expr_depth);
    engine.set_max_string_size(limits.max_string_size);
    engine.set_max_array_size(limits.max_array_size);
    engine.set_max_map_size(limits.max_map_size);
    // a check sees only the file it is given: no other script, and nothing on stdout, which
    // carries the --json report
    engine.set_module_resolver(DummyModuleResolver::new());
    engine.on_print(|text| eprintln!("{text}"));
    engine.on_debug(|text, source, at| eprintln!("{}:{at}: {text}", source.unwrap_or("check")));
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

/// The policy key of the limit an error reached, if it reached one.
fn limit_reached(error: &EvalAltResult) -> Option<&'static str> {
    match error {
        EvalAltResult::ErrorInFunctionCall(_, _, inner, _)
        | EvalAltResult::ErrorInModule(_, inner, _) => limit_reached(inner),
        EvalAltResult::ErrorTooManyOperations(_) => Some("max_operations"),
        EvalAltResult::ErrorStackOverflow(_) => Some("max_call_levels"),
        EvalAltResult::ErrorDataTooLarge(what, _) => Some(match what.to_lowercase() {
            w if w.contains("string") => "max_string_size",
            w if w.contains("array") => "max_array_size",
            _ => "max_map_size",
        }),
        _ => None,
    }
}

impl Plugins {
    /// Every `*.rhai` in `dir`, in name order. The directory is the convention: one that cannot
    /// be read is an error, never an empty set of checks.
    pub fn discover(dir: &Path, limits: &Limits) -> Result<Self, String> {
        let engine = engine(limits);
        let listing = fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
        let mut paths = Vec::new();
        for item in listing {
            let path = item.map_err(|e| format!("{}: {e}", dir.display()))?.path();
            if path.extension().is_some_and(|x| x == "rhai") {
                paths.push(path);
            }
        }
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
            .map_err(|e| match limit_reached(&e) {
                Some(key) => format!(
                    "{}: refused at the Rhai limit {key} (config/derived-facts.yaml, rhai): {e}",
                    where_()
                ),
                None => format!("{}: {e}", where_()),
            })?;
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
