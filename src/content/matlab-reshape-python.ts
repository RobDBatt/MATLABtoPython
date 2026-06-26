export const article = {
  slug: 'matlab-reshape-python',
  title: "MATLAB reshape to Python: the order='F' column-major gotcha",
  description:
    "Convert MATLAB reshape to NumPy. MATLAB is column-major and NumPy is row-major, so reshape(A,m,n) needs order='F' to match. The same applies to A(:) flattening.",
  publishedAt: '2026-06-26',
  keyword: 'matlab reshape python',
  sections: [
    {
      heading: 'reshape looks identical — but silently reorders your data',
      body: `\`reshape\` exists in both MATLAB and NumPy with the same name and arguments, which makes it one of the most dangerous functions to port. The signatures match; the **element order does not**.

MATLAB is **column-major** (it fills down columns first). NumPy is **row-major** (it fills across rows first). So the naive translation produces a *different matrix* with no error:

\`\`\`matlab
% MATLAB — fills column by column
A = [1 2 3 4 5 6];
B = reshape(A, 2, 3)
% B =
%   1  3  5
%   2  4  6
\`\`\`

\`\`\`python
# Python — A.reshape(2,3) fills ROW by row → WRONG vs MATLAB
B = A.reshape(2, 3)
# array([[1, 2, 3],
#        [4, 5, 6]])   ← not the same matrix
\`\`\`

Both run. Both give a 2×3 array. Only one matches MATLAB. This is the single most common *silent* bug in a MATLAB-to-Python migration.`,
    },
    {
      heading: "The fix: order='F'",
      body: `Pass \`order='F'\` (Fortran / column-major) to make NumPy match MATLAB exactly:

\`\`\`python
import numpy as np

A = np.array([1, 2, 3, 4, 5, 6])
B = A.reshape(2, 3, order='F')
# array([[1, 3, 5],
#        [2, 4, 6]])   ← matches MATLAB
\`\`\`

Use \`order='F'\` whenever you're reshaping data that originated in MATLAB and the *layout* matters — building a matrix from a vector, unrolling an image, packing/unpacking state vectors. If you only ever reshape, compute, and reshape back **with the same order**, the round-trip is self-consistent and the choice cancels out.`,
    },
    {
      heading: 'The same trap hides in A(:)',
      body: `MATLAB's colon flatten \`A(:)\` is also column-major. The faithful NumPy equivalent is \`A.flatten(order='F')\` (or \`A.ravel('F')\`), **not** the default \`A.flatten()\`:

\`\`\`matlab
% MATLAB
A = [1 2; 3 4];
v = A(:)          % [1; 3; 2; 4]  (down columns)
\`\`\`

\`\`\`python
# Python
A = np.array([[1, 2], [3, 4]])
v = A.flatten(order='F')   # [1 3 2 4]  ✓ matches MATLAB
# A.flatten()  →  [1 2 3 4]  ✗ row-major
\`\`\`

Anywhere you see \`A(:)\` feeding \`sum\`, \`reshape\`, or a linear index, carry the \`order='F'\` through.`,
    },
    {
      heading: 'When you can ignore order',
      body: `Column vs row order is irrelevant when:

- The array is **1-D** — there's only one axis to traverse.
- You **created the data in Python** and never compared it element-for-element against MATLAB output.
- You reshape and reshape back with the **same order** within a self-contained calculation.

It matters when a specific element must land in a specific position — which is most of the time when you're reproducing a MATLAB result. When in doubt, add \`order='F'\` and verify a couple of elements by hand.`,
    },
    {
      heading: 'Convert your MATLAB code automatically',
      body: `The [MATLAB-to-Python converter](/convert) translates \`reshape\`, indexing, and the rest of your script in one pass. For column-major-sensitive reshapes, double-check the \`order='F'\` on the output — it's the one place where "looks right" and "is right" can differ.

Paste your MATLAB into the [converter](/convert) to get a runnable NumPy starting point in seconds.`,
    },
  ],
}
