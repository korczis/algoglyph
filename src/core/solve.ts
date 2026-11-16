// A kernel on a caller's own data, for kernels whose engine has no generic instance to hand it
// (numeric, stochastic): the kernel validates the data itself, names the field it refuses, and
// answers with a plain record. The flow's command line (src/flow/cli.ts) finds every kernel that
// declares one; nothing lists them by hand, and test/flow-obligations.test.ts asks each a reference.

export interface DataForm {
  /** The shape the kernel reads, written for a reader and an agent: `{A, b, c, rule?}`. */
  input: string;
  /** The answer on the data, or a refusal that names the offending field. Pure and bounded. */
  solve(data: unknown): Record<string, unknown> | string;
}

/** A finite number. */
export const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** An integer. */
export const integer = (x: unknown): x is number => Number.isInteger(x);

/** A plain object (not null, not an array). */
export const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** The keys of `d` outside `allowed`, so a misspelt field is refused rather than ignored. */
export function unknownKeys(d: Record<string, unknown>, allowed: readonly string[]): string | null {
  const extra = Object.keys(d).filter((k) => !allowed.includes(k));
  return extra.length ? `unknown field${extra.length > 1 ? 's' : ''} ${extra.join(', ')}; the form has ${allowed.join(', ')}` : null;
}
