// The engine contract (ADR 0004 §4). An engine owns one family's input, drawing and
// measurement; a kernel is one algorithm of that family, written once, with no drawing in it.
// The engine turns a kernel into a plate, and several kernels into a lab.
import type { PlateCode } from '../core/plate';

export interface KernelInfo {
  id: string;
  title: string;
  /** The taxonomy shelf title, used to group kernels in a lab. */
  group: string;
}

export interface Engine<K = unknown> {
  id: string;
  /** The plate that runs one kernel. */
  plate(info: KernelInfo, kernel: K): PlateCode;
  /** The lab plate that runs several kernels side by side on one input. */
  lab(id: string, kernels: { info: KernelInfo; kernel: K }[]): PlateCode;
}
