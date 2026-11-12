/** Binary operators of the expression inputs: precedence and associativity. */
export const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '^': 3 };
export const RIGHT = new Set(['^']);
export const isOp = (t: string) => t in PREC;

export function apply(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '^': return a ** b;
    default: throw new Error(`unknown operator ${op}`);
  }
}
