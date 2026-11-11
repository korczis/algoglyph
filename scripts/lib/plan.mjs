// The plan the catalogue implies (ADR 0004): one milestone per wing with planned entries, one
// issue per engine within it, with disjoint scopes so parallel waves never collide. Pure: the
// CLI (scripts/catalogue.mjs plan) writes it, the tests read it.
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The plan the planned entries imply: a milestone per wing, an issue per engine within it. */
export function derivePlan(model) {
  const node = (k) => model.nodes.find((n) => n.key === k);
  const milestones = [];
  const issues = [];
  const builtBy = new Map();
  model.roots.forEach((wingKey, wi) => {
    const wing = node(wingKey);
    const planned = model.entries.filter((e) => e.path[0] === wingKey && e.status === 'planned');
    if (!planned.length) return;
    const mid = `MC-${wingKey}`;
    const engines = [...new Set(planned.map((e) => e.engine))];
    milestones.push({
      id: mid,
      title: `${wing.title}: every catalogued algorithm runs`,
      slug: slug(`${wing.title} every catalogued algorithm runs`),
      order: 100 + wi,
      priority: 'p2',
      // no count here: a number in a stored file is a copy; the list is derived where it is read
      problem: `Algorithms of the ${wing.title} wing are catalogued and not yet running: npm run catalogue -- list --under ${wingKey} --status planned.`,
      outcome: `Every entry under ${wingKey}/ is live, tested by its engine's harness and in the browser gate.`,
      acceptance_criteria: [`npm run catalogue -- list --under ${wingKey} --status planned prints nothing.`],
      validation: ['npm run catalogue -- --check', 'npm run verify'],
      evidence_required: ['milestone_verified'],
    });
    for (const engine of engines) {
      const mine = planned.filter((e) => e.engine === engine);
      const id = `IC-${wingKey}-${engine}`;
      // the first issue of an engine builds it (and its harness test); the others only add
      // kernels to it, so every issue's scope is disjoint from every other's
      const builds = engine !== 'custom' && !builtBy.has(engine) && !model.entries.some((e) => e.engine === engine && e.status === 'live');
      if (builds) builtBy.set(engine, id);
      const code = engine === 'custom'
        ? mine.map((e) => `src/plates/${e.id}`)
        : mine.map((e) => `src/kernels/${engine}/${e.id}.ts`);
      const owned = builds ? [`src/engines/${engine}`, `test/kernels-${engine}.test.ts`] : [];
      issues.push({
        id,
        milestone: mid,
        title: `${wing.title}: the ${engine === 'custom' ? 'bespoke' : engine} plates`,
        slug: slug(`${wing.title} ${engine} plates`),
        priority: 'p2',
        profile: 'implementation',
        objective: `${builds ? `Build the ${engine} engine and its harness test, then make` : 'Make'} live: ${mine.map((e) => e.id).join(', ')}.`,
        why: 'Derived from the catalogue (ADR 0004): these entries are planned in this wing for this engine.',
        scope: [...owned, ...code, ...mine.map((e) => `catalogue/entries/${e.id}.md`)],
        depends_on: !builds && builtBy.has(engine) ? [builtBy.get(engine)] : [],
        acceptance_criteria: [
          'Every entry named in the objective has status live, and its kernel or plate exists.',
          'Its readouts are counted from its own run and its harness tests compare with an independent reference.',
          'npm run verify passes.',
        ],
        validation: ['npm run catalogue -- --check', 'npm run verify'],
        evidence_required: ['verified'],
        parallel_safe: true,
      });
    }
  });
  return { milestones, issues };
}

