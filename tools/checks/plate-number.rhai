// plate-number: a plate referred to by its number ("PL. <nnn>", "plate <nn>"). Numbers follow
// the taxonomy order and change with it; a plate is named by its id (rule project.derived-facts).
//
// A check of the algoglyph CLI, discovered by its file name: `algoglyph facts` runs every
// tools/checks/<name>.rhai as the check <name>, skips it where config/derived-facts.yaml exempts
// <name>, and reports what `check` returns. The host contract is documented in
// crates/algoglyph-cli/src/plugins.rs.

fn check(file) {
    let pattern = `\bPL\.\s?\d{1,4}\b|\bplates?\s+(?:no\.?\s*)?#?\d{2,4}\b`;
    let found = [];
    for line in file.lines {
        for m in find_all(line.text, pattern, "gi") {
            found.push(#{ line: line.number, text: m.text });
        }
    }
    found
}
