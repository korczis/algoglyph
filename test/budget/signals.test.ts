// The main-thread budget of the signals wing, in a process of its own (test/support/budget.ts).
import { budgetSuite } from '../support/budget';

budgetSuite({ wing: 'signals' });
