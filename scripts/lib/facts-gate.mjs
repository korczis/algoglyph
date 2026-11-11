// The derived-facts gate (rule project.derived-facts). Every number about the collection and
// every link is derived from the catalogue or measured from a run; a number typed by hand is a
// copy that drifts, and a link typed by hand dangles the moment its target moves. This module
// finds both, driven entirely by config/derived-facts.yaml and the catalogue model.
//
//   count         a number typed next to a collection noun ("<n> live plates", "<n> tests")
//   plate-number  a plate referred to by its number ("PL. <nnn>"), which follows taxonomy order
//                 and changes with it; refer to plates by id
//   link          #/p/<id>, #/c/<path>, #/lab/<id> that the catalogue does not resolve
//   path          a relative Markdown/HTML link, or a backticked repository path in prose,
//                 that names no file
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';

const REGION = /<!-- algoglyph:derived:begin (\S+) -->[\s\S]*?<!-- algoglyph:derived:end \1 -->/g;
const ROOTS = ['src', 'scripts', 'test', 'catalogue', 'docs', 'crates', '.ai', '.github', 'public', 'config'];

export function loadPolicy(root) {
  return parseYaml(readFileSync(join(root, 'config/derived-facts.yaml'), 'utf8'));
}

/** A glob with ** and * over / separated paths. */
export function globToRegExp(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?').replace(/\u0001/g, '.*');
  return new RegExp(`^${re}$`);
}

const matches = (path, globs) => globs.some((g) => globToRegExp(g).test(path));

function countPattern(policy) {
  const nums = ['\\d[\\d,]*', ...policy.number_words].join('|');
  const quals = `(?:(?:${policy.qualifiers.join('|')})[- ])?`;
  const nouns = [...policy.nouns].sort((a, b) => b.length - a.length).map((n) => n.replace(/ /g, '\\s+')).join('|');
  return new RegExp(`(?<![\\w.^/#-])(${nums})\\s+${quals}(${nouns})\\b`, 'gi');
}

const PLATE_NUMBER = /\bPL\.\s?\d{1,4}\b|\bplates?\s+(?:no\.?\s*)?#?\d{2,4}\b/gi;
const ROUTE = /#\/(p|c|lab)\/([a-z0-9][a-z0-9/-]*)/g;

/** A plan object that is closed (completed, or verified by evidence pinned to a commit) is a
 * record of what was true then: its text is history, not a claim about now. */
function closedRecord(text, policy) {
  let doc;
  try { doc = parseYaml(text); } catch { return false; }
  if (!doc || typeof doc !== 'object') return false;
  if ((policy.closed_when ?? []).some((k) => doc[k])) return true;
  return Array.isArray(doc.evidence) && doc.evidence.some((e) => e && e.commit);
}

/** Blank out derived regions (keeping line numbers) and mark YAML record subtrees. */
function prepare(path, text, policy) {
  const blanked = text.replace(REGION, (m) => m.replace(/[^\n]/g, ' '));
  const lines = blanked.split('\n');
  const record = new Array(lines.length).fill(false);
  if (/\.ya?ml$/.test(path) && closedRecord(text, policy)) return { lines, record: record.fill(true) };
  if (/\.ya?ml$/.test(path)) {
    let indent = -1;
    lines.forEach((l, i) => {
      const lead = l.match(/^(\s*)/)[1].length;
      if (indent >= 0 && l.trim() && lead <= indent) indent = -1;
      if (indent >= 0) { record[i] = true; return; }
      const key = l.match(/^(\s*)-?\s*([A-Za-z_][\w-]*):/);
      if (key && policy.record_keys.includes(key[2])) { indent = lead; record[i] = true; }
    });
  }
  return { lines, record };
}

/**
 * Findings for one file. `model` is the catalogue model (entries, nodes, labs); `exists` says
 * whether a repository-relative path exists.
 */
export function scan(path, text, { policy, model, exists }) {
  const out = [];
  const exempt = (check) => (policy.exempt ?? []).some((x) => x.checks.includes(check) && matches(path, [x.path]));
  const evidence = (policy.evidence_markers ?? []).map((m) => new RegExp(m));
  const { lines, record } = prepare(path, text, policy);
  const ids = new Set(model.entries.map((e) => e.id));
  const keys = new Set(model.nodes.map((n) => n.key));
  const labs = new Set(model.labs.map((l) => l.id));
  const prose = /\.(md|html)$/.test(path);
  const count = countPattern(policy);
  lines.forEach((line, i) => {
    if (record[i]) return;
    const at = { file: path, line: i + 1 };
    if (!exempt('count') && !evidence.some((re) => re.test(line))) {
      for (const m of line.matchAll(count)) out.push({ ...at, check: 'count', text: m[0] });
    }
    if (!exempt('plate-number')) {
      for (const m of line.matchAll(PLATE_NUMBER)) out.push({ ...at, check: 'plate-number', text: m[0] });
    }
    if (!exempt('link')) {
      for (const m of line.matchAll(ROUTE)) {
        const [, kind, raw] = m;
        const target = raw.replace(/\/+$/, '');
        const ok = kind === 'p' ? ids.has(target) : kind === 'c' ? keys.has(target) : labs.has(target);
        // a route built in code ends at a template hole: '#/p/' + id is not a link to judge
        if (!ok && !/\$\{|['"`]\s*\+/.test(line.slice(m.index + m[0].length, m.index + m[0].length + 3))) {
          out.push({ ...at, check: 'link', text: m[0] });
        }
      }
    }
    if (prose && !exempt('path')) {
      const refs = [];
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) refs.push({ ref: m[1], from: 'link' });
      // plain attributes only: :href and x-bind are expressions the browser evaluates
      for (const m of line.matchAll(/(?<![:\w-])(?:href|src)="([^"]+)"/g)) refs.push({ ref: m[1], from: 'link' });
      for (const m of line.matchAll(/`([.\w-]+(?:\/[.\w@-]+)+\/?)`/g)) refs.push({ ref: m[1], from: 'code' });
      for (const { ref, from } of refs) {
        if (/^(?:[a-z]+:|\/\/|#|mailto:)/i.test(ref) || /[<>*{}$]/.test(ref)) continue;
        const clean = ref.split(/[#?]/)[0];
        if (!clean) continue;
        if (from === 'code' && !ROOTS.includes(clean.split('/')[0])) continue;
        const repoPath = from === 'code' ? normalize(clean) : normalize(join(dirname(path), clean));
        const candidates = [repoPath, normalize(join('public', clean))];
        if (!candidates.some((c) => exists(c.replace(/\/$/, '')))) out.push({ ...at, check: 'path', text: ref });
      }
    }
  });
  return out;
}

/** The whole repository: every tracked file the policy includes. */
export function gate(root, model) {
  const policy = loadPolicy(root);
  const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const files = tracked.filter((f) => matches(f, policy.files.include) && !matches(f, policy.files.exclude));
  const exists = (p) => existsSync(join(root, p));
  const findings = [];
  for (const f of files) {
    if (!existsSync(join(root, f))) continue;
    findings.push(...scan(relative(root, join(root, f)), readFileSync(join(root, f), 'utf8'), { policy, model, exists }));
  }
  return { findings, files: files.length, exempt: policy.exempt ?? [] };
}
