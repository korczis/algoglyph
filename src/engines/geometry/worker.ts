// Builds geometry runs off the main thread: a plate that loops asks for its next input here and
// keeps showing its held frame until the run arrives, encoded and transferred without a copy.
import type { Params } from '../../core/plate';
import { makeInput } from './input';
import { record, type GeometryKernel, type InputKind } from './trace';
import { encode } from './track';

export interface Job { job: number; id: string; kind: InputKind; shape: string; n: number; seed: number; params: Params; stride: number }

const kernels = import.meta.glob<GeometryKernel>('../../kernels/geometry/[!_]*.ts', { import: 'kernel', eager: true });

self.onmessage = (ev: MessageEvent<Job>) => {
  const j = ev.data;
  try {
    const kernel = kernels[`../../kernels/geometry/${j.id}.ts`];
    if (!kernel) throw new Error(`no geometry kernel ${j.id}`);
    const t = record(kernel, makeInput(j.kind, j.shape, j.n, j.seed, j.params), j.params, j.seed, true, j.stride);
    const { enc, transfer } = encode(t);
    (self as unknown as Worker).postMessage({ job: j.job, enc }, transfer);
  } catch (e) {
    (self as unknown as Worker).postMessage({ job: j.job, error: String(e) });
  }
};
