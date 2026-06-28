import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Priority-queue ranks 2 (name-value pairs), 3 (function arg-reorder), and
// 4 (command syntax). Each had a confirmed defect on master; these lock the fix.
function out(m: string): string {
  return convert(m).python
}
function flags(m: string): string {
  return convert(m).report.flags.map((f: any) => f.message).join(' | ').toLowerCase()
}

describe('Rank 3 — function arg-reorder (silent-wrong → correct)', () => {
  it('interp1(x,y,xi) → np.interp(xi, x, y) (query points first)', () => {
    expect(out('yi = interp1(x, y, xi);')).toContain('np.interp(xi, x, y)')
  })

  it('interp1 with a non-linear method arg is flagged', () => {
    expect(flags("yi = interp1(x, y, xi, 'spline');")).toMatch(/linear|spline|scipy/)
  })

  it('regexprep(s, pat, rep) → re.sub(pat, rep, s) with raw-string pattern', () => {
    const bs = String.fromCharCode(92)
    const o = out(`s = regexprep(str, '${bs}s+', '_');`)
    expect(o).toContain(`re.sub(r'${bs}s+', '_', str)`)
  })

  it('regexprep ignorecase option → flags=re.IGNORECASE', () => {
    expect(out("s = regexprep(a, 'x', 'y', 'ignorecase');")).toContain('flags=re.IGNORECASE')
  })
})

describe('Rank 4 — command syntax (invalid Python → valid)', () => {
  it('box on → plt.box(True)', () => {
    expect(out('box on')).toContain('plt.box(True)')
  })
  it('box off → plt.box(False)', () => {
    expect(out('box off')).toContain('plt.box(False)')
  })
  it('shading flat → commented (no standalone equivalent), not raw', () => {
    const o = out('shading flat')
    expect(o).not.toMatch(/^shading flat$/m)
    expect(o).toMatch(/#.*shading flat/)
  })
  it('still handles the already-working axis ij', () => {
    expect(out('axis ij')).toContain('invert_yaxis')
  })
})

describe('Rank 2 — name-value pairs (positional-after-keyword → valid)', () => {
  it('known + unknown prop mix: unknown pair becomes a kwarg, not positional', () => {
    // 'FontSize' is known → fontsize=12; 'FontUnits' is unknown and FOLLOWS it,
    // so leaving it positional is a SyntaxError. It must become a kwarg too.
    const o = out("text(0, 0, 'hi', 'FontSize', 12, 'FontUnits', 'points')")
    expect(o).toContain('fontsize=12')
    expect(o).toContain('fontunits=')
    // no bare positional string-pair left dangling after a kwarg
    expect(o).not.toMatch(/=\s*\d+\s*,\s*'FontUnits'/)
  })

  it('pure-positional unknown call is left alone (no forced kwargs → no TypeError)', () => {
    // No known prop present → we do NOT invent kwargs out of data strings.
    const o = out("plot(x, y, 'r')")
    expect(o).toContain("plt.plot(x, y, 'r')")
    expect(o).not.toContain("r=")
  })

  it("set(h, 'FontSize', 12, 'Color', 'red') → plt.setp(h, fontsize=12, color='red')", () => {
    const o = out("set(h, 'FontSize', 12, 'Color', 'red')")
    expect(o).toContain('plt.setp(h,')
    expect(o).toContain('fontsize=12')
    expect(o).toContain("color='red'")
  })
})
