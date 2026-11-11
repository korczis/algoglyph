/** American Soundex: the first letter, then up to three digit classes of the consonants that
 * follow; vowels separate equal classes, H and W do not. */
export function soundex(word: string, tick: () => void = () => {}): string {
  const s = word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return '';
  const code = (c: string) => {
    if ('BFPV'.includes(c)) return '1';
    if ('CGJKQSXZ'.includes(c)) return '2';
    if ('DT'.includes(c)) return '3';
    if (c === 'L') return '4';
    if ('MN'.includes(c)) return '5';
    if (c === 'R') return '6';
    return '0';
  };
  let out = s[0];
  let prev = code(s[0]);
  tick();
  for (let i = 1; i < s.length && out.length < 4; i++) {
    tick();
    const c = s[i];
    if (c === 'H' || c === 'W') continue;
    const k = code(c);
    if (k === '0') { prev = '0'; continue; }
    if (k !== prev) out += k;
    prev = k;
  }
  return (out + '000').slice(0, 4);
}

/**
 * Double Metaphone (Lawrence Philips, 2000): a primary and an alternate key of up to four
 * characters for an upper-cased word ('0' stands for the th sound, 'X' for sh/ch). `step` is
 * told where each rule started and how far it consumed.
 */
export function doubleMetaphone(word: string, step: (at: number, next: number, p: string, a: string) => void = () => {}): [string, string] {
  const s = word.toUpperCase();
  const length = s.length;
  const last = length - 1;
  let p = ''; let a = '';
  let cur = 0;
  const slavo = /W|K|CZ|WITZ/.test(s);
  const at = (i: number, ...subs: string[]) => i >= 0 && subs.some((t) => s.substr(i, t.length) === t);
  const ch = (i: number) => (i >= 0 && i < length ? s[i] : '');
  const vowel = (i: number) => 'AEIOUY'.includes(ch(i)) && ch(i) !== '';
  const add = (x: string, y: string = x) => { p += x; a += y; };
  if (at(0, 'GN', 'KN', 'PN', 'WR', 'PS')) cur = 1;
  if (ch(0) === 'X') { add('S'); cur = 1; }
  while ((p.length < 4 || a.length < 4) && cur < length) {
    const from = cur;
    const c = s[cur];
    switch (c) {
      case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
        if (cur === 0) add('A');
        cur++;
        break;
      case 'B':
        add('P');
        cur += ch(cur + 1) === 'B' ? 2 : 1;
        break;
      case 'C':
        if (cur > 1 && !vowel(cur - 2) && at(cur - 1, 'ACH') && ch(cur + 2) !== 'I'
          && (ch(cur + 2) !== 'E' || at(cur - 2, 'BACHER', 'MACHER'))) { add('K'); cur += 2; break; }
        if (cur === 0 && at(cur, 'CAESAR')) { add('S'); cur += 2; break; }
        if (at(cur, 'CHIA')) { add('K'); cur += 2; break; }
        if (at(cur, 'CH')) {
          if (cur > 0 && at(cur, 'CHAE')) { add('K', 'X'); cur += 2; break; }
          if (cur === 0 && (at(cur + 1, 'HARAC', 'HARIS') || at(cur + 1, 'HOR', 'HYM', 'HIA', 'HEM')) && !at(0, 'CHORE')) {
            add('K'); cur += 2; break;
          }
          if (at(0, 'VAN ', 'VON ', 'SCH') || at(cur - 2, 'ORCHES', 'ARCHIT', 'ORCHID') || at(cur + 2, 'T', 'S')
            || ((at(cur - 1, 'A', 'O', 'U', 'E') || cur === 0) && at(cur + 2, 'L', 'R', 'N', 'M', 'B', 'H', 'F', 'V', 'W', ' '))) {
            add('K');
          } else if (cur > 0) {
            if (at(0, 'MC')) add('K'); else add('X', 'K');
          } else add('X');
          cur += 2;
          break;
        }
        if (at(cur, 'CZ') && !at(cur - 2, 'WICZ')) { add('S', 'X'); cur += 2; break; }
        if (at(cur + 1, 'CIA')) { add('X'); cur += 3; break; }
        if (at(cur, 'CC') && !(cur === 1 && ch(0) === 'M')) {
          if (at(cur + 2, 'I', 'E', 'H') && !at(cur + 2, 'HU')) {
            if ((cur === 1 && ch(0) === 'A') || at(cur - 1, 'UCCEE', 'UCCES')) add('KS'); else add('X');
            cur += 3;
          } else { add('K'); cur += 2; }
          break;
        }
        if (at(cur, 'CK', 'CG', 'CQ')) { add('K'); cur += 2; break; }
        if (at(cur, 'CI', 'CE', 'CY')) {
          if (at(cur, 'CIO', 'CIE', 'CIA')) add('S', 'X'); else add('S');
          cur += 2;
          break;
        }
        add('K');
        if (at(cur + 1, ' C', ' Q', ' G')) cur += 3;
        else if (at(cur + 1, 'C', 'K', 'Q') && !at(cur + 1, 'CE', 'CI')) cur += 2;
        else cur++;
        break;
      case 'D':
        if (at(cur, 'DG')) {
          if (at(cur + 2, 'I', 'E', 'Y')) { add('J'); cur += 3; } else { add('TK'); cur += 2; }
          break;
        }
        if (at(cur, 'DT', 'DD')) { add('T'); cur += 2; break; }
        add('T'); cur++;
        break;
      case 'F':
        cur += ch(cur + 1) === 'F' ? 2 : 1;
        add('F');
        break;
      case 'G':
        if (ch(cur + 1) === 'H') {
          if (cur > 0 && !vowel(cur - 1)) { add('K'); cur += 2; break; }
          if (cur === 0) { if (ch(cur + 2) === 'I') add('J'); else add('K'); cur += 2; break; }
          if ((cur > 1 && at(cur - 2, 'B', 'H', 'D')) || (cur > 2 && at(cur - 3, 'B', 'H', 'D')) || (cur > 3 && at(cur - 4, 'B', 'H'))) {
            cur += 2; break;
          }
          if (cur > 2 && ch(cur - 1) === 'U' && at(cur - 3, 'C', 'G', 'L', 'R', 'T')) add('F');
          else if (cur > 0 && ch(cur - 1) !== 'I') add('K');
          cur += 2;
          break;
        }
        if (ch(cur + 1) === 'N') {
          if (cur === 1 && vowel(0) && !slavo) add('KN', 'N');
          else if (!at(cur + 2, 'EY') && !slavo) add('N', 'KN');
          else add('KN');
          cur += 2;
          break;
        }
        if (at(cur + 1, 'LI') && !slavo) { add('KL', 'L'); cur += 2; break; }
        if (cur === 0 && (ch(cur + 1) === 'Y' || at(cur + 1, 'ES', 'EP', 'EB', 'EL', 'EY', 'IB', 'IL', 'IN', 'IE', 'EI', 'ER'))) {
          add('K', 'J'); cur += 2; break;
        }
        if ((at(cur + 1, 'ER') || ch(cur + 1) === 'Y') && !at(0, 'DANGER', 'RANGER', 'MANGER') && !at(cur - 1, 'E', 'I')
          && !at(cur - 1, 'RGY', 'OGY')) { add('K', 'J'); cur += 2; break; }
        if (at(cur + 1, 'E', 'I', 'Y') || at(cur - 1, 'AGGI', 'OGGI')) {
          if (at(0, 'VAN ', 'VON ', 'SCH') || at(cur + 1, 'ET')) add('K');
          else if (at(cur + 1, 'IER ')) add('J');
          else add('J', 'K');
          cur += 2;
          break;
        }
        cur += ch(cur + 1) === 'G' ? 2 : 1;
        add('K');
        break;
      case 'H':
        if ((cur === 0 || vowel(cur - 1)) && vowel(cur + 1)) { add('H'); cur += 2; } else cur++;
        break;
      case 'J':
        if (at(cur, 'JOSE') || at(0, 'SAN ')) {
          if ((cur === 0 && ch(cur + 4) === ' ') || at(0, 'SAN ')) add('H'); else add('J', 'H');
          cur++;
          break;
        }
        if (cur === 0) add('J', 'A');
        else if (vowel(cur - 1) && !slavo && (ch(cur + 1) === 'A' || ch(cur + 1) === 'O')) add('J', 'H');
        else if (cur === last) add('J', '');
        else if (!at(cur + 1, 'L', 'T', 'K', 'S', 'N', 'M', 'B', 'Z') && !at(cur - 1, 'S', 'K', 'L')) add('J');
        cur += ch(cur + 1) === 'J' ? 2 : 1;
        break;
      case 'K':
        cur += ch(cur + 1) === 'K' ? 2 : 1;
        add('K');
        break;
      case 'L':
        if (ch(cur + 1) === 'L') {
          if ((cur === length - 3 && at(cur - 1, 'ILLO', 'ILLA', 'ALLE'))
            || ((at(last - 1, 'AS', 'OS') || at(last, 'A', 'O')) && at(cur - 1, 'ALLE'))) { add('L', ''); cur += 2; break; }
          cur += 2;
        } else cur++;
        add('L');
        break;
      case 'M':
        if ((at(cur - 1, 'UMB') && (cur + 1 === last || at(cur + 2, 'ER'))) || ch(cur + 1) === 'M') cur += 2; else cur++;
        add('M');
        break;
      case 'N':
        cur += ch(cur + 1) === 'N' ? 2 : 1;
        add('N');
        break;
      case 'P':
        if (ch(cur + 1) === 'H') { add('F'); cur += 2; break; }
        cur += at(cur + 1, 'P', 'B') ? 2 : 1;
        add('P');
        break;
      case 'Q':
        cur += ch(cur + 1) === 'Q' ? 2 : 1;
        add('K');
        break;
      case 'R':
        if (cur === last && !slavo && at(cur - 2, 'IE') && !at(cur - 4, 'ME', 'MA')) add('', 'R'); else add('R');
        cur += ch(cur + 1) === 'R' ? 2 : 1;
        break;
      case 'S':
        if (at(cur - 1, 'ISL', 'YSL')) { cur++; break; }
        if (cur === 0 && at(cur, 'SUGAR')) { add('X', 'S'); cur++; break; }
        if (at(cur, 'SH')) {
          if (at(cur + 1, 'HEIM', 'HOEK', 'HOLM', 'HOLZ')) add('S'); else add('X');
          cur += 2;
          break;
        }
        if (at(cur, 'SIO', 'SIA', 'SIAN')) {
          if (!slavo) add('S', 'X'); else add('S');
          cur += 3;
          break;
        }
        if ((cur === 0 && at(cur + 1, 'M', 'N', 'L', 'W')) || at(cur + 1, 'Z')) {
          add('S', 'X');
          cur += at(cur + 1, 'Z') ? 2 : 1;
          break;
        }
        if (at(cur, 'SC')) {
          if (ch(cur + 2) === 'H') {
            if (at(cur + 3, 'OO', 'ER', 'EN', 'UY', 'ED', 'EM')) {
              if (at(cur + 3, 'ER', 'EN')) add('X', 'SK'); else add('SK');
            } else if (cur === 0 && !vowel(3) && ch(3) !== 'W') add('X', 'S');
            else add('X');
            cur += 3;
            break;
          }
          if (at(cur + 2, 'I', 'E', 'Y')) add('S'); else add('SK');
          cur += 3;
          break;
        }
        if (cur === last && at(cur - 2, 'AI', 'OI')) add('', 'S'); else add('S');
        cur += at(cur + 1, 'S', 'Z') ? 2 : 1;
        break;
      case 'T':
        if (at(cur, 'TION')) { add('X'); cur += 3; break; }
        if (at(cur, 'TIA', 'TCH')) { add('X'); cur += 3; break; }
        if (at(cur, 'TH', 'TTH')) {
          if (at(cur + 2, 'OM', 'AM') || at(0, 'VAN ', 'VON ', 'SCH')) add('T'); else add('0', 'T');
          cur += 2;
          break;
        }
        cur += at(cur + 1, 'T', 'D') ? 2 : 1;
        add('T');
        break;
      case 'V':
        cur += ch(cur + 1) === 'V' ? 2 : 1;
        add('F');
        break;
      case 'W':
        if (at(cur, 'WR')) { add('R'); cur += 2; break; }
        if (cur === 0 && (vowel(cur + 1) || at(cur, 'WH'))) { if (vowel(cur + 1)) add('A', 'F'); else add('A'); }
        if ((cur === last && vowel(cur - 1)) || at(cur - 1, 'EWSKI', 'EWSKY', 'OWSKI', 'OWSKY') || at(0, 'SCH')) {
          add('', 'F'); cur++; break;
        }
        if (at(cur, 'WICZ', 'WITZ')) { add('TS', 'FX'); cur += 4; break; }
        cur++;
        break;
      case 'X':
        if (!(cur === last && (at(cur - 3, 'IAU', 'EAU') || at(cur - 2, 'AU', 'OU')))) add('KS');
        cur += at(cur + 1, 'C', 'X') ? 2 : 1;
        break;
      case 'Z':
        if (ch(cur + 1) === 'H') { add('J'); cur += 2; break; }
        if (at(cur + 1, 'ZO', 'ZI', 'ZA') || (slavo && cur > 0 && ch(cur - 1) !== 'T')) add('S', 'TS'); else add('S');
        cur += ch(cur + 1) === 'Z' ? 2 : 1;
        break;
      default:
        cur++;
    }
    step(from, cur, p.slice(0, 4), a.slice(0, 4));
  }
  return [p.slice(0, 4), a.slice(0, 4)];
}
