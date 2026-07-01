import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Fixes for the top failure buckets from the 2,824-file live batch (matGeom /
// OptimTraj / YALMIP). Each case is a minimal repro of a confirmed defect.
function out(m: string): string {
  return convert(m).python
}

describe('bracket range-vector: [a:b c] concat (the circular-shift idiom)', () => {
  it('value context: [2:N 1] → np.r_[2:N + 1, 1]', () => {
    expect(out('iNext = [2:N 1];')).toContain('np.r_[2:N + 1, 1]')
  })

  it('single-arg index with end: below([2:end 1]) → np.r_[1:len(below), 0]', () => {
    expect(out('q = below([2:end 1]);')).toContain('below[np.r_[1:len(below), 0]]')
  })

  it('dim-1 index with trailing ": ": circle([1:end 1], :)', () => {
    expect(out('c2 = circle([1:end 1], :);')).toContain('circle[np.r_[0:len(circle), 0], :]')
  })

  it('dim-2 index: plane(:, [1:3 4:6]) → plane[:, np.r_[0:3, 3:6]]', () => {
    expect(out('x = plane(:, [1:3 4:6]);')).toContain('plane[:, np.r_[0:3, 3:6]]')
  })

  it('plain literal [1 2 3] still converts to np.array (no r_ regression)', () => {
    expect(out('v = [1 2 3];')).toContain('np.array([1, 2, 3])')
  })
})

describe('inline-if body gets full literal treatment', () => {
  it('if NP == 1, center = repmat(center, [N 1]); end → np.tile(center, [N, 1])', () => {
    const o = out('if NP == 1, center = repmat(center, [N 1]); end')
    expect(o).toContain('np.tile(center, [N, 1])')
  })
})

describe('chained indexing: S{i}(a:b) → S[i - 1][a-1:b]', () => {
  it('cell then range subscript', () => {
    expect(out('y = S{i}(1:2+LoN);')).toContain('S[i - 1][0:2+LoN]')
  })
})

describe('nested-paren index: pts(isfinite(pts(:,1)), :)', () => {
  it('inner subscript converts with correct pairing and 0-based column', () => {
    const o = out('pts = pts(isfinite(pts(:,1)), :);')
    expect(o).toContain('pts[np.isfinite(pts[:, 0]), :]')
  })
})

describe('comment ending in ... must NOT swallow the next line', () => {
  it('switch after a trailing-dots comment converts intact', () => {
    const m = '% Check, not exhaustive...\nswitch flag\n  case 0\n    p = 0;\n  otherwise\n    p = 1;\nend'
    const o = out(m)
    expect(o).toContain('if flag == 0:')
    expect(o).toContain('else:')
    expect(o).not.toContain('elif _switch_var')
    expect(o).toMatch(/# Check, not exhaustive/)
  })

  it('code continuation ... still joins', () => {
    expect(out('x = 1 + ...\n    2;')).toContain('x = 1 + 2')
  })
})
