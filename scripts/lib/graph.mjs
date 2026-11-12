// The knowledge graph (ADR 0005 §4): every node and typed edge of the catalogue model, in a
// deterministic order, as the site ships it (graph.json beside index.html). Nodes are entries,
// taxonomy nodes, labs and sources; edges are the typed relations (declared and derived) plus
// belongs_to, cites and compared_in. Pure: the Vite plugin and the tests call it.
export function graph(model) {
  const nodes = [
    ...model.entries.map((e) => ({ id: `entry:${e.id}`, kind: 'entry', label: e.title, status: e.status, engine: e.engine,
      evidence: e.evidence, maturity: e.maturity })),
    ...model.nodes.map((n) => ({ id: `taxonomy:${n.key}`, kind: 'taxonomy', label: n.title })),
    ...model.labs.map((l) => ({ id: `lab:${l.id}`, kind: 'lab', label: l.title })),
    ...model.sources.map((s) => ({ id: `source:${s.id}`, kind: 'source', label: s.title })),
  ];
  const edges = [];
  for (const e of model.entries) {
    for (const l of e.links) edges.push({ from: `entry:${e.id}`, to: `entry:${l.to}`, type: l.type, derived: l.derived });
    edges.push({ from: `entry:${e.id}`, to: `taxonomy:${e.taxonomy}`, type: 'belongs_to', derived: false });
    for (const s of e.sources) edges.push({ from: `entry:${e.id}`, to: `source:${s.id}`, type: 'cites', derived: false });
    for (const l of e.labs) edges.push({ from: `entry:${e.id}`, to: `lab:${l}`, type: 'compared_in', derived: false });
  }
  for (const n of model.nodes) {
    if (n.depth > 1) edges.push({ from: `taxonomy:${n.key}`, to: `taxonomy:${n.path.slice(0, -1).join('/')}`, type: 'belongs_to', derived: false });
  }
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  nodes.sort((a, b) => order(a.id, b.id));
  edges.sort((a, b) => order(a.from, b.from) || order(a.type, b.type) || order(a.to, b.to));
  return { schema: 'algoglyph.graph/v1', relationTypes: model.relationTypes, nodes, edges };
}
