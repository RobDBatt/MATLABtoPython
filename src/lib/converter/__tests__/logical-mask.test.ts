import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { convert } from '../index'
import { parenthesizeBitwiseComparisons } from '../stages/logical-ops'

// Logical masks (Oct 2026). Before this, every common mask idiom converted to
// Python that crashed or returned the wrong elements:
//   mask = v > 2; v(mask)   → v[mask - 1]          (True/False → 0/-1)
//   keep = ~isnan(v)        → keep = (not ...)     (raises on arrays)
//   v(v > 0 & v < 6)        → v[v > 0 & v < 6]     (Python: v > (0 & v) < 6)
//   A(v > 2, 3)             → A[v > 2, 3]          (column dim never shifted)
function py(matlab: string): string {
  return convert(matlab).python
    .split('\n')
    .filter((l) => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n')
    .trim()
}

describe('mask variables are not index-shifted', () => {
  it('a mask from a comparison selects as-is', () => {
    const out = py('v = rand(1, 9);\nmu = mean(v); sd = std(v);\nmask = abs(v - mu) < 3*sd;\nt = v(mask);')
    expect(out).toContain('t = v[mask]')
    expect(out).not.toContain('mask - 1')
  })

  it('isnan / any(..., 2) / true(...) produce masks', () => {
    const out = py('A = rand(4, 3);\nbad = isnan(A(:, 1));\nrows = any(isnan(A), 2);\nsel = true(4, 1);\nsel(2) = false;\nB = A(rows, 2);\nC = A(sel, :);\nx = A(bad, 1);')
    expect(out).toContain('B = A[rows, 1]')
    expect(out).toContain('C = A[sel, :]')
    expect(out).toContain('x = A[bad, 0]')
    expect(out).toContain('sel[1] = False') // an element write on a mask still shifts
  })

  it('assignment through a mask', () => {
    expect(py('v = rand(1, 5);\nbad = isnan(v);\nv(bad) = 0;')).toContain('v[bad] = 0')
  })

  it('a combined mask expression is not shifted', () => {
    expect(py('v = rand(1, 5);\nm1 = v > 0.8;\nm2 = v < 0.2;\nw = v(m1 | m2);')).toContain('w = v[m1 | m2]')
  })

  it('[tf, loc] = ismember(...) makes tf a mask', () => {
    expect(py('a = [1 2 3];\nb = [2 3];\n[tf, loc] = ismember(a, b);\nc = a(tf);')).toContain('c = a[tf]')
  })

  it('a name that is a mask in one place and numeric in another keeps the shift', () => {
    const out = py('v = rand(1, 5);\nidx = v > 0.5;\nidx = 3;\nx = v(idx);')
    expect(out).toContain('x = v[idx - 1]')
  })

  it('a for-loop counter is never a mask', () => {
    const out = py('v = rand(1, 5);\nj = v > 0.5;\nfor j = 1:3\n  y = v(j);\nend')
    expect(out).toContain('y = v[j - 1]')
  })

  it('counts and values derived from a comparison are not masks', () => {
    const out = py('v = rand(1, 5);\nn = sum(v > 0.5);\nw = v(v > 0.5);\nk = 2;\ny = w(k);')
    expect(out).toContain('y = w[k - 1]')
  })
})

describe('other dims next to a mask are still 1-based', () => {
  it('A(v > 2, 3) shifts the column', () => {
    expect(py('v = rand(1, 4);\nA = rand(4, 3);\nC = A(v > 0.2, 3);')).toContain('C = A[v > 0.2, 2]')
  })

  it('a range next to a mask is sliceified', () => {
    expect(py('v = rand(1, 4);\nA = rand(4, 3);\nD = A(v > 0.2, 2:3);')).toContain('D = A[v > 0.2, 1:3]')
  })

  it('a single column inside a mask is 1-D', () => {
    const out = py('A = rand(4, 3);\nB = A(A(:,1) > 0.5, :);')
    expect(out).toContain('B = A[A[:, 0] > 0.5, :]')
  })
})

describe('~ on arrays', () => {
  it('~isnan(v) stays elementwise', () => {
    expect(py('v = rand(1, 5);\nkeep = ~isnan(v);')).toContain('keep = ~np.isnan(v)')
  })

  it('~mask inside a subscript', () => {
    expect(py('A = rand(4, 3);\nrows = any(isnan(A), 2);\nB = A(~rows, :);')).toContain('B = A[~rows, :]')
  })

  it('~mask on its own uses np.logical_not (safe for plain bools too)', () => {
    expect(py('v = rand(1, 5);\nkeep = ~isnan(v);\nflag = ~keep;')).toContain('flag = np.logical_not(keep)')
  })

  it('a top-level if ~x is still a scalar test', () => {
    const out = py('x = [];\nif ~isempty(x)\n  disp(1);\nend')
    expect(out).toContain('if not len(x) == 0:')
  })

  it('functions that map to plain Python bools keep not', () => {
    expect(py("s = 'a b';\nb = ~isspace(s);")).toContain('not s.isspace()')
  })
})

describe('& / | keep MATLAB precedence', () => {
  it('comparisons joined by & are parenthesized', () => {
    expect(py('v = rand(1, 5);\nm = v > 0.2 & v < 0.8;')).toContain('m = (v > 0.2) & (v < 0.8)')
  })

  it('inside a subscript', () => {
    expect(py('v = rand(1, 5);\nx = v(v > 0.2 & v < 0.8);')).toContain('x = v[(v > 0.2) & (v < 0.8)]')
  })

  it('leaves && / || (and / or) alone', () => {
    expect(py('a = 1; b = 2;\nif a > 0 && b < 3\n  disp(1);\nend')).toContain('if a > 0 and b < 3:')
  })

  it('unit: segments, strings and comments', () => {
    expect(parenthesizeBitwiseComparisons('m = a > 0 | b == 1  # x > 0 | y'))
      .toBe('m = (a > 0) | (b == 1)  # x > 0 | y')
    expect(parenthesizeBitwiseComparisons("s = 'a > 0 & b'")).toBe("s = 'a > 0 & b'")
    expect(parenthesizeBitwiseComparisons('f(x, k=a < 1 & b)')).toBe('f(x, k=(a < 1) & b)')
    expect(parenthesizeBitwiseComparisons('flags |= a > 0')).toBe('flags |= a > 0')
  })
})

describe('calls with comparison-looking string args stay calls', () => {
  it("warning('... not ...') is not turned into indexing", () => {
    expect(py("warning('the method did not converge');")).not.toContain('warn[')
  })

  it('a regex string is not rewritten', () => {
    const out = py("s = regexprep(s, '(\\\\)o(?!mega|times)', '$1o{}');")
    expect(out).toContain("o(?!mega|times)")
  })

  it('an unknown method with | stays a call', () => {
    expect(py('tc.verifyTrue(L1 | L2);')).toContain('tc.verifyTrue(L1 | L2)')
  })
})

describe('true / false shapes', () => {
  it('true(3,1) is a vector, true(3) is 3×3', () => {
    expect(py('a = true(3,1);')).toContain('np.ones(3, dtype=bool)')
    expect(py('c = true(3);')).toContain('np.ones((3, 3), dtype=bool)')
  })
})

// Execute the converted Python and compare against MATLAB's results.
function findPython(): string | null {
  for (const exe of ['python3', 'python']) {
    const r = spawnSync(exe, ['-c', 'import numpy'], { encoding: 'utf8' })
    if (r.status === 0) return exe
  }
  return null
}
const PY = findPython()

describe.skipIf(!PY)('mask idioms give MATLAB results when run', () => {
  it('matches values computed from MATLAB semantics', () => {
    const matlab = [
      'v = [1 -2 3 NaN 5 -6 7 8];',
      'A = [1 2 3; 4 NaN 6; 7 8 9; 10 11 12];',
      'mask = v > 2;',
      'r1 = v(mask);',
      'r2 = v(v > 0 & v < 6);',
      'keep = ~isnan(v);',
      'r3 = v(keep);',
      'r4 = v(~isnan(v) & v > 0);',
      'rows = any(isnan(A), 2);',
      'r5 = A(~rows, :);',
      'r6 = A(~rows, 2);',
      'r7 = A(A(:,1) > 3, 3);',
      'sel = true(1, 8);',
      'sel(2) = false;',
      'r8 = v(sel);',
      'r9 = v(v > 4 | v < -1);',
      'flag = ~keep;',
      'r10 = sum(flag);',
      'r11 = A(1, A(2,:) > 5 | A(1,:) < 2);',
    ].join('\n')
    const expected = {
      r1: [3, 5, 7, 8],
      r2: [1, 3, 5],
      r3: [1, -2, 3, 5, -6, 7, 8],
      r4: [1, 3, 5, 7, 8],
      r5: [[1, 2, 3], [7, 8, 9], [10, 11, 12]],
      r6: [2, 8, 11],
      r7: [6, 9, 12],
      r8: [1, 3, null, 5, -6, 7, 8],
      r9: [-2, 5, -6, 7, 8],
      r10: 1,
      r11: [1, 3],
    }
    const probe = `
import json as _j, numpy as _np
print(_j.dumps({k: _np.where(_np.isnan(_np.asarray(v, dtype=float)), None, _np.asarray(v, dtype=float)).tolist()
                for k, v in list(globals().items()) if k.startswith('r') and k[1:].isdigit()}))
`
    const dir = mkdtempSync(join(tmpdir(), 'mask-'))
    const file = join(dir, 'mask.py')
    writeFileSync(file, convert(matlab).python + probe)
    const run = spawnSync(PY!, [file], { encoding: 'utf8', timeout: 60000 })
    expect(run.stderr).toBe('')
    expect(JSON.parse(run.stdout.trim().split('\n').pop()!)).toEqual(expected)
  })
})
