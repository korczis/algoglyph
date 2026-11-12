import { S, type StringKernel, type StringOps } from '../../engines/string/trace';

const META = new Set(['(', ')', '|', '*', '+', '?']);

/** Epsilon edges of the automaton whose states are the positions of re (accept = re.length). */
export function epsilonGraph(re: string): number[][] {
  const m = re.length;
  const g: number[][] = Array.from({ length: m + 1 }, () => []);
  const stack: number[] = [];
  for (let i = 0; i < m; i++) {
    let lp = i;
    if (re[i] === '(' || re[i] === '|') stack.push(i);
    else if (re[i] === ')') {
      const ors: number[] = [];
      while (re[stack[stack.length - 1]] === '|') ors.push(stack.pop() as number);
      lp = stack.pop() as number;
      for (const o of ors) { g[lp].push(o + 1); g[o].push(i); }
    }
    const next = re[i + 1];
    if (next === '*') { g[lp].push(i + 1); g[i + 1].push(lp); }
    if (next === '+') g[i + 1].push(lp);
    if (next === '?') g[lp].push(i + 1);
    if (re[i] === '(' || re[i] === ')' || re[i] === '*' || re[i] === '+' || re[i] === '?') g[i].push(i + 1);
  }
  return g;
}

// The pattern, wrapped in parentheses, is the automaton: one state per character, a match edge
// from each literal (or '.') to the next state, epsilon edges for the operators. The simulation
// keeps the set of every state the text so far can be in, adds the start state at each position
// so a match may begin anywhere, and reports each position where the accept state is reached.
export const kernel: StringKernel<'regex', number[]> = {
  input: 'regex',
  counters: { trans: 'States examined', eps: 'Epsilon edges followed' },
  chart: { title: 'Active states along the text', x: 'text position', y: 'states in the set' },
  run(ops: StringOps, { pattern, text }) {
    const re = `(${pattern})`;
    const m = re.length;
    const g = epsilonGraph(re);
    ops.row('re', [...re, '✓'], { label: 'Automaton' });
    ops.row('text', [...text], { label: 'Text' });
    ops.list('ends', [], { label: 'Matches end at', lines: 1 });
    const closure = (from: number[]): number[] => {
      const seen = new Array<boolean>(m + 1).fill(false);
      const todo = from.slice();
      for (const s of todo) seen[s] = true;
      while (todo.length) {
        const s = todo.pop() as number;
        for (const t of g[s]) {
          ops.tick('eps');
          if (!seen[t]) { seen[t] = true; todo.push(t); }
        }
      }
      const out: number[] = [];
      for (let s = 0; s <= m; s++) if (seen[s]) out.push(s);
      return out;
    };
    const show = (states: number[]) => {
      ops.clear('re', true);
      for (const s of states) ops.mark('re', s, s === m ? S.done : S.hit);
    };
    const ends: number[] = [];
    let states = closure([0]);
    show(states);
    if (states.includes(m)) { ends.push(0); ops.push('ends', '0', S.done); }
    for (let j = 0; j < text.length; j++) {
      ops.clear('text');
      ops.mark('text', j, S.focus);
      const next: number[] = [0];
      for (const s of states) {
        if (s === m) continue;
        ops.tick('trans');
        if (!META.has(re[s]) && (re[s] === '.' || re[s] === text[j])) next.push(s + 1);
      }
      states = closure(next);
      show(states);
      ops.plot('Active states', j + 1, states.length);
      ops.note(`after '${text[j]}': ${states.length} states active`);
      if (states.includes(m)) {
        ends.push(j + 1);
        ops.push('ends', String(j + 1), S.done);
        ops.mark('text', j, S.done);
      }
    }
    ops.stat('Pattern', pattern);
    ops.stat('Match ends', String(ends.length));
    return ends;
  },
};
