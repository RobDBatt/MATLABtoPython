import type { ConstantMapping } from '../types'

export const CONSTANT_MAP: Record<string, ConstantMapping> = {
  pi:      { python: 'np.pi', imports: ['numpy'] },
  NaN:     { python: 'np.nan', imports: ['numpy'] },
  nan:     { python: 'np.nan', imports: ['numpy'] },
  Inf:     { python: 'np.inf', imports: ['numpy'] },
  inf:     { python: 'np.inf', imports: ['numpy'] },
  true:    { python: 'True', imports: [] },
  false:   { python: 'False', imports: [] },
  eps:     { python: 'np.finfo(float).eps', imports: ['numpy'] },
  realmax: { python: 'np.finfo(float).max', imports: ['numpy'] },
  realmin: { python: 'np.finfo(float).tiny', imports: ['numpy'] },
  i: {
    python: '1j',
    imports: [],
    flag: { type: 'WARNING', message: "'i' used as imaginary unit — could be a variable name in context" },
  },
  j: {
    python: '1j',
    imports: [],
    flag: { type: 'WARNING', message: "'j' used as imaginary unit — could be a variable name in context" },
  },
  // Parallel Computing worker identity — exactly 1 under the serial
  // execution the converter emits (spmd/parfor degrade to serial).
  labindex: {
    python: '1',
    imports: [],
    flag: { type: 'WARNING', message: 'labindex → 1 (execution is serial in the converted Python).' },
  },
  numlabs: {
    python: '1',
    imports: [],
    flag: { type: 'WARNING', message: 'numlabs → 1 (execution is serial in the converted Python).' },
  },
}
