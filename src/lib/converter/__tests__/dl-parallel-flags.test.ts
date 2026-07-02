import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Tier-1 flag batch: Deep Learning + Parallel Computing calls previously
// failed as BARE NameErrors with no explanation. Every entry now carries a
// TODO/WARNING naming the concrete Python counterpart (PyTorch/Keras
// rearchitecture; multiprocessing/joblib; CuPy).
function flags(m: string): string {
  return convert(m).report.flags.map((f: any) => f.message).join(' | ')
}

describe('Deep Learning — explained, never silent', () => {
  it('trainNetwork points at the training-loop rearchitecture', () => {
    expect(flags('net = trainNetwork(X, Y, layers, opts);')).toMatch(/PyTorch|Keras/)
  })
  it('layer constructors name their torch/keras counterparts', () => {
    expect(flags('l = convolution2dLayer(3, 16);')).toMatch(/Conv2d|Conv2D/)
    expect(flags('l = fullyConnectedLayer(10);')).toMatch(/Linear|Dense/)
  })
  it('classificationLayer explains it becomes the LOSS', () => {
    expect(flags('l = classificationLayer();')).toMatch(/loss/i)
  })
  it('dlarray points at requires_grad tensors', () => {
    expect(flags('d = dlarray(X);')).toMatch(/requires_grad/)
  })
})

describe('Parallel Computing — explained, never silent', () => {
  it('parpool points at multiprocessing/joblib', () => {
    expect(flags('p = parpool(4);')).toMatch(/multiprocessing|joblib/)
  })
  it('gpuArray points at CuPy', () => {
    expect(flags('g = gpuArray(X);')).toMatch(/cupy/i)
  })
  it('gather maps to np.asarray with a CuPy note', () => {
    const r = convert('x = gather(g);')
    expect(r.python).toContain('np.asarray(g)')
    expect(r.report.flags.map((f: any) => f.message).join(' ')).toMatch(/CuPy|get\(\)/)
  })
  it('spmd opener becomes a comment + serial warning', () => {
    const r = convert('spmd\n  q = 1;\nend')
    expect(r.python).toMatch(/#.*spmd.*serial/i)
    expect(r.python).not.toMatch(/^spmd$/m)
    expect(r.report.flags.map((f: any) => f.message).join(' ')).toMatch(/serial/i)
  })
  it('labindex/numlabs are 1 under serial execution', () => {
    const r = convert('w = labindex;\nn = numlabs;')
    expect(r.python).toContain('w = 1')
    expect(r.python).toContain('n = 1')
  })
})
