// U-signal: fft-butterfly runs exactly as before on every seeded input (test/u-signal/same-runs.ts).
import { kernel as now } from '../../src/kernels/signal/fft-butterfly';
import { kernel as before } from '../fixtures/u-signal-before/src/kernels/signal/fft-butterfly';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('fft-butterfly', now, before);
