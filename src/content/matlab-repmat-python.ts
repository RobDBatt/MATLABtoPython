export const article = {
  slug: 'matlab-repmat-python',
  title: 'MATLAB repmat to Python: np.tile and broadcasting',
  description:
    'Convert MATLAB repmat to NumPy. repmat(A,m,n) maps to np.tile(A,(m,n)), but broadcasting is often the better, copy-free alternative. Covers the dimension differences.',
  publishedAt: '2026-06-26',
  keyword: 'matlab repmat python',
  sections: [
    {
      heading: 'The direct replacement: np.tile',
      body: `MATLAB's \`repmat\` (replicate and tile an array) maps directly to NumPy's \`np.tile\`. The repetition counts go into a tuple:

\`\`\`matlab
% MATLAB
A = [1 2; 3 4];
B = repmat(A, 2, 3);        % 4×6: A tiled 2 down, 3 across
r = repmat([1 2 3], 3, 1);  % 3×3: row repeated 3 times
\`\`\`

\`\`\`python
# Python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.tile(A, (2, 3))         # 4×6
r = np.tile([1, 2, 3], (3, 1)) # 3×3
\`\`\`

\`repmat(A, m, n)\` → \`np.tile(A, (m, n))\`. That's the conversion the tool produces, and it's correct.`,
    },
    {
      heading: 'The dimension gotcha with 1-D arrays',
      body: `MATLAB has no true 1-D array — a "vector" is always 1×N or N×1. NumPy *does* have 1-D arrays, and \`np.tile\` treats them differently than you might expect:

\`\`\`python
v = np.array([1, 2, 3])     # shape (3,) — 1-D
np.tile(v, 3)               # shape (9,)   — stays 1-D
np.tile(v, (2, 3))          # shape (2, 9) — promotes to 2-D
\`\`\`

If you need a column replication of a row (MATLAB \`repmat(v, 3, 1)\`), give \`tile\` a 2-tuple: \`np.tile(v, (3, 1))\` → shape \`(3, 3)\`. When in doubt, make the source 2-D first (\`v.reshape(1, -1)\` or \`v[:, None]\`) so the result shape is unambiguous.`,
    },
    {
      heading: 'Often you should not tile at all — broadcast instead',
      body: `\`repmat\` is frequently used just to make shapes line up for an element-wise operation. NumPy **broadcasts** automatically, so you can skip the copy entirely:

\`\`\`matlab
% MATLAB — subtract column mean from each row
M = magic(3);
Mc = M - repmat(mean(M), size(M,1), 1);
\`\`\`

\`\`\`python
# Python — broadcasting, no tile, no extra memory
Mc = M - M.mean(axis=0)        # (3,3) - (3,) broadcasts across rows
\`\`\`

This is faster and uses no extra memory — \`np.tile\` materializes the full replicated array, while broadcasting does not. Reach for \`np.tile\` only when you genuinely need the physically repeated array (e.g., to pass to a function that won't broadcast).`,
    },
    {
      heading: 'Convert your repmat code automatically',
      body: `The [MATLAB-to-Python converter](/convert) maps \`repmat\` to \`np.tile\` with the right tuple of counts. After converting, look for spots where the tile only existed to align shapes — those are quick wins to replace with broadcasting for cleaner, faster Python.`,
    },
  ],
}
