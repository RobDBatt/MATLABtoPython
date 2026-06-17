import { describe, it, expect } from 'vitest'
import { convert } from '../index'

/** Helper: convert and return trimmed Python (without import block) */
function py(matlab: string): string {
  const result = convert(matlab)
  // Strip import lines and leading blank lines for easier assertion
  return result.python
    .split('\n')
    .filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n')
    .trim()
}

/** Helper: convert and return imports list */
function imports(matlab: string): string[] {
  return convert(matlab).report.imports
}

/** Helper: convert and return flag types */
function flagTypes(matlab: string): string[] {
  return convert(matlab).report.flags.map(f => f.type)
}

// ============================================================
// CORE SYNTAX
// ============================================================

describe('Core Syntax', () => {
  it('converts simple assignment', () => {
    expect(py('x = 5;')).toBe('x = 5')
  })

  it('converts multiple assignments on one line', () => {
    const result = py('a = 1; b = 2; c = 3;')
    expect(result).toContain('a = 1')
    expect(result).toContain('b = 2')
    expect(result).toContain('c = 3')
  })

  it('converts comments', () => {
    expect(py('% this is a comment')).toBe('# this is a comment')
  })

  it('converts section comments', () => {
    expect(py('%% Section Title')).toBe('#% Section Title')
  })

  it('handles continuation lines', () => {
    expect(py('x = 1 + ...\n    2;')).toBe('x = 1 + 2')
  })
})

// ============================================================
// CONTROL FLOW
// ============================================================

describe('Control Flow', () => {
  it('converts for loop with 1:n', () => {
    // Loop var stays 1-based so stage 4's `i → i-1` index shift produces
    // correct 0-based subscripts. Emitting `range(10)` would make `i`
    // 0-based and cause double-offset bugs at every indexer.
    expect(py('for i = 1:10')).toContain('for i in range(1, 10 + 1):')
  })

  it('converts for loop with start:end', () => {
    expect(py('for i = 5:20')).toContain('for i in range(5, 20 + 1):')
  })

  it('converts while loop', () => {
    expect(py('while x > 0')).toContain('while x > 0:')
  })

  it('converts if/elseif/else', () => {
    expect(py('if x > 0')).toContain('if x > 0:')
    expect(py('elseif x < 0')).toContain('elif x < 0:')
    expect(py('else')).toContain('else:')
  })

  it('converts try/catch', () => {
    expect(py('try')).toContain('try:')
    expect(py('catch ME')).toContain('except Exception as ME:')
  })

  it('bare try/end (no catch) gets a synthesized except — not a SyntaxError', () => {
    // MATLAB allows try/end with no catch (it swallows errors). Without an
    // injected handler the output is `try:` with no `except` → SyntaxError.
    expect(py('try\n  x = risky();\nend\ny = 2;'))
      .toBe('try:\n    x = risky()\nexcept Exception:\n    pass\ny = 2')
  })

  it('bare try nested in a for indents the synthesized except correctly', () => {
    const out = py('for i = 1:3\n  try\n    z = f(i);\n  end\nend')
    expect(out).toContain('    try:')
    expect(out).toContain('    except Exception:\n        pass')
  })

  it('does not add a second except when a catch is present', () => {
    const out = py('try\n  x = risky();\ncatch ME\n  x = 0;\nend')
    expect(out).toContain('except Exception as ME:')
    // exactly one except
    expect(out.match(/except/g)?.length).toBe(1)
  })

  it('converts function definition', () => {
    expect(py('function y = square(x)')).toContain('def square(x):')
  })

  it('converts function with multiple returns', () => {
    expect(py('function [a, b] = split(x)')).toContain('def split(x):')
  })

  it('converts parfor with warning', () => {
    const result = py('parfor i = 1:10')
    expect(result).toContain('for i in range(1, 10 + 1):')
    expect(result).toContain('WARNING')
  })

  it('removes end lines', () => {
    const result = convert('if x > 0\n  y = 1;\nend')
    expect(result.python).not.toMatch(/\bend\b/)
  })
})

// ============================================================
// OPERATORS
// ============================================================

describe('Operators', () => {
  it('converts element-wise multiply', () => {
    expect(py('z = x .* y;')).toBe('z = x * y')
  })

  it('converts element-wise power', () => {
    expect(py('z = x .^ 2;')).toBe('z = x ** 2')
  })

  it('converts not-equal', () => {
    expect(py('if x ~= 0')).toContain('x != 0')
  })

  it('converts short-circuit AND', () => {
    expect(py('if a && b')).toContain('a and b')
  })

  it('converts short-circuit OR', () => {
    expect(py('if a || b')).toContain('a or b')
  })

  it('keeps / as division', () => {
    expect(py('y = x / 2;')).toBe('y = x / 2')
  })
})

// ============================================================
// FUNCTIONS
// ============================================================

describe('Function Mapping', () => {
  it('converts zeros with tuple wrapping', () => {
    expect(py('A = zeros(3, 4);')).toBe('A = np.zeros((3, 4))')
  })

  it('converts ones with tuple wrapping', () => {
    expect(py('A = ones(2, 3);')).toBe('A = np.ones((2, 3))')
  })

  it('emits 1-D for row-vector zeros(1, n) so single-subscript access works', () => {
    // Regression (2026-06): `zeros(1, n)` → `np.zeros((1, n))` (2-D, axis 0
    // size 1), but `z(i)` → `z[i - 1]` indexes axis 0 → IndexError. Drop the
    // literal leading 1 → 1-D `np.zeros(n)`.
    expect(py('z = zeros(1, n);')).toBe('z = np.zeros(n)')
  })

  it('emits 1-D for column-vector zeros(n, 1)', () => {
    expect(py('z = zeros(n, 1);')).toBe('z = np.zeros(n)')
  })

  it('emits 1-D for randn/rand row/col vectors (separate dim args, no tuple)', () => {
    expect(py('r = randn(1, n);')).toBe('r = np.random.randn(n)')
    expect(py('r = rand(n, 1);')).toBe('r = np.random.rand(n)')
  })

  it('keeps 2-D for genuine matrices (no literal-1 de-2-D)', () => {
    // No literal 1 in a 2-arg dim list → unchanged 2-D shape.
    expect(py('A = zeros(3, 4);')).toBe('A = np.zeros((3, 4))')
  })

  it('repmat → np.tile with array and reps as separate args', () => {
    // Regression (2026-06): repmat shared the `reshape` arg-mode, which tupled
    // ALL args together (`np.tile((A, 2, 3))`), leaving np.tile one positional
    // arg → "missing 'reps'" at runtime. The array and reps must be separate.
    expect(py('B = repmat(A, 2, 3);')).toBe('B = np.tile(A, (2, 3))')
    // Single scalar n means n×n in MATLAB; np.tile(A, n) would only tile the
    // last axis, so it must expand to (n, n).
    expect(py('B = repmat(A, 2);')).toBe('B = np.tile(A, (2, 2))')
    // Size-vector form passes the bracket through (numpy accepts array-like reps).
    expect(py('B = repmat(A, [2, 3]);')).toBe('B = np.tile(A, [2, 3])')
    // Non-array first arg and a nested-call first arg both stay intact.
    expect(py('B = repmat(5, 1, n);')).toBe('B = np.tile(5, (1, n))')
    expect(py('C = repmat(f(x), 2, 3);')).toBe('C = np.tile(f(x), (2, 3))')
  })

  it('converts disp to print', () => {
    expect(py("disp('hello');")).toBe("print('hello')")
  })

  it('converts length to max shape', () => {
    expect(py('n = length(x);')).toBe('n = np.max(x.shape)')
  })

  it('converts size with dimension', () => {
    expect(py('n = size(A, 1);')).toBe('n = A.shape[0]')
  })

  it('converts size without dimension', () => {
    expect(py('s = size(A);')).toBe('s = A.shape')
  })

  it('converts numel', () => {
    expect(py('n = numel(A);')).toBe('n = len(A)')
  })

  it('converts eye', () => {
    expect(py('I = eye(3);')).toBe('I = np.eye(3)')
  })

  it('converts linspace', () => {
    expect(py('t = linspace(0, 1, 100);')).toBe('t = np.linspace(0, 1, 100)')
  })

  it('converts trig functions', () => {
    expect(py('y = sin(x);')).toBe('y = np.sin(x)')
    expect(py('y = cos(x);')).toBe('y = np.cos(x)')
  })

  it('converts linalg functions', () => {
    expect(py('d = det(A);')).toBe('d = np.linalg.det(A)')
    expect(py('B = inv(A);')).toBe('B = np.linalg.inv(A)')
  })

  it('converts fft', () => {
    expect(py('Y = fft(x);')).toBe('Y = np.fft.fft(x)')
  })

  it('detects numpy import', () => {
    expect(imports('x = zeros(3);')).toContain('numpy')
  })
})

// ============================================================
// STRUCT FIELD MEMBERSHIP (isfield)
// ============================================================

describe('isfield → dict membership', () => {
  // MATLAB structs convert to dicts, so isfield(s, f) is `f in s` (reversed
  // args). Emitted unparenthesized — correct in boolean/assignment/logical
  // contexts. (2026-06)
  it('rewrites isfield(s, field) to `field in s`', () => {
    expect(py("if isfield(s, 'name')")).toContain("if 'name' in s:")
    expect(py("tf = isfield(s, 'name');")).toBe("tf = 'name' in s")
  })

  it('handles a variable field name', () => {
    expect(py('tf = isfield(s, fname);')).toBe('tf = fname in s')
  })

  it('negated form becomes `not field in s` (in binds tighter than not)', () => {
    // `if ~isfield(...)` stays clean; the assignment RHS form picks up the
    // existing defensive parens from the ~→not pass (still valid Python).
    expect(py("if ~isfield(s, 'tol')")).toContain("if not 'tol' in s:")
    expect(py("tf = ~isfield(s, 'tol');")).toBe("tf = (not 'tol' in s)")
  })

  it('composes in a logical expression', () => {
    expect(py("ok = isfield(s, 'a') && isfield(s, 'b');"))
      .toBe("ok = 'a' in s and 'b' in s")
  })

  it('leaves the multi-field cell form unconverted and flags it', () => {
    // isfield(s, {'a','b'}) returns a logical array — no clean one-liner.
    const r = convert("tf = isfield(s, {'a','b'});")
    expect(r.python).toContain('isfield(s,')
    expect(r.report.flags.map(f => f.type)).toContain('TODO')
  })
})

// ============================================================
// TOOLBOX FUNCTIONS
// ============================================================

describe('Toolbox Mapping', () => {
  it('converts butter to signal.butter', () => {
    expect(py("b = butter(4, 0.5);")).toContain('signal.butter(4, 0.5)')
  })

  it('converts filter to signal.lfilter', () => {
    expect(py('y = filter(b, a, x);')).toContain('signal.lfilter(b, a, x)')
  })

  it('detects scipy.signal import', () => {
    expect(imports('y = butter(4, 0.5);')).toContain('scipy.signal')
  })

  it('flags toolbox functions', () => {
    expect(flagTypes('y = butter(4, 0.5);')).toContain('TOOLBOX')
  })

  it('converts imread to skimage', () => {
    expect(py("I = imread('test.png');")).toContain("io.imread('test.png')")
  })

  // findpeaks return-shape: MATLAB returns peak VALUES; scipy's find_peaks
  // returns (indices, properties). Single-output recovers values by indexing
  // the signal with the returned indices. (2026-06)
  it('findpeaks (single output) → peak values via find_peaks indices', () => {
    expect(py('pks = findpeaks(P);')).toBe('pks = P[signal.find_peaks(P)[0]]')
    expect(imports('pks = findpeaks(P);')).toContain('scipy.signal')
  })

  it('findpeaks rewrites inside a larger expression too', () => {
    expect(py('m = max(findpeaks(x));')).toBe('m = np.max(x[signal.find_peaks(x)[0]])')
  })

  it('findpeaks two-output → values + locations (two statements)', () => {
    // [pks, locs] = findpeaks(P): pks = values, locs = 0-based indices.
    expect(py('[pks, locs] = findpeaks(P);'))
      .toBe('locs = signal.find_peaks(P)[0]\npks = P[locs]')
  })

  it('findpeaks two-output: locs is registered 0-based, so P(locs) → P[locs]', () => {
    // No `- 1` shift on locs (it already came back 0-based from find_peaks).
    const out = py('x = [1 2 3 2 1];\n[pks, locs] = findpeaks(x);\nvals = x(locs);')
    expect(out).toContain('locs = signal.find_peaks(x)[0]')
    expect(out).toContain('vals = x[locs]')
    expect(out).not.toContain('locs - 1')
  })

  it('findpeaks Name/Value form still defers to the name-swap (+ flag)', () => {
    // Options need height=/distance=/prominence= kwargs — not handled yet.
    expect(py("peaks = findpeaks(P, 'MinPeakHeight', 0.5);"))
      .toContain("signal.find_peaks(P, 'MinPeakHeight', 0.5)")
    expect(py("[pks, locs] = findpeaks(P, 'MinPeakHeight', 0.5);"))
      .toContain("signal.find_peaks(P, 'MinPeakHeight', 0.5)")
  })
})

// ============================================================
// CONSTANTS
// ============================================================

describe('Constants', () => {
  it('converts pi', () => {
    expect(py('x = pi;')).toBe('x = np.pi')
  })

  it('converts NaN', () => {
    expect(py('x = NaN;')).toBe('x = np.nan')
  })

  it('converts true/false', () => {
    expect(py('x = true;')).toBe('x = True')
    expect(py('x = false;')).toBe('x = False')
  })
})

// ============================================================
// SPECIAL CONSTRUCTS
// ============================================================

describe('Special Constructs', () => {
  it('converts grid on', () => {
    expect(py('grid on;')).toBe('plt.grid(True)')
  })

  it('removes hold on with comment', () => {
    const result = py('hold on;')
    expect(result).toContain('hold on removed')
  })

  it('converts close all', () => {
    expect(py('close all;')).toBe("plt.close('all')")
  })

  it('converts clearvars to comment', () => {
    expect(py('clearvars;')).toContain('not needed in Python')
  })

  it('flags eval as unsupported', () => {
    expect(flagTypes("eval('x = 1');")).toContain('UNSUPPORTED')
  })
})

// ============================================================
// PLOTTING
// ============================================================

describe('Plotting', () => {
  it('converts plot', () => {
    expect(py('plot(x, y);')).toBe('plt.plot(x, y)')
  })

  it('converts title', () => {
    expect(py("title('My Plot');")).toBe("plt.title('My Plot')")
  })

  it('converts xlabel/ylabel', () => {
    expect(py("xlabel('X');")).toBe("plt.xlabel('X')")
  })

  it('converts stem', () => {
    expect(py('stem(t, x);')).toBe('plt.stem(t, x)')
  })

  it('converts figure', () => {
    expect(py('figure')).toBe('plt.figure()')
  })

  it('detects matplotlib import', () => {
    expect(imports('plot(x, y);')).toContain('matplotlib.pyplot')
  })
})

// ============================================================
// INDEXING
// ============================================================

describe('Index Shifting', () => {
  it('converts A(end) to A[-1]', () => {
    expect(py('x = A(end);')).toContain('A[-1]')
  })

  it('converts A(:) to column-major flatten', () => {
    // MATLAB's A(:) is column-major; Python's default .flatten() is row-major.
    // The idiom rewrite emits order="F" to preserve MATLAB semantics.
    expect(py('v = A(:);')).toContain('A.flatten(order="F")')
  })

  it('converts space-separated multiple (:) flattens in one row without np.arange corruption', () => {
    // Regression (2026-06): `[a(:) b(:)]` was mangled into
    // `np.arange(a(, ) + ) b(, ) b()` because the idiom pass's 3-part
    // bracket-range rule (`[a:step:b]`) read the colons inside `(:)` as
    // range separators. Fixed by running the flatten rewrite BEFORE the
    // idiom rules so the colons are gone before the range rules run.
    const r = py('r = [a(:) b(:)];')
    expect(r).toContain('a.flatten(order="F")')
    expect(r).toContain('b.flatten(order="F")')
    expect(r).not.toContain('np.arange')
    // Three-element rotation-matrix form must survive too.
    const r3 = py('R = [n(:) o(:) a(:)];')
    expect(r3).toContain('n.flatten(order="F")')
    expect(r3).toContain('o.flatten(order="F")')
    expect(r3).toContain('a.flatten(order="F")')
    expect(r3).not.toContain('np.arange')
  })

  it('converts A(N/2:end) to A[N/2:]', () => {
    expect(py('y = A(N/2:end);')).toContain('A[N/2:]')
  })
})

// ============================================================
// MULTIPLE RETURN + ASSIGNMENT
// ============================================================

describe('Multiple Return', () => {
  it('converts bracket assignment', () => {
    expect(py('[a, b] = func(x);')).toContain('a, b = func(x)')
  })

  it('converts inline range', () => {
    const result = py('t = (0:9) * dt;')
    expect(result).toContain('np.arange(0, 9 + 1)')
  })
})

// ============================================================
// AUDIO FUNCTIONS
// ============================================================

describe('Audio Functions', () => {
  it('converts audioread', () => {
    expect(py("[y, fs] = audioread('file.wav');")).toContain("sf.read('file.wav')")
  })

  it('converts audiowrite', () => {
    expect(py("audiowrite('out.wav', y, fs);")).toContain("sf.write('out.wav', y, fs)")
  })

  it('converts hanning', () => {
    expect(py('w = hanning(N);')).toBe('w = np.hanning(N)')
  })
})

// ============================================================
// PHASE 1: QUICK WINS
// ============================================================

describe('Phase 1: Quick Wins', () => {
  it('1A: tilde discard [~, idx] = max(A) uses argmax (correct semantics)', () => {
    // np.max returns a scalar, not a tuple — `_, idx = np.max(A)` was
    // never valid. The idiom rewrite uses np.argmax directly, which is
    // what MATLAB's [~, idx] = max(A) actually computes.
    expect(py('[~, idx] = max(A);')).toContain('idx = np.argmax(A)')
  })

  it('1A: double tilde [~, ~, v] = svd(A)', () => {
    expect(py('[~, ~, v] = svd(A);')).toContain('_, _, v = np.linalg.svd(A)')
  })

  it('1B: function handle @sin → sin', () => {
    const result = py('f = @sin;')
    expect(result).toContain('f = ')
    expect(result).not.toContain('@')
  })

  it('1C: block comments %{ ... %}', () => {
    const result = py('%{\nThis is a\nblock comment\n%}')
    expect(result).toContain('# This is a')
    expect(result).toContain('# block comment')
    expect(result).not.toContain('%{')
  })

  it('1D: anonymous function @(x) x.^2', () => {
    const result = py('f = @(x) x.^2;')
    expect(result).toContain('lambda x:')
    expect(result).toContain('x**2') // after .^ → ** conversion
  })

  it('1D: anonymous function with multiple args', () => {
    const result = py('g = @(x, y) x + y;')
    expect(result).toContain('lambda x, y:')
  })

  it('1E: cell array indexing C{1}', () => {
    expect(py('x = C{1};')).toContain('C[0]')
  })

  it('1E: cell array indexing C{i}', () => {
    expect(py('x = C{i};')).toContain('C[i - 1]')
  })

  it('1E: cell array indexing C{end}', () => {
    expect(py('x = C{end};')).toContain('C[-1]')
  })

  it('1F: switch/case first case is if with variable comparison', () => {
    const result = convert('switch x\n  case 1\n    y = 1;\n  case 2\n    y = 2;\n  otherwise\n    y = 0;\nend')
    expect(result.python).toContain('if x == 1:')
    expect(result.python).toContain('elif x == 2:')
    expect(result.python).toContain('else:')
  })
})

// ============================================================
// PHASE 2: INDEXING INTELLIGENCE
// ============================================================

describe('Phase 2: Indexing Intelligence', () => {
  it('2A+2B: converts A(i) when A is known array', () => {
    const result = py('A = zeros(3, 3);\nx = A(2);')
    expect(result).toContain('A[1]')
  })

  it('2A+2B: converts A(i,j) when A is known array', () => {
    const result = py('A = ones(3, 4);\nx = A(2, 3);')
    expect(result).toContain('A[1, 2]')
  })

  it('2B: does not convert unknown function calls', () => {
    const result = py('y = myCustomFunc(x);')
    expect(result).toContain('myCustomFunc(x)')
    expect(result).not.toContain('myCustomFunc[')
  })

  it('2C: logical indexing A(A > 5)', () => {
    const result = py('B = A(A > 5);')
    expect(result).toContain('A[A > 5]')
  })

  it('2C: logical indexing with ~=', () => {
    const result = py('B = A(A ~= 0);')
    expect(result).toContain('A[A != 0]')
  })

  it('2D: multi-dim colon A(:, :, k)', () => {
    const result = py('x = A(:, :, k);')
    expect(result).toContain('A[:, :, k - 1]')
  })

  it('2D: multi-dim A(i, :)', () => {
    const result = py('x = A(i, :);')
    expect(result).toContain('A[i - 1, :]')
  })

  it('preserves plt.plot(x, y) as function call', () => {
    const result = py('plot(x, y);')
    expect(result).toContain('plt.plot(x, y)')
    expect(result).not.toContain('plt.plot[')
  })
})

// ============================================================
// PHASE 3: FORMAT STRINGS + REGISTRY + STRING CONCAT
// ============================================================

describe('Phase 3: Format Strings and Registry', () => {
  it('3A: fprintf with format specifiers', () => {
    const result = py("fprintf('x = %d, y = %.2f\\n', x, y);")
    expect(result).toContain('print(')
    expect(result).toContain('%d')
    expect(result).toContain('%.2f')
    expect(result).toContain('% (x, y)')
  })

  it('3A: sprintf returns %-formatted string', () => {
    const result = py("s = sprintf('val = %f', x);")
    expect(result).toContain("'val = %f'")
    expect(result).toContain('% (x,)')
  })

  it('3B: unique function', () => {
    expect(py('u = unique(A);')).toContain('np.unique(A)')
  })

  it('3B: exist function', () => {
    expect(py("exist('file.m');")).toContain("os.path.exists('file.m')")
  })

  it('3B: fullfile function', () => {
    expect(py("p = fullfile('a', 'b', 'c');")).toContain("os.path.join('a', 'b', 'c')")
  })

  it('3B: type conversion double', () => {
    expect(py('y = double(x);')).toContain('np.float64(x)')
  })

  it('3B: sparse matrix', () => {
    const result = py('S = sparse(A);')
    expect(result).toContain('scipy.sparse.csr_matrix(A)')
  })

  it('3C: string concat in brackets', () => {
    const result = py("s = ['hello' ' world'];")
    expect(result).toContain("'hello' + ' world'")
    expect(result).not.toContain('[')
  })
})

// ============================================================
// INTEGRATION TEST
// ============================================================

// ============================================================
// PHASE 4: STRUCTURAL GAPS
// ============================================================

describe('Phase 4: Structural Gaps', () => {
  it('4A: nargin flagged with warning', () => {
    expect(flagTypes('if nargin < 2')).toContain('WARNING')
  })

  it('4B: ME.message → str(ME)', () => {
    expect(py('disp(ME.message);')).toContain('str(ME)')
  })

  it('4C: struct creation', () => {
    const result = py("s = struct('x', 1, 'y', 2);")
    expect(result).toContain("{'x': 1, 'y': 2}")
  })

  it('4D: dynamic field access s.(name)', () => {
    expect(py('val = s.(fname);')).toContain('s[fname]')
  })

  it('4E: classdef flagged', () => {
    expect(flagTypes('classdef MyClass')).toContain('TODO')
  })

  it('4E: varargin NOT flagged — deterministically rewritten to *args', () => {
    const result = convert('function out = f(a, varargin)\nend')
    expect(result.python).toContain('def f(a, *args):')
    // No varargin warning fires — the rewrite is a sure thing.
    const messages = result.report.flags.map(f => f.message).join('|')
    expect(messages).not.toContain('varargin found')
  })

  it('4E: varargout still flagged', () => {
    expect(flagTypes('function varargout = f(x)\nend')).toContain('WARNING')
  })

  // ── nargin default lifting ───────────────────────────────
  // Bare `if nargin < 2` (no surrounding function) keeps the warning, since
  // there's no signature to lift the default into.
  it('4F: nargin default lifted into signature (multi-line)', () => {
    const matlab = `function y = foo(a, b)
  if nargin < 2
    b = 5;
  end
  y = a + b;
end`
    const result = convert(matlab)
    expect(result.python).toContain('def foo(a, b=5):')
    // The if-block lines are elided
    expect(result.python).not.toContain('nargin')
    // No nargin flag for the lifted block
    expect(result.report.flags.map(f => f.message).join('|')).not.toContain('nargin used')
  })

  it('4F: nargin default lifted into signature (one-liner)', () => {
    const matlab = `function y = foo(a, b)
  if nargin < 2, b = 'hi'; end
  y = a;
end`
    const result = convert(matlab)
    expect(result.python).toContain("def foo(a, b='hi'):")
    expect(result.python).not.toContain('nargin')
  })

  it('4F: nargin lifts multiple defaults', () => {
    const matlab = `function y = foo(a, b, c)
  if nargin < 3
    c = 10;
  end
  if nargin < 2
    b = 5;
  end
  y = a + b + c;
end`
    const result = convert(matlab)
    expect(result.python).toContain('def foo(a, b=5, c=10):')
  })

  it('4F: nargin without function context still flags', () => {
    // Bare nargin use outside a function — no signature to lift to.
    expect(flagTypes('if nargin < 2')).toContain('WARNING')
  })

  it('4F: nargin || isempty compound condition lifts default', () => {
    const matlab = `function y = foo(a, b)
  if nargin < 2 || isempty(b)
    b = 5;
  end
  y = a + b;
end`
    const result = convert(matlab)
    expect(result.python).toContain('def foo(a, b=5):')
    expect(result.python).not.toContain('isempty')
  })

  it('4F: ~exist(p, var) lifts default', () => {
    const matlab = `function y = foo(a, b)
  if ~exist('b', 'var')
    b = 'hi';
  end
  y = a;
end`
    const result = convert(matlab)
    expect(result.python).toContain("def foo(a, b='hi'):")
  })

  it('4F: nargin block with non-matching param is NOT lifted, but comparison converts cleanly', () => {
    // The body assigns a different name than the Nth param — lifting does not
    // happen. Stage 3 converts `nargin < 2` to `b is None` (clean idiom).
    // No warning fires because the output is valid Python; the `b is None`
    // check self-documents that the caller should pass `b=None` optionally.
    const matlab = `function y = foo(a, b)
  if nargin < 2
    other = 5;
  end
  y = a;
end`
    const result = convert(matlab)
    expect(result.python).toContain('def foo(a, b):')
    expect(result.python).toContain('b is None')
    expect(result.report.flags.map(f => f.message).join('|')).not.toContain('nargin used')
  })
})

// ============================================================
// PHASE 5: TOOLBOX EXPANSION
// ============================================================

describe('Phase 5: Toolbox Expansion', () => {
  it('5A: sym → sp.Symbol', () => {
    expect(py("x = sym('x');")).toContain("sp.Symbol('x')")
  })

  it('5A: simplify → sp.simplify', () => {
    expect(py('y = simplify(expr);')).toContain('sp.simplify(expr)')
  })

  it('5B: wavedec → pywt.wavedec', () => {
    expect(py("c = wavedec(x, 4, 'db4');")).toContain("pywt.wavedec(x, 4, 'db4')")
  })

  it('5B: cwt → pywt.cwt', () => {
    expect(py('W = cwt(x);')).toContain('pywt.cwt(x)')
  })

  it('5C: deep learning flagged', () => {
    expect(flagTypes("net = trainNetwork(X, Y, layers, options);")).toContain('TODO')
  })

  it('5D: table flagged', () => {
    expect(flagTypes("T = readtable('data.csv');")).toContain('TODO')
  })

  it('5E: interp1 → np.interp', () => {
    expect(py('yi = interp1(x, y, xi);')).toContain('np.interp(x, y, xi)')
  })
})

// ============================================================
// ============================================================
// FINAL POLISH: Plot Args, ODE Solvers, Complex Ranges
// ============================================================

describe('Plot Named Arguments', () => {
  it('converts LineWidth to linewidth=', () => {
    const result = py("plot(x, y, 'r', 'LineWidth', 1.5);")
    expect(result).toContain('linewidth=1.5')
    expect(result).not.toContain("'LineWidth'")
  })

  it('converts MarkerSize to markersize=', () => {
    const result = py("plot(x, y, 'o', 'MarkerSize', 8);")
    expect(result).toContain('markersize=8')
  })

  it('converts Location to loc= in legend', () => {
    const result = py("legend('a', 'b', 'Location', 'Best');")
    expect(result).toContain("loc='best'")
    expect(result).not.toContain("'Location'")
  })

  it('converts FontSize to fontsize=', () => {
    const result = py("title('My Title', 'FontSize', 14);")
    expect(result).toContain('fontsize=14')
  })

  it('converts DisplayName to label=', () => {
    const result = py("plot(x, y, 'DisplayName', 'Series 1');")
    expect(result).toContain("label='series 1'")
  })
})

describe('ODE Solvers', () => {
  it('converts ode45 to solve_ivp', () => {
    const result = py("[t, y] = ode45(@func, [0 10], y0);")
    expect(result).toContain('solve_ivp')
    expect(imports("[t, y] = ode45(@func, [0 10], y0);")).toContain('scipy.integrate')
  })

  it('flags ode45 with return format warning', () => {
    expect(flagTypes("[t, y] = ode45(@func, [0 10], y0);")).toContain('WARNING')
  })

  it('converts ode15s to solve_ivp', () => {
    const result = py("[t, y] = ode15s(@stiff_func, tspan, y0);")
    expect(result).toContain('solve_ivp')
  })

  it('converts integral to quad', () => {
    const result = py('q = integral(@(x) x.^2, 0, 1);')
    expect(result).toContain('integrate.quad')
  })

  it('converts trapz', () => {
    expect(py('I = trapz(x, y);')).toContain('np.trapz(x, y)')
  })

  it('converts gradient', () => {
    expect(py('dy = gradient(y, dx);')).toContain('np.gradient(y, dx)')
  })
})

describe('Complex Range Expressions', () => {
  it('converts (-(N/2):(N/2)-1) range', () => {
    const result = py('w = (-(N/2):(N/2)-1)*df;')
    expect(result).toContain('np.arange')
    expect(result).not.toContain('TODO')
  })

  it('converts Fs*(0:(L/2))/L range', () => {
    const result = convert('f = Fs*(0:(L/2))/L;')
    // Should either convert the range or at least not produce a TODO
    expect(result.python).toContain('np.arange')
  })
})

// ============================================================
// INTEGRATION TEST
// ============================================================

describe('Integration', () => {
  it('converts a complete signal processing script', () => {
    const matlab = `
function filtered = lowpass_filter(x, fs, fc)
    [b, a] = butter(4, fc/(fs/2));
    filtered = filtfilt(b, a, x);
    N = length(filtered);
    Y = fft(filtered);
    figure
    plot(abs(Y))
    title('Spectrum')
    grid on
end`
    const result = convert(matlab)
    expect(result.python).toContain('def lowpass_filter(x, fs, fc):')
    expect(result.python).toContain('b, a = signal.butter')
    expect(result.python).toContain('signal.filtfilt')
    expect(result.python).toContain('np.fft.fft')
    expect(result.python).toContain('plt.plot')
    expect(result.python).toContain('plt.grid(True)')
    expect(result.python).toContain('import numpy as np')
    expect(result.python).toContain('import scipy.signal as signal')
    expect(result.python).toContain('import matplotlib.pyplot as plt')
    expect(result.report.detectedToolboxes).toContain('Signal Processing')
    expect(result.processingMs).toBeLessThan(100)
  })
})

// ============================================================
// PHASE 1: String-aware arg splitter
// ============================================================

describe('String-aware arg splitter', () => {
  it('strsplit preserves commas inside the string argument', () => {
    expect(py("parts = strsplit('a,b,c,d', ',');")).toContain("'a,b,c,d'.split(',')")
  })

  it('strrep preserves commas inside args', () => {
    expect(py("s = strrep('x,y,z', ',', ':');")).toContain("'x,y,z'.replace(',', ':')")
  })

  it('strsplit on a variable still works', () => {
    expect(py("p = strsplit(raw, ',');")).toContain("raw.split(',')")
  })

  it('startsWith with string literal', () => {
    expect(py("b = startsWith(name, 'Dr.');")).toContain("name.startswith('Dr.')")
  })

  it('endsWith with string literal', () => {
    expect(py("b = endsWith(name, '.pdf');")).toContain("name.endswith('.pdf')")
  })

  it('single-arg templates still work (length)', () => {
    expect(py("n = length(A);")).toContain('max(A.shape)')
  })

  it('single-arg templates still work (numel)', () => {
    expect(py("n = numel(A);")).toContain('len(A)')
  })

  it('reshape with dimensions preserves all args', () => {
    expect(py("B = reshape(A, 3, 4);")).toContain('A.reshape')
  })
})

// ============================================================
// PHASE 3: Reverse-slice and `end` idioms
// ============================================================

describe('Reverse-slice and end idioms', () => {
  it('v(end:-1:1) reverses', () => {
    expect(py('r = v(end:-1:1);')).toContain('v[::-1]')
  })

  it('v(end:-2:1) reverses with step', () => {
    expect(py('r = v(end:-2:1);')).toContain('v[::-2]')
  })

  it('v(end-3:-1:1) starts from offset', () => {
    expect(py('r = v(end-3:-1:1);')).toContain('v[-4::-1]')
  })

  it('v(end:-1:5) stops early', () => {
    expect(py('r = v(end:-1:5);')).toContain('v[:3:-1]')
  })

  it('v(1:end) is full slice', () => {
    expect(py('a = v(1:end);')).toContain('v[:]')
  })

  it('v(1:end-2) drops last n', () => {
    expect(py('a = v(1:end-2);')).toContain('v[:-2]')
  })

  it('v(3:end) offsets start', () => {
    expect(py('a = v(3:end);')).toContain('v[2:]')
  })

  it('v(end) is last element', () => {
    expect(py('a = v(end);')).toContain('v[-1]')
  })

  it('v(end-4) indexes from tail', () => {
    expect(py('a = v(end-4);')).toContain('v[-5]')
  })

  it('does not touch known Python functions named end', () => {
    // These reverse-slice patterns should only apply to user variables,
    // not to names like range/len/print. Smoke test: length is a function.
    const out = py('n = length(v);')
    expect(out).toContain('max(v.shape)')
  })
})

// ============================================================
// PHASE 2: 3-part ranges with non-integer steps
// ============================================================

describe('3-part ranges with non-integer steps', () => {
  it('t = 0:1/fs:1 preserves step expression', () => {
    expect(py('t = 0:1/fs:1;')).toContain('np.arange(0, 1 + 1/fs, 1/fs)')
  })

  it('x = 0:0.1:pi handles decimal step', () => {
    expect(py('x = 0:0.1:pi;')).toContain('np.arange(0, np.pi + 0.1, 0.1)')
  })

  it('y = 10:-0.5:0 handles negative decimal step', () => {
    expect(py('y = 10:-0.5:0;')).toContain('np.arange(10, 0 + -0.5, -0.5)')
  })

  it('simple 2-part range still works (regression)', () => {
    expect(py('z = 1:5;')).toContain('np.arange(1, 5 + 1)')
  })

  it('integer 3-part still works', () => {
    expect(py('w = 1:2:10;')).toContain('np.arange(1, 10 + 2, 2)')
  })
})

// ============================================================
// CORPUS FIXES: quote-in-comment, string corruption, LHS assign, ~
// ============================================================

describe('Comment and string protection', () => {
  it('does not convert transposes inside line comments', () => {
    const out = convert("% foo(x) returns [a b]'\nx = 1;").python
    // The `'` inside a comment must survive as-is, not become `.T`.
    // (Separately, the cleanup pass rewrites `[a b]` to `[a, b]` even in
    // comments — that's a distinct issue unrelated to the transpose fix.)
    expect(out).not.toContain(".T")
    expect(out).toMatch(/#.*'/)
  })

  it('does not replace keywords inside string literals', () => {
    const out = py("opts = '-eps -level2';")
    expect(out).toContain("'-eps -level2'")
    expect(out).not.toContain('np.finfo(float).eps -level2')
  })

  it('does not replace pi inside string literals', () => {
    const out = py("msg = 'compute pi';")
    expect(out).toContain("'compute pi'")
    expect(out).not.toContain("compute np.pi")
  })
})

describe('Nested paren balanced capture', () => {
  it('reshape with nested call preserves inner args', () => {
    const out = py('s = reshape(logsumexp(s,2), rows(a), cols(b));')
    expect(out).toContain('.reshape')
    expect(out).not.toContain('2.reshape')
  })

  it('length with nested function-like arg no longer produces 2.reshape-style garbage', () => {
    // The nested-paren fix means the inner call is captured as a single
    // arg and passed through the template substitution intact. The
    // downstream stage may still rewrite `name(a, b)` to index form
    // because of MATLAB's parens ambiguity, but the template itself
    // must not truncate the expression.
    const out = py('s = reshape(logsumexp(s,2), rows(a), cols(b));')
    // Before the fix: `logsumexp(s,2.reshape,...)` — invalid Python.
    expect(out).not.toMatch(/\d\.reshape/)
  })
})

describe('LHS assign-to-function-call → index', () => {
  it('A(i) = v becomes A[i - 1] = v (with 1→0 shift)', () => {
    // Stage 4 handles bare-index LHS and shifts 1-based → 0-based.
    expect(py('A(i) = v;')).toContain('A[i - 1] = v')
  })

  it('A(finddiag(A,k)) = v preserves nested call in index', () => {
    // Cleanup handles the leftover (stage 4 can't match nested parens).
    expect(py('A(finddiag(A,k)) = v;')).toContain('A[finddiag(A,k)] = v')
  })

  it('A(i, :) = row preserves multi-dim slice (with shift)', () => {
    const out = py('A(i, :) = row;')
    expect(out).toContain('A[i - 1, :] = row')
  })

  it('does not convert RHS function calls', () => {
    const out = py('v = func(x);')
    expect(out).toContain('v = func(x)')
    expect(out).not.toContain('v = func[x]')
  })

  it('does not convert equality comparison', () => {
    const out = py('if A(i) == v')
    expect(out).not.toContain('A[i] == v')  // A(i) on RHS of ==, not LHS of =
  })
})

describe('Logical NOT (~ → not)', () => {
  it('~isempty(x) becomes not len(x) == 0', () => {
    const out = py('if ~isempty(x)')
    expect(out).toContain('not len(x) == 0')
  })

  it('~flag becomes not flag', () => {
    expect(py('if ~flag')).toContain('if not flag')
  })

  it('~(a == b) becomes not (a == b)', () => {
    expect(py('while ~(a == b)')).toContain('while not (a == b)')
  })

  it('leaves ~= as != (separate operator)', () => {
    expect(py('if a ~= b')).toContain('a != b')
  })

  it('[~, idx] = sort(x) uses argsort for discard + index idiom', () => {
    // Idiom library rewrites this to np.argsort (MATLAB's semantics)
    // rather than `_, idx = np.sort(x)` which would lose the indices.
    expect(py('[~, idx] = sort(x);')).toContain('idx = np.argsort(x)')
  })
})

// ============================================================
// TIER 1: Idiom library
// ============================================================

describe('MATLAB idiom library', () => {
  it('zeros(size(X)) → np.zeros_like(X)', () => {
    expect(py('y = zeros(size(x));')).toContain('np.zeros_like(x)')
  })

  it('ones(size(X)) → np.ones_like(X)', () => {
    expect(py('y = ones(size(x));')).toContain('np.ones_like(x)')
  })

  it('nan(size(X)) → np.full(X.shape, np.nan)', () => {
    expect(py('y = nan(size(x));')).toContain('np.full(x.shape, np.nan)')
  })

  it('reshape(X, [], 1) → X.reshape(-1, 1)', () => {
    expect(py('c = reshape(x, [], 1);')).toContain('x.reshape(-1, 1)')
  })

  it('reshape(X, 1, []) → X.reshape(1, -1)', () => {
    expect(py('r = reshape(x, 1, []);')).toContain('x.reshape(1, -1)')
  })

  it('[~, idx] = min(x) → idx = np.argmin(x)', () => {
    expect(py('[~, idx] = min(x);')).toContain('idx = np.argmin(x)')
  })
})

// ============================================================
// TIER 1: Symbol table / scope
// ============================================================

describe('Symbol table resolves A(i) ambiguity', () => {
  it('user-defined function on RHS stays as call', () => {
    // `helper` is never assigned, so it's a function. `A(i)` would be
    // a call, not index — but `A` IS assigned, so `A(i)` gets indexed.
    const matlab = `A = zeros(10, 1);
for i = 1:10
    A(i) = helper(i);
end`
    const out = py(matlab)
    expect(out).toContain('A[i - 1] = helper(i)')
  })

  it('map is a MATLAB variable name, not Python builtin', () => {
    // `map` collides with Python's builtin, but on LHS it's unambiguously
    // a variable assignment. Must convert to index form.
    const matlab = `map = zeros(256, 3);
map(1, :) = [0 0 0];`
    const out = py(matlab)
    expect(out).toContain('map[0, :]')
    expect(out).not.toContain('map(1')
  })

  it('function parameter treated as variable', () => {
    const matlab = `function y = process(signal)
    y = signal(1);
end`
    const out = py(matlab)
    expect(out).toContain('signal[0]')
  })
})

// ============================================================
// Runtime-shim (matlabtopython-compat) integration
// ============================================================

describe('matlabtopython-compat runtime shim', () => {
  it('emits import for sort_with_index idiom', () => {
    const full = convert('[s, i] = sort(x);').python
    expect(full).toContain('from matlabtopython_compat import sort_with_index')
    expect(full).toContain('s, i = sort_with_index(x)')
  })

  it('does not emit compat import when idiom did not fire', () => {
    const full = convert('y = 5;').python
    expect(full).not.toContain('matlabtopython_compat')
  })
})


describe('Import alias / variable name collisions', () => {
  it('renames a user variable that collides with an injected import alias', () => {
    const result = convert(
      "signal = sin(2*pi*50*t);\n[b, a] = butter(4, 0.5, 'low');\nfiltered = filter(b, a, signal);",
    )
    const code = result.python
    // import alias for the toolbox module must survive
    expect(code).toContain('import scipy.signal as signal')
    // the user's `signal` variable must be renamed so it doesn't shadow it
    expect(code).toMatch(/\bsignal_\b/)
    expect(code).not.toMatch(/^\s*signal\s*=/m)
    // generated calls still reference the scipy.signal module
    expect(code).toMatch(/signal\.(butter|lfilter)/)
  })
})

describe('List-literal arithmetic vectorization', () => {
  it('vectorizes a list literal divided by a scalar', () => {
    const code = convert("c = [40 60]/(fs/2);").python
    expect(code).toMatch(/np\.array\(\[40, 60\]\)\s*\/\s*\(fs\/2\)/)
  })

  it('does not wrap a multiple-return assignment LHS', () => {
    const code = convert("[b, a] = butter(4, 0.5, 'low');").python
    expect(code).not.toMatch(/np\.array\(\[b, a\]\)/)
  })

  it('does not wrap a list passed as a function argument', () => {
    const code = convert("y = max([1 2 3]);").python
    expect(code).not.toContain('np.array([1, 2, 3])')
  })
})

describe('Array-literal np.array wrapping (#0)', () => {
  it('wraps a top-level numeric vector assignment as np.array', () => {
    const code = convert('v = [1 2 3 4 5];').python
    expect(code).toMatch(/v = np\.array\(\[1, 2, 3, 4, 5\]\)/)
  })

  it('keeps a multiple-return LHS unwrapped', () => {
    const code = convert("[b, a] = butter(4, 0.5, 'low');").python
    expect(code).not.toMatch(/np\.array\(\[b, a\]\)/)
  })
})

describe('Dual-return max/min (#3)', () => {
  it('[v, i] = max(x) returns value and index', () => {
    const code = convert('[mx, pos] = max(v);').python
    expect(code).toMatch(/mx, pos = np\.amax\(v\), np\.argmax\(v\)/)
  })
  it('[v, i] = min(x) returns value and index', () => {
    const code = convert('[mn, pos] = min(v);').python
    expect(code).toMatch(/mn, pos = np\.amin\(v\), np\.argmin\(v\)/)
  })
})

describe('Matrix-literal rows with nested elements (SyntaxError bucket)', () => {
  it('splits space-separated row elements that contain nested indexing', () => {
    // Define A so it's a known array (so A(1,1) index-shifts to A[0, 0]); the
    // point of the test is that the row splits despite the nested comma in A[0, 0].
    const code = convert('A = [1 2; 3 4];\nM = [A(1,1) 5; 6 7];').python
    expect(code).toMatch(/M = np\.array\(\[\[A\[0, 0\], 5\], \[6, 7\]\]\)/)
  })
})
