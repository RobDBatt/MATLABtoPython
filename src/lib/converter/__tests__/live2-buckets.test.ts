import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Fixes for the failure buckets from the 677-file live2 batch (voicebox /
// gramm / MATLABRobotics). Each case is a minimal repro of a confirmed defect.
function out(m: string): string {
  return convert(m).python
}

describe('B1: no-comma inline if/while body', () => {
  it("if isempty(mode) mode='c'; end — space-separated body splits", () => {
    const o = out("if isempty(mode) mode='c'; end")
    expect(o).toMatch(/if len\(mode\) == 0:\s*\n\s+mode\s*=\s*'c'/)
  })
  it('if (cond) continue; end — keyword body splits', () => {
    const o = out('if (indx<=0||indx>p.XYMAX) continue; end')
    expect(o).toMatch(/:\s*\n\s+continue/)
  })
  it('while form splits too', () => {
    const o = out('while x < n x=x+1; end')
    expect(o).toMatch(/while x < n:\s*\n\s+x\s*=\s*x\+1/)
  })
  it('normal multi-line if unchanged', () => {
    const o = out('if x == 2\n  y = 3;\nend')
    expect(o).toContain('if x == 2:')
    expect(o).toMatch(/\n\s+y = 3/)
  })
  it('condition ending in a call + operator does not split falsely', () => {
    expect(out('if x < max(a) * 2\n  y = 1;\nend')).toContain('if x < np.max(a) * 2:')
  })
})

describe('B2: method-call args are not multi-dim indexing', () => {
  it('OOP chain with lambda arg keeps call parens, no string shifting', () => {
    const o = out("g(1,3).stat_fit('fun',@(a,b,c,x)a/(x+b)+c,'intopt','functional');")
    expect(o).not.toContain("'fun' - 1")
    expect(o).not.toContain('lambda a - 1')
    expect(o).toContain("stat_fit(")
  })
})

describe('B3: command-form axis with quoted arg + no double plt. prefix', () => {
  it("axis 'xy'; → plt.gca()/plt.axis without doubled quotes or plt.plt.", () => {
    const o = out("axis 'xy';")
    expect(o).not.toContain('plt.plt.')
    expect(o).not.toContain("''")
  })
  it('function-form axis stays single-prefixed', () => {
    const o = out("axis('equal');")
    expect(o).toContain("plt.axis('equal')")
    expect(o).not.toContain('plt.plt.')
  })
})

describe('B4: rewrites must not fire inside string literals', () => {
  it("legend('f(x)', ...) keeps the label strings intact", () => {
    const o = out("legend('f(x)','g(x)','location','northeast');")
    expect(o).toContain("'f(x)'")
    expect(o).toContain("'g(x)'")
    expect(o).not.toContain('f(x]')
  })
  it('registry rename does not rewrite words inside strings', () => {
    const o = out("disp('Custom colormap(without) specified');")
    expect(o).toContain('colormap(without)')
    expect(o).not.toContain('set_cmap(without)')
  })
})

describe('B5: name-value pairs with expression / bracket values', () => {
  it("'Color',[0.2 0.2 0.8] after a kwarg becomes color=[...]", () => {
    const o = out("plot(x,y,'LineWidth',2,'Color',[0.2 0.2 0.8]);")
    expect(o).toContain('linewidth=2')
    expect(o).toMatch(/color=\[0\.2, 0\.2, 0\.8\]/)
  })
  it("'Color',c.edge expression value becomes a kwarg", () => {
    const o = out("plot(x,y,'LineWidth',2,'Color',c.edge);")
    expect(o).toContain('color=c.edge')
  })
})

describe('B6: templates parenthesize compound first args', () => {
  it('full(x~=0) → (x != 0).toarray()', () => {
    expect(out('m = full(x~=0);')).toMatch(/\(x\s*!=\s*0\)\.toarray\(\)/)
  })
  it('reshape on an expression parenthesizes', () => {
    const o = out('e = reshape((s-r).^2, kf, nf);')
    expect(o).toContain("((s-r)**2).reshape(kf, nf, order='F')")
  })
})

describe('B7: assigned variables shadow plotting builtins', () => {
  it('multi-return assigned xline is not mapped to plt.axvline', () => {
    const m = '[xline, top] = stacker(obj);\nxpatch = [xline(1:end-1); xline(2:end)];'
    const o = out(m)
    expect(o).not.toContain('axvline')
  })
  it('plain-assigned xline also shadows', () => {
    const o = out("xline = x(:)';\nw = xline(2:end);")
    expect(o).not.toContain('axvline')
  })
})

describe('B8: tail fixes', () => {
  it('|| without spaces converts to spaced or', () => {
    const o = out('if (indx<=0||indx>p.XYMAX) continue; end')
    expect(o).toContain('indx<=0 or indx>')
    expect(o).not.toMatch(/\dor\w/)
  })
  it('hold all behaves like hold on', () => {
    const o = out('hold all')
    expect(o).not.toMatch(/^hold all$/m)
    expect(o).toMatch(/#.*hold/)
  })
  it('opengl command is commented out', () => {
    expect(out('opengl software')).toMatch(/#.*opengl software/)
  })
  it('MATLAB import statement is commented out', () => {
    expect(out('import matlab.buildtool.tasks*')).toMatch(/#.*import matlab\.buildtool/)
  })
  it('python-keyword lambda params get renamed', () => {
    const o = out('f = @(in, sz) in*2 + sz;')
    expect(o).not.toMatch(/lambda in,/)
    expect(o).toMatch(/lambda in_, sz: in_\*2 \+ sz/)
  })
  it('semicolons inside cell braces are row separators, not statement splits', () => {
    const o = out("pv={'FontName' 'Arial'; 'FontSize' 16};")
    expect(o).toContain("[['FontName', 'Arial'], ['FontSize', 16]]")
  })
})
