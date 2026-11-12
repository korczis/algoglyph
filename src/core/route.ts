// The site's routes, parsed in one place:
//   #/?status=live|planned  the collection, filtered by lifecycle (the KPI cards link here)
//   #/                     the collection
//   #/c/<taxonomy path>    a node of the taxonomy
//   #/p/<id>?seed=…&…      a plate; the query carries its seed and changed parameters
//   #/lab/<id>?seed=…&…    a lab, the same query format
//   #/<collection>                       a figure collection (ADR 0009), e.g. #/feynman
//   #/<collection>/<vol>/<ch>            one chapter of it, e.g. #/feynman/III/01
//   #/<collection>/<vol>/<ch>/<fig>?…    a figure page on its plate, the plate's query format
// Anything that does not resolve (an unknown id, a malformed percent-encoding, a figure whose
// page is not routed) is the collection.
import {
  CATALOGUE, entry, figureAt, lab as findLab, node, routedChapters, type Chapter, type Collection,
  type Status,
} from './catalogue';
import { parseSeed } from './share';

export type View = 'browse' | 'plate' | 'lab' | 'figures' | 'figure';

export interface Route {
  view: View;
  key: string;
  id: string;
  seed?: number;
  query: string;
  /** The collection's status filter, on the browse views. */
  status?: Status | 'all';
}

/** What the figure routes resolve against; the catalogue's own by default (tests pass fixtures). */
export interface FigureModel { collections: Collection[]; chapters: Chapter[] }


const HOME: Route = { view: 'browse', key: '', id: '', query: '' };

export function parseRoute(hash: string,
  figures: FigureModel = CATALOGUE): Route {
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
  const st = new URLSearchParams(query).get('status');
  const status = st === 'live' || st === 'planned' || st === 'all' ? st : undefined;
  if (parts[0] === 'p' && parts[1] && entry(parts[1])) {
    return { view: 'plate', key: '', id: parts[1], seed, query };
  }
  if (parts[0] === 'lab' && parts[1] && findLab(parts[1])) {
    return { view: 'lab', key: '', id: parts[1], seed, query };
  }
  const coll = parts[0] && !['p', 'c', 'lab'].includes(parts[0])
    ? figures.collections.find((c) => c.id === parts[0]) : undefined;
  if (coll && parts.length === 4) {
    const key = parts.join('/');
    const at = figureAt(figures.chapters, key);
    if (at) return { view: 'figure', key, id: at.figure.plate, seed, query };
  }
  if (coll && (parts.length === 1 || parts.length === 3)) {
    const chapter = parts.length === 3 ? `${parts[1]}/${parts[2]}` : '';
    if (routedChapters(figures.chapters, coll.id, chapter).length) {
      return { view: 'figures', key: parts.join('/'), id: '', query: '' };
    }
  }
  if (parts[0] === 'c' && parts.length > 1 && node(parts.slice(1).join('/'))) {
    return { view: 'browse', key: parts.slice(1).join('/'), id: '', query: '', status };
  }
  return status ? { ...HOME, status } : HOME;
}
