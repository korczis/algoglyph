// Word lists the string engine's seeded inputs draw from. Everything here is synthetic: common
// English words, common Czech given names and surnames, generic trade words and the legal-form
// suffixes registries use. No list names a real organisation.

/** Common English words, most frequent first; prose draws them with Zipf weights. */
export const ENGLISH = (
  'the of and to in a is that for it as was with be by on not he this are or his from at which ' +
  'but have an they you were her she there one all we their been has would when if more can ' +
  'will no who its so up out said what them about into than then only other some time could ' +
  'these two may first new over such any after most also made like did many before must well ' +
  'through back where much even our way down should because each just those people state how ' +
  'world year still between own never under last might while house both same another found ' +
  'place three during without again small every great water night point light number market ' +
  'report river village letter garden window station morning evening system signal pattern ' +
  'string search record table answer reason question common simple second thing course order'
).split(' ');

export const GIVEN = ['Jan', 'Petr', 'Tomáš', 'Jiří', 'Pavel', 'Martin', 'Lukáš', 'Jakub',
  'Josef', 'Václav', 'Zdeněk', 'Miroslav', 'František', 'Dušan', 'Ondřej', 'Radek', 'Eva', 'Jana',
  'Marie', 'Lenka', 'Kateřina', 'Lucie', 'Věra', 'Hana', 'Alena', 'Šárka', 'Radka', 'Zuzana',
  'Tereza', 'Michaela'];

export const SURNAME = ['Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý',
  'Horák', 'Němec', 'Marek', 'Pokorný', 'Král', 'Růžička', 'Beneš', 'Fiala', 'Sedláček',
  'Doležal', 'Zeman', 'Kolář', 'Navrátil', 'Čermák', 'Urban', 'Vaněk', 'Blažek', 'Kříž', 'Šimek',
  'Hájek', 'Musil', 'Jelínek', 'Říha', 'Štěpánek', 'Bartoš', 'Kovář', 'Holub', 'Vlček'];

export const TOWN = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice',
  'Hradec Králové', 'Ústí nad Labem', 'Pardubice', 'Zlín', 'Kladno', 'Most', 'Opava', 'Jihlava'];

/** Generic trade words for synthetic company names. */
export const TRADE = ['Alfa', 'Stavby', 'Logistika', 'Mlýn', 'Pekárna', 'Energo', 'Agro', 'Kovo',
  'Dřevo', 'Servis', 'Doprava', 'Obchod', 'Strojírna', 'Textil', 'Sklárna', 'Tiskárna', 'Lesy',
  'Vinařství', 'Pivovar', 'Elektro', 'Plast', 'Projekt', 'Development', 'Trade', 'Invest'];

/** Titles written before or after a Czech name. */
export const TITLES = ['Ing.', 'Mgr.', 'Bc.', 'MUDr.', 'JUDr.', 'PhDr.', 'RNDr.', 'doc.', 'prof.',
  'Ph.D.', 'CSc.', 'MBA', 'DiS.'];

/** Legal forms: the canonical key and the spellings registries and documents use. */
export const LEGAL_FORMS: { key: string; spellings: string[] }[] = [
  { key: 'sro', spellings: ['s.r.o.', 's. r. o.', 'spol. s r.o.', 'spol. s r. o.', 'sro'] },
  { key: 'as', spellings: ['a.s.', 'a. s.', 'akciová společnost'] },
  { key: 'vos', spellings: ['v.o.s.', 'v. o. s.'] },
  { key: 'ks', spellings: ['k.s.', 'k. s.'] },
  { key: 'zs', spellings: ['z.s.', 'z. s.'] },
  { key: 'gmbh', spellings: ['GmbH', 'Gmbh'] },
  { key: 'ltd', spellings: ['Ltd.', 'Ltd', 'Limited'] },
];

/** Outlets of the synthetic news set: generic, invented names. */
export const OUTLETS = ['Morning Ledger', 'City Courier', 'Valley Post', 'Harbour Times',
  'Northern Herald', 'Daily Lantern', 'River Gazette', 'Evening Signal', 'Coast Review',
  'Plain Dealer Weekly', 'Market Observer', 'Hill Country News'];

export const AGENCIES = ['Wire Service A', 'Wire Service B', 'Press Agency C'];

/** Czech surnames and spellings of them found in German, Polish and English records. */
export const SPELLINGS: string[][] = [
  ['Novák', 'Nowak', 'Novack', 'Nowack'],
  ['Černý', 'Czerny', 'Cherny', 'Tscherny'],
  ['Dvořák', 'Dvorak', 'Dworzak', 'Dvorschak'],
  ['Kovář', 'Kowarz', 'Kovar', 'Kowar'],
  ['Procházka', 'Prochaska', 'Prohaska', 'Prochazka'],
  ['Šimek', 'Schimek', 'Simek', 'Shimek'],
  ['Jelínek', 'Jelinek', 'Yelinek', 'Jellinek'],
  ['Kučera', 'Kuchera', 'Kutschera', 'Kucera'],
  ['Veselý', 'Wesely', 'Vesely', 'Wessely'],
  ['Horák', 'Horak', 'Horack'],
  ['Hájek', 'Hajek', 'Haiek', 'Hayek'],
  ['Schmidt', 'Šmíd', 'Smith', 'Schmitt'],
  ['Wagner', 'Vágner', 'Wagener', 'Vagner'],
  ['Krejčí', 'Kreycy', 'Kreitschi', 'Krejci'],
];
