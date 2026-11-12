//! JavaScript regular expressions, read with JavaScript's meaning. The policy and the Node gate
//! write patterns in JavaScript syntax, where `\d`, `\w` and `\b` are ASCII; Rust's are Unicode.
//! A pattern is translated once, so a policy file means the same thing to both implementations.

use fancy_regex::Regex;

const WORD: &str = "0-9A-Za-z_";
const DIGIT: &str = "0-9";
/// JavaScript's `\b` and `\B` over ASCII word characters, spelled with lookarounds: fancy-regex
/// does not switch Unicode off inline.
const BOUNDARY: &str = "(?:(?<=[0-9A-Za-z_])(?![0-9A-Za-z_])|(?<![0-9A-Za-z_])(?=[0-9A-Za-z_]))";
const NOT_BOUNDARY: &str =
    "(?:(?<=[0-9A-Za-z_])(?=[0-9A-Za-z_])|(?<![0-9A-Za-z_])(?![0-9A-Za-z_]))";

/// Translates a JavaScript pattern (no `u` flag) to fancy-regex syntax with ASCII classes.
pub fn translate(source: &str, ignore_case: bool) -> String {
    let mut out = String::with_capacity(source.len() + 16);
    if ignore_case {
        out.push_str("(?i)");
    }
    let mut in_class = false;
    let mut chars = source.chars();
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                let Some(next) = chars.next() else {
                    out.push('\\');
                    break;
                };
                match (next, in_class) {
                    ('d', true) => out.push_str(DIGIT),
                    ('d', false) => out.push_str(&format!("[{DIGIT}]")),
                    ('D', false) => out.push_str(&format!("[^{DIGIT}]")),
                    ('w', true) => out.push_str(WORD),
                    ('w', false) => out.push_str(&format!("[{WORD}]")),
                    ('W', false) => out.push_str(&format!("[^{WORD}]")),
                    ('b', true) => out.push_str("\\x08"),
                    ('b', false) => out.push_str(BOUNDARY),
                    ('B', false) => out.push_str(NOT_BOUNDARY),
                    ('/', _) => out.push('/'),
                    (other, _) => {
                        out.push('\\');
                        out.push(other);
                    }
                }
            }
            '[' if !in_class => {
                in_class = true;
                out.push('[');
                // a negation is copied as is; the class ends at the next unescaped `]`
                let rest = chars.as_str();
                if let Some(stripped) = rest.strip_prefix('^') {
                    out.push('^');
                    chars = stripped.chars();
                }
            }
            ']' if in_class => {
                in_class = false;
                out.push(']');
            }
            other => out.push(other),
        }
    }
    out
}

/// Compiles a JavaScript pattern; `flags` takes the JavaScript letters this gate uses (`g` is
/// implied by `find_iter`, `i` is case-insensitive).
pub fn compile(source: &str, flags: &str) -> Result<Regex, String> {
    let translated = translate(source, flags.contains('i'));
    Regex::new(&translated).map_err(|e| format!("pattern /{source}/{flags}: {e}"))
}

/// Every non-overlapping match of `re` in `text`, as (byte start, matched text).
pub fn find_all<'t>(re: &Regex, text: &'t str) -> Vec<(usize, &'t str)> {
    re.find_iter(text)
        .filter_map(Result::ok)
        .map(|m| (m.start(), m.as_str()))
        .collect()
}

/// JavaScript's `\s` and `String.prototype.trim` set (WhiteSpace and LineTerminator).
pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{0B}' | '\u{0C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_classes_and_boundaries() {
        let re = compile(r"\b\w+\b", "").unwrap();
        // JavaScript's \w is ASCII: an accented letter splits a word
        assert_eq!(
            find_all(&re, "caf\u{e9}s")
                .iter()
                .map(|m| m.1)
                .collect::<Vec<_>>(),
            ["caf", "s"]
        );
        let digits = compile(r"[\d,]+", "").unwrap();
        assert_eq!(find_all(&digits, "a 1,024 \u{663}").len(), 1);
    }

    #[test]
    fn lookbehind_backreference_and_escaped_slash() {
        let re = compile(r"(?<![\w.^/#-])x\/(\w)\1", "i").unwrap();
        assert_eq!(
            find_all(&re, "X/aa a.x/bb")
                .iter()
                .map(|m| m.1)
                .collect::<Vec<_>>(),
            ["X/aa"]
        );
    }

    #[test]
    fn javascript_whitespace() {
        assert!(is_js_space('\u{FEFF}'));
        assert!(!is_js_space('\u{85}'));
    }
}
