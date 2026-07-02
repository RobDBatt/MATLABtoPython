import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Coverage-audit batch: systematic 344-builtin e2e probe found 119 PASSTHROUGH
// builtins; this locks in the newly mapped ones (highest corpus frequency first).
function out(m: string): string {
  return convert(m).python
}
function flags(m: string): string {
  return convert(m).report.flags.map((f: any) => f.message).join(' | ').toLowerCase()
}

describe('registry batch: elementwise math + linalg', () => {
  it('real/imag/conj/angle → np.*', () => {
    expect(out('y = real(z);')).toContain('np.real(z)')
    expect(out('y = imag(z);')).toContain('np.imag(z)')
    expect(out('y = conj(z);')).toContain('np.conj(z)')
    expect(out('y = angle(z);')).toContain('np.angle(z)')
  })
  it('power/hypot → np.*', () => {
    expect(out('y = power(a, b);')).toContain('np.power(a, b)')
    expect(out('y = hypot(a, b);')).toContain('np.hypot(a, b)')
  })
  it('tril/triu/squeeze → np.*', () => {
    expect(out('L = tril(A);')).toContain('np.tril(A)')
    expect(out('U = triu(A);')).toContain('np.triu(A)')
    expect(out('y = squeeze(A);')).toContain('np.squeeze(A)')
  })
  it('cell2mat → np.block, str2double → float', () => {
    expect(out('M = cell2mat(c);')).toContain('np.block(c)')
    expect(out('x = str2double(s);')).toContain('float(s)')
  })
})

describe('statement forms: assert / validation / rethrow / deal / print', () => {
  it('assert(cond) → assert statement', () => {
    expect(out('assert(x > 0);')).toMatch(/^\s*assert x > 0\s*$/m)
  })
  it("assert(cond, 'msg') keeps the message", () => {
    expect(out("assert(n == 3, 'need three');")).toContain("assert n == 3, 'need three'")
  })
  it('narginchk / validateattributes → commented no-op', () => {
    expect(out('narginchk(2, 3);')).toMatch(/#.*narginchk/)
    expect(out("validateattributes(x, {'numeric'}, {'positive'});")).toMatch(/#.*validateattributes/)
  })
  it('rethrow(err) → raise', () => {
    expect(out('rethrow(ME);')).toMatch(/^\s*raise\s*$/m)
  })
  it('[a, b] = deal(1, 2) → a, b = 1, 2', () => {
    expect(out('[a, b] = deal(1, 2);')).toContain('a, b = 1, 2')
  })
  it('[a, b] = deal(0) → a = b = 0', () => {
    expect(out('[a, b] = deal(0);')).toContain('a = b = 0')
  })
  it("print('-dpng', 'out.png') → plt.savefig('out.png')", () => {
    expect(out("print('-dpng', 'out.png');")).toContain("plt.savefig('out.png')")
  })
  it('command form: print -dpng out → plt.savefig', () => {
    expect(out('print -dpng out')).toContain("plt.savefig('out')")
  })
  it('disp still maps to python print (no print-entry collision)', () => {
    expect(out("disp('hello');")).toContain("print('hello')")
  })
})

describe('bsxfun → broadcast operators', () => {
  it('@plus/@times/@rdivide → + * /', () => {
    expect(out('C = bsxfun(@plus, A, B);')).toContain('(A + B)')
    expect(out('C = bsxfun(@times, A, B);')).toContain('(A * B)')
    expect(out('C = bsxfun(@rdivide, A, B);')).toContain('(A / B)')
  })
  it('@max → np.maximum', () => {
    expect(out('C = bsxfun(@max, A, B);')).toContain('np.maximum(A, B)')
  })
  it('unknown handle falls back to a direct call', () => {
    expect(out('C = bsxfun(@myop, A, B);')).toContain('myop(A, B)')
  })
})

describe('isa → isinstance', () => {
  it("isa(x, 'double') → isinstance(x, float)", () => {
    expect(out("t = isa(x, 'double');")).toContain('isinstance(x, float)')
  })
  it("isa(f, 'function_handle') → callable(f)", () => {
    expect(out("t = isa(f, 'function_handle');")).toContain('callable(f)')
  })
  it('unknown class name stays put and flags', () => {
    const m = "t = isa(obj, 'MyClass');"
    expect(out(m)).toContain("isa(obj, 'MyClass')")
    expect(flags(m)).toMatch(/isa/)
  })
})

describe('cellfun / arrayfun simple forms', () => {
  it('cellfun(@double, c) resolves the mapped inner name, array by default', () => {
    // MATLAB default UniformOutput=true returns an array → np.array(comp)
    expect(out('y = cellfun(@double, c);')).toContain('np.array([np.float64(_x) for _x in c])')
  })
  it("cellfun('isempty', c) → len check comprehension", () => {
    expect(out("e = cellfun('isempty', c);")).toContain('np.array([len(_x) == 0 for _x in c])')
  })
  it("'UniformOutput', false returns a cell → plain list comp", () => {
    expect(out("y = arrayfun(@sqrt, x, 'UniformOutput', false);")).toContain(
      '[np.sqrt(_x) for _x in x]',
    )
    expect(out("y = arrayfun(@sqrt, x, 'UniformOutput', false);")).not.toContain('np.array([np.sqrt')
  })
})

describe('remaining customs', () => {
  it('strncmp/strncmpi → sliced comparison', () => {
    expect(out('t = strncmp(a, b, 3);')).toContain('(a[:3] == b[:3])')
    expect(out('t = strncmpi(a, b, n);')).toContain('(a[:n].lower() == b[:n].lower())')
  })
  it('circshift → np.roll with explicit axis', () => {
    expect(out('v2 = circshift(v, 2);')).toContain('np.roll(v, 2, axis=0)')
    expect(out('A2 = circshift(A, 1, 2);')).toContain('np.roll(A, 1, axis=1)')
  })
  it("ndgrid → np.meshgrid(..., indexing='ij')", () => {
    expect(out('[X, Y] = ndgrid(x, y);')).toContain("np.meshgrid(x, y, indexing='ij')")
  })
  it('saveas drops the figure handle', () => {
    expect(out("saveas(gcf, 'fig.png');")).toContain("plt.savefig('fig.png')")
  })
  it('etime(t2, t1) → (t2 - t1)', () => {
    expect(out('e = etime(t2, t1);')).toContain('(t2 - t1)')
  })
  it('line → plt.plot, fgetl → readline().rstrip', () => {
    expect(out('line(x, y);')).toContain('plt.plot(x, y)')
    expect(out('s = fgetl(fid);')).toContain("fid.readline().rstrip('\\n')")
  })
  it('ppval(pp, x) → pp(x)', () => {
    expect(out('y = ppval(pp, x);')).toContain('pp(x)')
  })
  it('flagged passthroughs stay valid + annotated (strfind, plot3, view)', () => {
    expect(flags('k = strfind(s, pat);')).toMatch(/strfind/)
    expect(flags('plot3(x, y, z);')).toMatch(/3-d axes/)
    expect(flags('view(30, 45);')).toMatch(/view_init/)
  })
})

describe('coverage tail (second sweep)', () => {
  it('strjoin(c, d) → d.join(c) (args swap)', () => {
    expect(out("s = strjoin(parts, ', ');")).toContain("', '.join(parts)")
  })
  it('permute with literal dims → np.transpose with 0-based axes', () => {
    expect(out('B = permute(A, [2 1 3]);')).toContain('np.transpose(A, (1, 0, 2))')
  })
  it('permute with non-literal dims is left alone', () => {
    expect(out('B = permute(A, order);')).toContain('permute(A, order)')
  })
  it('rmfield → filtered dict rebuild', () => {
    expect(out("t = rmfield(s, 'x');")).toContain("dict((_k, _v) for _k, _v in s.items() if _k != 'x')")
  })
  it("erase(s, m) → s.replace(m, '')", () => {
    expect(out("t = erase(s, 'ab');")).toContain("s.replace('ab', '')")
  })
  it('nthroot(x, 3) → np.power(x, 1.0 / (3))', () => {
    expect(out('y = nthroot(x, 3);')).toContain('np.power(x, 1.0 / (3))')
  })
  it('regexp(str, pat) 2-arg → re.search(pat, str) — args SWAP (was silent-wrong)', () => {
    expect(out("m = regexp(s, 'a+');")).toContain("re.search('a+', s)")
  })
  it('regexpi adds re.IGNORECASE with the same swap', () => {
    expect(out("m = regexpi(s, 'a+');")).toContain("re.search('a+', s, re.IGNORECASE)")
  })
  it('polyder/orth/uint64 registry maps', () => {
    expect(out('d = polyder(p);')).toContain('np.polyder(p)')
    expect(out('Q = orth(A);')).toContain('linalg.orth(A)')
    expect(out('n = uint64(x);')).toContain('np.uint64(x)')
  })
  it('dlmread/readmatrix → np.loadtxt', () => {
    expect(out("M = readmatrix('f.csv');")).toContain("np.loadtxt('f.csv')")
  })
  it('flag-only tail members annotate instead of silently passing (inputParser, mat2cell)', () => {
    expect(flags('p = inputParser();')).toMatch(/inputparser|keyword/i)
    expect(flags('c = mat2cell(A, r, c2);')).toMatch(/mat2cell|np\.split/i)
  })
})
