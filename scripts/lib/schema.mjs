// A data-driven validator (ADR 0005 §1): the shape of a document is declared in YAML
// (catalogue/schema/*.yaml), never in code. One function walks a value against its spec and
// returns every error with its field path, plus the references it saw, which the caller
// resolves once the whole catalogue is known.
//
//   spec: { type, required, of, fields, values, min_items, min_length, doc }
//   type: string | integer | number | boolean | id | list | map | enum
//         | entry | source | lab | taxonomy | relation   (references, resolved by the caller)
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

export const REFERENCE_TYPES = ['entry', 'source', 'lab', 'taxonomy', 'relation'];
const ID = /^[a-z0-9][a-z0-9-]*$/;
// relation types read as predicates: snake_case (compares_with), never an entry id
const RELATION = /^[a-z][a-z0-9_]*$/;

export function loadSchema(file) {
  const doc = parseYaml(readFileSync(file, 'utf8'));
  if (!doc || typeof doc.fields !== 'object') throw new Error(`${file}: a schema needs fields`);
  return doc;
}

const kind = (v) => (Array.isArray(v) ? 'list' : v === null ? 'null' : typeof v);

/**
 * Validate `value` against `spec` at `path`. Pushes messages into `errors` and references
 * ({ type, value, path }) into `refs`.
 */
export function check(value, spec, path, errors, refs) {
  const at = path || '(root)';
  const t = spec.type;
  if (t === 'map') {
    if (kind(value) !== 'object') { errors.push(`${at}: expected a map, got ${kind(value)}`); return; }
    const fields = spec.fields ?? {};
    for (const k of Object.keys(value)) {
      if (!(k in fields)) errors.push(`${path ? `${path}.` : ''}${k}: unknown field`);
    }
    for (const [k, sub] of Object.entries(fields)) {
      const p = path ? `${path}.${k}` : k;
      if (value[k] === undefined || value[k] === null) {
        if (sub.required) errors.push(`${p}: required`);
        continue;
      }
      check(value[k], sub, p, errors, refs);
    }
    return;
  }
  if (t === 'list') {
    if (!Array.isArray(value)) { errors.push(`${at}: expected a list, got ${kind(value)}`); return; }
    if (spec.min_items && value.length < spec.min_items) errors.push(`${at}: at least ${spec.min_items} item(s)`);
    if (spec.unique) {
      const seen = new Set();
      for (const v of value) {
        const key = JSON.stringify(v);
        if (seen.has(key)) errors.push(`${at}: duplicate item ${key}`);
        seen.add(key);
      }
    }
    value.forEach((v, i) => check(v, spec.of ?? { type: 'string' }, `${at}[${i}]`, errors, refs));
    return;
  }
  if (t === 'enum') {
    if (!(spec.values ?? []).includes(value)) errors.push(`${at}: ${JSON.stringify(value)} is not one of ${(spec.values ?? []).join(', ')}`);
    return;
  }
  if (t === 'string' || REFERENCE_TYPES.includes(t) || t === 'id') {
    if (typeof value !== 'string') { errors.push(`${at}: expected a string, got ${kind(value)}`); return; }
    if (spec.min_length && value.trim().length < spec.min_length) errors.push(`${at}: at least ${spec.min_length} characters`);
    if ((t === 'id' || t === 'entry' || t === 'lab' || t === 'source') && !ID.test(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} is not an id (${ID})`);
    }
    if (t === 'relation' && !RELATION.test(value)) errors.push(`${at}: ${JSON.stringify(value)} is not a relation type (${RELATION})`);
    if (REFERENCE_TYPES.includes(t)) refs.push({ type: t, value, path: at });
    return;
  }
  if (t === 'boolean') { if (typeof value !== 'boolean') errors.push(`${at}: expected true or false`); return; }
  if (t === 'integer') { if (!Number.isInteger(value)) errors.push(`${at}: expected an integer`); return; }
  if (t === 'number') { if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${at}: expected a number`); return; }
  if (t === 'any') return;
  errors.push(`${at}: the schema names an unknown type ${t}`);
}

/** Every field path a schema declares, with its spec: the field dictionary. */
export function fieldPaths(spec, prefix = '') {
  const out = [];
  for (const [k, sub] of Object.entries(spec.fields ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.push({ path: p, ...sub, fields: undefined, of: sub.of ? { type: sub.of.type } : undefined });
    if (sub.type === 'map') out.push(...fieldPaths(sub, p));
    if (sub.type === 'list' && sub.of?.type === 'map') out.push(...fieldPaths(sub.of, `${p}[]`));
  }
  return out;
}
