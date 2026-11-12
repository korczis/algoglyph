//! POSIX path arithmetic with Node's semantics (`path.posix.normalize`, `join`, `dirname`), so a
//! link resolves to the same repository path here as in the Node gate.

/// `path.normalize`: resolves `.` and `..`, collapses separators, keeps a trailing separator.
pub fn normalize(path: &str) -> String {
    if path.is_empty() {
        return ".".to_string();
    }
    let absolute = path.starts_with('/');
    let trailing = path.ends_with('/');
    let mut out: Vec<&str> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                if out.last().is_some_and(|last| *last != "..") {
                    out.pop();
                } else if !absolute {
                    out.push("..");
                }
            }
            other => out.push(other),
        }
    }
    let body = out.join("/");
    if body.is_empty() {
        return match (absolute, trailing) {
            (true, _) => "/".to_string(),
            (false, true) => "./".to_string(),
            (false, false) => ".".to_string(),
        };
    }
    let mut result = if absolute { format!("/{body}") } else { body };
    if trailing {
        result.push('/');
    }
    result
}

/// `path.join`: the non-empty parts joined by `/`, then normalised.
pub fn join(parts: &[&str]) -> String {
    let joined = parts
        .iter()
        .filter(|p| !p.is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join("/");
    if joined.is_empty() {
        ".".to_string()
    } else {
        normalize(&joined)
    }
}

/// `path.dirname` for the repository-relative file paths the gate scans.
pub fn dirname(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    match trimmed.rfind('/') {
        Some(0) => "/".to_string(),
        Some(at) => trimmed[..at].to_string(),
        None if path.starts_with('/') => "/".to_string(),
        None => ".".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_matches_node() {
        assert_eq!(normalize("docs/./x.md"), "docs/x.md");
        assert_eq!(normalize("docs/../README.md"), "README.md");
        assert_eq!(normalize("../x"), "../x");
        assert_eq!(normalize("a//b/"), "a/b/");
        assert_eq!(normalize("./"), "./");
        assert_eq!(normalize(""), ".");
        assert_eq!(normalize("/a/../.."), "/");
    }

    #[test]
    fn join_and_dirname_match_node() {
        assert_eq!(join(&[".", "./x.md"]), "x.md");
        assert_eq!(join(&["docs", "/favicon.svg"]), "docs/favicon.svg");
        assert_eq!(join(&["public", "src/"]), "public/src/");
        assert_eq!(dirname("README.md"), ".");
        assert_eq!(dirname("docs/a/x.md"), "docs/a");
    }
}
