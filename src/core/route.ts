// The site's routes, parsed in one place:
//   #/                     the collection
//   #/c/<taxonomy path>    a node of the taxonomy
//   #/p/<id>?seed=…&…      a plate; the query carries its seed and changed parameters
//   #/lab/<id>?seed=…&…    a lab, the same query format
// Anything that does not resolve (an unknown id, a malformed percent-encoding) is the collection.
import { entry, lab as findLab, node } from './catalogue';
import { parseSeed } from './share';

export type View = 'browse' | 'plate' | 'lab';

export interface Route {
  view: View;
  key: string;
  id: string;
  seed?: number;
  query: string;
}

const HOME: Route = { view: 'browse', key: '', id: '', query: '' };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const at = raw.indexOf('?');
  const path = at < 0 ? raw : raw.slice(0, at);
  const query = at < 0 ? '' : raw.slice(at + 1);
  let parts: string[];
  try {
    parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return HOME;
  }
  const seed = parseSeed(query);
  if (parts[0] === 'p' && parts[1] && entry(parts[1])) {
    return { view: 'plate', key: '', id: parts[1], seed, query };
  }
  if (parts[0] === 'lab' && parts[1] && findLab(parts[1])) {
    return { view: 'lab', key: '', id: parts[1], seed, query };
  }
  if (parts[0] === 'c' && parts.length > 1 && node(parts.slice(1).join('/'))) {
    return { view: 'browse', key: parts.slice(1).join('/'), id: '', query: '' };
  }
  return HOME;
}
