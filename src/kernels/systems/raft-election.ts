import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// Raft's leader election with the log check that makes it safe. A follower that hears no
// leader within a randomised timeout (150 ms up to the timeoutMax control's top) becomes a
// candidate: it starts a new term, votes for itself and asks every node for a vote. A node
// grants at most one vote per term, and only to a candidate whose log is at least as up to
// date as its own. A majority makes a leader, which
// appends a no-op entry for its term and sends heartbeats (AppendEntries) that keep the others
// followers and repair their logs. Any message with a newer term turns its receiver into a
// follower of that term. Leaders crash now and then and come back as followers.

type Role = 'follower' | 'candidate' | 'leader' | 'down';

export interface Vote { term: number; voter: number; candidate: number; t: number;
  candidateLast: [number, number]; voterLast: [number, number] }
export interface Leader { term: number; node: number; t: number; votes: number[] }
export interface RaftResult { leaders: Leader[]; votes: Vote[]; n: number }

/** The election timeout's least value; its top is the timeoutMax control (default 300). */
const ELECTION_MIN = 150;
const HEARTBEAT = 50;

export const kernel: SystemsKernel<RaftResult> = {
  network: true,
  params: [
    { kind: 'range', key: 'nodes', label: 'Nodes', min: 3, max: 7, step: 1, value: 5, rebuild: true },
    // above the 150 ms floor of the window; a shorter top means more elections at n² messages
    // each, and the range ends where the main-thread budget does (test/budget/systems.test.ts measures it)
    { kind: 'range', key: 'timeoutMax', label: 'Election timeout up to (ms)', min: 160, max: 900, step: 10, value: 300, rebuild: true },
  ],
  setup: (p) => ({
    lanes: Array.from({ length: num(p, 'nodes') }, (_, i) => `node ${i + 1}`),
    horizon: 6000,
    window: 1200,
  }),
  machine: { states: ['follower', 'candidate', 'leader', 'down'] },
  install(net, p) {
    const n = num(p, 'nodes');
    const timeoutMax = Number(p.timeoutMax ?? 300);
    const majority = Math.floor(n / 2) + 1;
    const res: RaftResult = { leaders: [], votes: [], n };
    const term = new Array<number>(n).fill(0);
    const votedFor = new Array<number>(n).fill(-1);
    const role = new Array<Role>(n).fill('follower');
    const log: number[][] = Array.from({ length: n }, () => []); // entry terms, index = position + 1
    const votes: Set<number>[] = Array.from({ length: n }, () => new Set());
    const nextIndex: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));
    const timer: (ReturnType<typeof net.at> | null)[] = new Array(n).fill(null);
    const beat: (ReturnType<typeof net.at> | null)[] = new Array(n).fill(null);
    const last = (i: number): [number, number] => [log[i].length ? log[i][log[i].length - 1] : 0, log[i].length];
    const upToDate = (c: [number, number], v: [number, number]) => c[0] > v[0] || (c[0] === v[0] && c[1] >= v[1]);
    /** Nodes i can reach now, itself included: up, and on its side of any partition. */
    const reach = (i: number) => {
      let k = 0;
      for (let j = 0; j < n; j++) if (j === i || (role[j] !== 'down' && !net.cut(i, j, net.now))) k++;
      return k;
    };
    const stood = new Map<number, Set<number>>(); // term -> its candidates
    const won = new Set<number>(); // terms that elected a leader
    const reachable = new Set<number>(); // terms a candidate gave up on with a majority in reach
    const pending = new Set<number>(); // terms with rival candidates, not yet over
    // A term is over once no node can still win it: none is its candidate, and none is at an
    // earlier term (only a node at term t - 1 can stand in t). An over term that had rival
    // candidates, no leader, and a candidate that gave up while a majority was within reach is
    // a split vote; one whose candidates were cut off in a minority failed for want of voters.
    const settle = () => {
      for (const t of pending) {
        if (won.has(t)) { pending.delete(t); continue; }
        if (term.some((x, j) => x < t || (x === t && role[j] === 'candidate'))) continue;
        pending.delete(t);
        if (reachable.has(t)) net.count('split');
      }
    };

    const setRole = (i: number, r: Role) => {
      if (role[i] !== r) { role[i] = r; net.state(i, r); }
    };
    const resetTimer = (i: number) => {
      net.cancel(timer[i]);
      timer[i] = net.after(net.uniform(ELECTION_MIN, timeoutMax), () => timeout(i));
    };
    const newTerm = (i: number, t: number) => {
      if (t <= term[i]) return;
      term[i] = t;
      votedFor[i] = -1;
      net.sample(`node ${i + 1}`, t);
      if (role[i] === 'leader') { net.cancel(beat[i]); resetTimer(i); }
      setRole(i, 'follower');
      settle();
    };
    const timeout = (i: number) => {
      if (role[i] === 'down' || role[i] === 'leader') return;
      if (role[i] === 'candidate' && reach(i) >= majority) reachable.add(term[i]);
      term[i]++;
      if (!stood.has(term[i])) stood.set(term[i], new Set());
      stood.get(term[i])!.add(i);
      if (stood.get(term[i])!.size > 1) pending.add(term[i]);
      net.sample(`node ${i + 1}`, term[i]);
      net.gauge('term', Math.max(...term));
      votedFor[i] = i;
      votes[i] = new Set([i]);
      setRole(i, 'candidate');
      net.count('elections');
      net.mark(i, `T${term[i]}?`, 0.55);
      resetTimer(i);
      settle();
      const t = term[i]; const mine = last(i);
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        net.send(i, j, 'RequestVote', () => {
          if (role[j] === 'down') return;
          newTerm(j, t);
          let granted = false;
          if (t === term[j] && (votedFor[j] === -1 || votedFor[j] === i) && upToDate(mine, last(j))) {
            granted = true;
            votedFor[j] = i;
            res.votes.push({ term: t, voter: j, candidate: i, t: net.now, candidateLast: mine, voterLast: last(j) });
            resetTimer(j);
          }
          const tj = term[j];
          net.send(j, i, granted ? 'vote' : 'no', () => {
            if (role[i] === 'down') return;
            newTerm(i, tj);
            if (!granted || role[i] !== 'candidate' || term[i] !== t) return;
            votes[i].add(j);
            if (votes[i].size >= majority) becomeLeader(i);
          });
        });
      }
      if (votes[i].size >= majority) becomeLeader(i);
    };
    const becomeLeader = (i: number) => {
      setRole(i, 'leader');
      won.add(term[i]);
      net.cancel(timer[i]);
      res.leaders.push({ term: term[i], node: i, t: net.now, votes: [...votes[i]] });
      net.count('leaders');
      net.mark(i, `leader T${term[i]}`, 0.95);
      log[i].push(term[i]);
      nextIndex[i].fill(log[i].length);
      heartbeat(i);
    };
    const heartbeat = (i: number) => {
      if (role[i] !== 'leader') return;
      const t = term[i];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const prev = nextIndex[i][j] - 1;
        const prevTerm = prev > 0 ? log[i][prev - 1] : 0;
        const entries = log[i].slice(prev);
        net.send(i, j, entries.length ? `append ${entries.length}` : 'heartbeat', () => {
          if (role[j] === 'down') return;
          newTerm(j, t);
          let ok = false;
          if (t === term[j]) {
            setRole(j, 'follower');
            resetTimer(j);
            if (prev === 0 || (log[j].length >= prev && log[j][prev - 1] === prevTerm)) {
              ok = true;
              log[j] = log[j].slice(0, prev).concat(entries);
            }
          }
          const tj = term[j]; const match = prev + entries.length;
          net.send(j, i, ok ? 'ok' : 'reject', () => {
            if (role[i] === 'down') return;
            newTerm(i, tj);
            if (role[i] !== 'leader' || term[i] !== t) return;
            if (ok) nextIndex[i][j] = match + 1;
            else if (tj === t) nextIndex[i][j] = Math.max(1, nextIndex[i][j] - 1);
          }, { quiet: ok && !entries.length });
        }, { quiet: !entries.length });
      }
      beat[i] = net.after(HEARTBEAT, () => heartbeat(i));
    };
    // leaders crash from time to time and recover as followers with their state intact
    const chaos = () => {
      const leader = role.findIndex((r) => r === 'leader');
      if (leader >= 0) {
        net.cancel(beat[leader]);
        net.cancel(timer[leader]);
        setRole(leader, 'down');
        net.count('crashes');
        net.mark(leader, 'crash', 0.05);
        net.after(net.uniform(500, 900), () => { setRole(leader, 'follower'); resetTimer(leader); });
      }
      net.after(net.uniform(1100, 1700), chaos);
    };
    // a leader cut off in a minority still believes it leads, but it cannot commit anything
    const leaderless = () => {
      if (!role.some((r, i) => r === 'leader' && reach(i) >= majority)) net.count('leaderless', 10);
      net.after(10, leaderless);
    };
    for (let i = 0; i < n; i++) { net.state(i, 'follower'); net.sample(`node ${i + 1}`, 0); resetTimer(i); }
    net.after(net.uniform(1100, 1700), chaos);
    net.after(0, leaderless);
    return res;
  },
  readouts: [
    { key: 'elections', label: 'Elections started' },
    { key: 'leaders', label: 'Leaders elected' },
    { key: 'split', label: 'Terms lost to a split vote' },
    { key: 'crashes', label: 'Leader crashes' },
    { key: 'term', kind: 'gauge', label: 'Highest term' },
    { key: 'leaderless', label: 'Time without a leader that reaches a majority', unit: ' ms' },
  ],
  chart: { title: 'Current term of each node', y: 'term' },
  verdict(r) {
    const byTerm = new Map<number, Set<number>>();
    for (const l of r.leaders) {
      if (!byTerm.has(l.term)) byTerm.set(l.term, new Set());
      byTerm.get(l.term)!.add(l.node);
    }
    const two = [...byTerm.values()].filter((s) => s.size > 1).length;
    return two ? `${two} terms with two leaders` : `one leader per term in all ${byTerm.size} terms that elected one`;
  },
};
