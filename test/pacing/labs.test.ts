// The pacing of every runnable lab, every default run driven to its end, in a process of its own
// (test/support/pacing.ts, config/pacing.yaml).
import { pacingSuite } from '../support/pacing';

pacingSuite({ labs: true });
