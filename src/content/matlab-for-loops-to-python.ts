export const article = {
  slug: 'matlab-for-loops-to-python',
  title: 'Convert MATLAB for Loops to Python: 12 Patterns and Their Pitfalls',
  description: 'Every common MATLAB for-loop pattern translated to Python — with the bugs to watch for in each. Covers range loops, reverse iteration, cell iteration, nested loops, and vectorization.',
  publishedAt: '2026-04-17',
  keyword: 'matlab for loop python',
  sections: [
    {
      heading: 'The surface-level translation',
      body: `The simplest MATLAB for loop maps directly to Python:

\`\`\`matlab
for i = 1:10
    disp(i);
end
\`\`\`

\`\`\`python
for i in range(1, 11):
    print(i)
\`\`\`

Two things to notice immediately:

- MATLAB \`1:10\` is **inclusive of 10** — produces 10 values.
- Python \`range(1, 11)\` is **exclusive of 11** — also produces 10 values.

The end bound shifts by 1. Miss that and your loop runs one iteration short.`,
    },
    {
      heading: 'Pattern 1: Range with step',
      body: `\`\`\`matlab
for i = 1:2:10        % 1, 3, 5, 7, 9
    ...
end
\`\`\`

\`\`\`python
for i in range(1, 11, 2):    # 1, 3, 5, 7, 9
    ...
\`\`\`

The three-argument form is \`range(start, stop, step)\`. Same pitfall as the two-arg form — stop is exclusive. If your MATLAB code does \`1:2:10\`, Python needs \`range(1, 11, 2)\`.`,
    },
    {
      heading: 'Pattern 2: Reverse iteration',
      body: `\`\`\`matlab
for i = 10:-1:1
    ...
end
\`\`\`

\`\`\`python
for i in range(10, 0, -1):
    ...
\`\`\`

Or more Pythonic:
\`\`\`python
for i in reversed(range(1, 11)):
    ...
\`\`\`

The negative step still uses exclusive bound — \`range(10, 0, -1)\` stops at 1 (not 0). Watch the bound carefully.`,
    },
    {
      heading: 'Pattern 3: Fractional step',
      body: `\`\`\`matlab
for t = 0:0.1:1       % 0.0, 0.1, ..., 1.0
    ...
end
\`\`\`

\`\`\`python
import numpy as np
for t in np.arange(0, 1 + 0.1, 0.1):
    ...
\`\`\`

Python's built-in \`range\` only accepts integer steps. For fractional steps you need \`np.arange\`. Note the \`1 + 0.1\` — same inclusive-to-exclusive shift, but with the step as the delta.

Better yet, use \`np.linspace\` when you know the count:
\`\`\`python
for t in np.linspace(0, 1, 11):   # 11 values from 0 to 1 inclusive
    ...
\`\`\`

Linspace avoids floating-point drift that arange can introduce on long sequences.`,
    },
    {
      heading: 'Pattern 4: Iterating over a vector directly',
      body: `\`\`\`matlab
v = [10 20 30 40];
for x = v
    disp(x);
end
\`\`\`

\`\`\`python
v = [10, 20, 30, 40]
for x in v:
    print(x)
\`\`\`

MATLAB iterates by **columns** of the input — so if \`v\` is a row vector, each iteration gives a scalar. If \`v\` is a matrix, each iteration gives a column vector. Python's \`for x in v\` on a 1D array iterates scalars, but on a 2D numpy array it iterates **rows** — opposite of MATLAB. Convert matrices with \`v.T\` before iterating if you need the column-wise behavior.`,
    },
    {
      heading: 'Pattern 5: Iterate with index AND value',
      body: `\`\`\`matlab
for i = 1:length(names)
    fprintf('%d: %s\\n', i, names{i});
end
\`\`\`

\`\`\`python
for i, name in enumerate(names, start=1):
    print(f'{i}: {name}')
\`\`\`

Python's \`enumerate\` is cleaner than MATLAB's \`for i = 1:length(...)\` idiom. Use \`start=1\` if you want MATLAB-style 1-indexed output, or the default 0 for zero-indexed.`,
    },
    {
      heading: 'Pattern 6: Nested loops',
      body: `\`\`\`matlab
for i = 1:rows
    for j = 1:cols
        A(i, j) = f(i, j);
    end
end
\`\`\`

\`\`\`python
for i in range(rows):
    for j in range(cols):
        A[i, j] = f(i + 1, j + 1)
\`\`\`

If your \`f\` expects MATLAB-style 1-indexed inputs, pass \`i + 1\` and \`j + 1\`. If you've also ported \`f\`, drop the +1.

**Vectorize whenever possible.** Nested loops in NumPy are dramatically slower than their MATLAB equivalents. Most \`A(i, j) = f(i, j)\` patterns can be rewritten as a single array operation:
\`\`\`python
i_grid, j_grid = np.meshgrid(np.arange(rows), np.arange(cols), indexing='ij')
A = f(i_grid, j_grid)
\`\`\`
That's the same loop in one line and 100× faster.`,
    },
    {
      heading: 'Pattern 7: Loop over cell array',
      body: `\`\`\`matlab
names = {'Alice', 'Bob', 'Carol'};
for i = 1:length(names)
    disp(names{i});
end
\`\`\`

The Python list equivalent is straightforward:
\`\`\`python
names = ['Alice', 'Bob', 'Carol']
for name in names:
    print(name)
\`\`\`

If the MATLAB code relies on cell-array semantics (mixed types, grow-on-write with \`{end+1} = \`), you can \`pip install matlabtopython-compat\` and use our \`CellArray\` helper — it gives you MATLAB's cell-array ergonomics on a plain Python list.`,
    },
    {
      heading: 'Pattern 8: Skip iterations with continue',
      body: `\`\`\`matlab
for i = 1:n
    if isnan(x(i))
        continue;
    end
    total = total + x(i);
end
\`\`\`

\`\`\`python
for i in range(n):
    if np.isnan(x[i]):
        continue
    total += x[i]
\`\`\`

MATLAB's \`continue\` behaves identically to Python's. The more idiomatic Python version filters first:
\`\`\`python
total = sum(xi for xi in x if not np.isnan(xi))
# or just:
total = np.nansum(x)
\`\`\`

\`np.nansum\` ignores NaN values directly. Any time you see a MATLAB loop summing with NaN guards, check if a \`nan*\` function (\`nansum\`, \`nanmean\`, \`nanstd\`) replaces the whole loop.`,
    },
    {
      heading: 'Pattern 9: Early exit with break',
      body: `\`\`\`matlab
for i = 1:n
    if x(i) > threshold
        idx = i;
        break;
    end
end
\`\`\`

\`\`\`python
for i in range(n):
    if x[i] > threshold:
        idx = i + 1   # if you need MATLAB-style 1-based idx
        break
\`\`\`

Or better:
\`\`\`python
idx = next((i for i, xi in enumerate(x) if xi > threshold), None)
\`\`\`

The \`next()\` with a generator returns the first match or \`None\` — no loop needed. NumPy users may reach for \`np.argmax(x > threshold)\` which returns the index of the first True value.`,
    },
    {
      heading: 'Pattern 10: Accumulator loop → vectorize',
      body: `This is the single biggest speedup when porting MATLAB:

\`\`\`matlab
y = zeros(size(x));
for i = 1:length(x)
    y(i) = x(i)^2 + 2*x(i) + 1;
end
\`\`\`

NumPy eliminates the loop entirely:
\`\`\`python
y = x**2 + 2*x + 1
\`\`\`

Same result, 100–1000× faster on real data. MATLAB's JIT is excellent at vectorizing simple loops automatically; NumPy only vectorizes if you write it vectorized. When you port, always ask: "can I express this as an array op?"`,
    },
    {
      heading: 'Pattern 11: Parallel for (parfor)',
      body: `MATLAB's \`parfor\` parallelizes across CPU cores with zero code change:
\`\`\`matlab
parfor i = 1:n
    y(i) = expensive(x(i));
end
\`\`\`

Python has no built-in equivalent. The closest idiom is \`concurrent.futures\`:
\`\`\`python
from concurrent.futures import ProcessPoolExecutor
with ProcessPoolExecutor() as pool:
    y = list(pool.map(expensive, x))
\`\`\`

Or \`joblib\` if you want MATLAB-like ergonomics:
\`\`\`python
from joblib import Parallel, delayed
y = Parallel(n_jobs=-1)(delayed(expensive)(xi) for xi in x)
\`\`\`

Our converter flags every \`parfor\` as a WARNING because the threading model differs. Don't assume parallelization is free in Python.`,
    },
    {
      heading: 'Pattern 12: while-true with manual break',
      body: `\`\`\`matlab
while 1
    x = next_iteration(x);
    if converged(x)
        break;
    end
end
\`\`\`

\`\`\`python
while True:
    x = next_iteration(x)
    if converged(x):
        break
\`\`\`

MATLAB's \`while 1\` and Python's \`while True\` are interchangeable. The \`1\` in MATLAB is a number treated as true; Python prefers the literal \`True\` for readability, but \`while 1\` also works.`,
    },
    {
      heading: 'Should you let a converter do this?',
      body: `For the 12 patterns above, yes. [Our converter](/convert) handles all of them correctly, applies the 1-indexed to 0-indexed shift consistently, and flags edge cases like grow-on-write arrays and parfor. The vectorization step (Pattern 10) is the only one it can't automate — that's a design decision, not a translation.

For tricky cases — nested callbacks, closures over loop variables, custom iterators — the converter flags them for manual review. The goal is always "here's mechanical Python; here's what needs human judgment" rather than silent guesses.`,
    },
  ],
}
