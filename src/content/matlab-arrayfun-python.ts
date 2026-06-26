export const article = {
  slug: 'matlab-arrayfun-python',
  title: 'MATLAB arrayfun to Python: vectorize, comprehensions, np.vectorize',
  description:
    'Convert MATLAB arrayfun to Python. Most of the time you do not need it — NumPy vectorizes natively. When you do, use a list comprehension or np.vectorize, and mind UniformOutput.',
  publishedAt: '2026-06-26',
  keyword: 'matlab arrayfun python',
  sections: [
    {
      heading: 'First: you usually do not need arrayfun in Python',
      body: `MATLAB programmers reach for \`arrayfun\` because MATLAB doesn't always broadcast cleanly. NumPy does. So the most common \`arrayfun\` translation is **no function at all** — just the vectorized expression:

\`\`\`matlab
% MATLAB
v = [1 2 3 4];
y = arrayfun(@(x) x^2, v);     % [1 4 9 16]
z = arrayfun(@(x) x*2 + 1, v); % [3 5 7 9]
\`\`\`

\`\`\`python
# Python — NumPy broadcasts element-wise, no loop needed
import numpy as np

v = np.array([1, 2, 3, 4])
y = v ** 2          # [1 4 9 16]
z = v * 2 + 1       # [3 5 7 9]
\`\`\`

This is faster *and* clearer than any \`arrayfun\` equivalent. Before porting an \`arrayfun\` literally, check whether the body is just arithmetic — if so, drop the wrapper entirely.`,
    },
    {
      heading: 'When the function is not vectorizable: list comprehension',
      body: `If the per-element function genuinely can't be vectorized (it calls something scalar-only, or branches per element), a **list comprehension** is the direct equivalent:

\`\`\`matlab
% MATLAB
out = arrayfun(@(x) some_scalar_fn(x), v);
\`\`\`

\`\`\`python
# Python
out = np.array([some_scalar_fn(x) for x in v])
\`\`\`

Wrap it in \`np.array(...)\` when you want an array back (MATLAB's default \`UniformOutput=true\`). The comprehension is the workhorse — readable, and as fast as \`arrayfun\` was in MATLAB.`,
    },
    {
      heading: 'UniformOutput=false → a plain list',
      body: `\`'UniformOutput', false\` tells MATLAB the outputs are different sizes/types, so it returns a **cell array**. In Python that's just a **list** — drop the \`np.array\`:

\`\`\`matlab
% MATLAB — ragged outputs, returns a cell
parts = arrayfun(@(n) 1:n, [2 3 4], 'UniformOutput', false);
\`\`\`

\`\`\`python
# Python — list of arrays
parts = [np.arange(1, n + 1) for n in [2, 3, 4]]
\`\`\`

Rule of thumb: \`UniformOutput=true\` (default) → \`np.array([...])\`; \`UniformOutput=false\` → plain \`[...]\` list.`,
    },
    {
      heading: 'np.vectorize — convenience, not speed',
      body: `\`np.vectorize\` mirrors \`arrayfun\` most literally, applying a Python function over an array with broadcasting:

\`\`\`python
f = np.vectorize(some_scalar_fn)
out = f(v)
\`\`\`

But be clear-eyed: \`np.vectorize\` is **a loop under the hood** — it's for convenience and broadcasting semantics, not performance. The NumPy docs say as much. If speed matters, prefer real vectorization (section 1) or a comprehension. Use \`np.vectorize\` only when you want \`arrayfun\`-style broadcasting over multiple input arrays without writing the loop yourself.

> Note: the converter leaves \`arrayfun\` for you to translate by hand — there's no single correct target (vectorize vs comprehension vs np.vectorize depends on the body), so this is one to convert deliberately.`,
    },
    {
      heading: 'Convert the rest automatically',
      body: `\`arrayfun\` needs a human judgment call, but the *rest* of your MATLAB script — indexing, math, function mappings — converts mechanically. Paste it into the [MATLAB-to-Python converter](/convert) to handle everything around the \`arrayfun\`, then vectorize the per-element body using the patterns above.`,
    },
  ],
}
