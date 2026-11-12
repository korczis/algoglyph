// The main-thread budget of every runnable lab, in a process of its own (test/support/budget.ts).
import { budgetSuite } from '../support/budget';

budgetSuite({ labs: true });
