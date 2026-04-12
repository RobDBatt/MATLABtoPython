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
    expect(py('for i = 1:10')).toBe('for i in range(10):')
  })

  it('converts for loop with start:end', () => {
    expect(py('for i = 5:20')).toBe('for i in range(5, 20 + 1):')
  })

  it('converts while loop', () => {
    expect(py('while x > 0')).toBe('while x > 0:')
  })

  it('converts if/elseif/else', () => {
    expect(py('if x > 0')).toBe('if x > 0:')
    expect(py('elseif x < 0')).toBe('elif x < 0:')
    expect(py('else')).toBe('else:')
  })

  it('converts try/catch', () => {
    expect(py('try')).toBe('try:')
    expect(py('catch ME')).toBe('except Exception as ME:')
  })

  it('converts function definition', () => {
    expect(py('function y = square(x)')).toBe('def square(x):  # returns y')
  })

  it('converts function with multiple returns', () => {
    expect(py('function [a, b] = split(x)')).toBe('def split(x):  # returns a, b')
  })

  it('converts parfor with warning', () => {
    const result = py('parfor i = 1:10')
    expect(result).toContain('for i in range(10):')
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
    expect(py('n = numel(A);')).toBe('n = A.size')
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

  it('converts A(:) to flatten', () => {
    expect(py('v = A(:);')).toContain('A.flatten()')
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
  it('1A: tilde discard [~, idx] = max(A)', () => {
    expect(py('[~, idx] = max(A);')).toContain('_, idx = np.max(A)')
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

  it('1F: switch/case first case is if', () => {
    const result = convert('switch x\n  case 1\n    y = 1;\n  case 2\n    y = 2;\n  otherwise\n    y = 0;\nend')
    expect(result.python).toContain('if 1:')
    expect(result.python).toContain('elif 2:')
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
    expect(result).toContain('{x:d}')
    expect(result).toContain('{y:.2f}')
    expect(result).toContain('print(')
  })

  it('3A: sprintf returns f-string', () => {
    const result = py("s = sprintf('val = %f', x);")
    expect(result).toContain("f'")
    expect(result).toContain('{x:f}')
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

  it('4E: varargin flagged', () => {
    expect(flagTypes('function out = f(varargin)')).toContain('WARNING')
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
