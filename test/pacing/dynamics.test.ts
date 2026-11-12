// The pacing of the dynamics wing, every default run driven to its end, in a process of its own
// (test/support/pacing.ts, config/pacing.yaml).
import { pacingSuite } from '../support/pacing';

pacingSuite({ wing: 'dynamics' });
