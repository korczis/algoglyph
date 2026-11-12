// The main-thread budget of the inference wing, in a process of its own (test/support/budget.ts).
import { budgetSuite } from '../support/budget';

budgetSuite({ wing: 'inference' });
