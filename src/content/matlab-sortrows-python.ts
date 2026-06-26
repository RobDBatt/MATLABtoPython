export const article = {
  slug: 'matlab-sortrows-python',
  title: 'MATLAB sortrows to Python: np.lexsort, descending, and the index',
  description:
    'Convert MATLAB sortrows to NumPy with np.lexsort. Covers sorting by a column, descending order, the [sorted, idx] index output, and the pandas alternative.',
  publishedAt: '2026-06-26',
  keyword: 'matlab sortrows python',
  sections: [
    {
      heading: 'Sort all rows lexicographically: np.lexsort',
      body: `MATLAB's \`sortrows(A)\` sorts the rows of a matrix as tuples, left column first. NumPy's tool is \`np.lexsort\`, with one twist: **lexsort reads its keys in *reverse* priority** (last key is primary). So you reverse the columns to restore MATLAB's left-to-right order:

\`\`\`matlab
% MATLAB
A = [3 1; 1 2; 2 0];
S = sortrows(A);
% S = [1 2; 2 0; 3 1]   (sorted by col 1, then col 2)
\`\`\`

\`\`\`python
# Python
import numpy as np

A = np.array([[3, 1], [1, 2], [2, 0]])
S = A[np.lexsort(A[:, ::-1].T)]
# [[1 2]
#  [2 0]
#  [3 1]]
\`\`\`

\`A[:, ::-1].T\` feeds the columns to \`lexsort\` in reverse, which makes column 0 the primary key — matching MATLAB. This is exactly what the converter emits.`,
    },
    {
      heading: 'Sort by a specific column',
      body: `\`sortrows(A, col)\` sorts by one column (1-based in MATLAB). Subtract one for the 0-based NumPy index, and use a **stable** argsort so ties keep their order (as MATLAB does):

\`\`\`matlab
% MATLAB — sort by 2nd column
S2 = sortrows(A, 2);
\`\`\`

\`\`\`python
# Python — column index 1 (0-based)
S2 = A[A[:, 1].argsort(kind='stable')]
\`\`\`

The \`kind='stable'\` matters: it reproduces MATLAB's tie-breaking and keeps the conversion deterministic.`,
    },
    {
      heading: 'Descending order and the index output',
      body: `Two MATLAB features need a manual touch — negative column indices (descending) and the second return value (the sort index):

\`\`\`matlab
% MATLAB
S3 = sortrows(A, -1);        % descending by column 1
[S4, idx] = sortrows(A, 2);  % also return the permutation index
\`\`\`

\`\`\`python
# Python — descending: negate the key
S3 = A[(-A[:, 0]).argsort(kind='stable')]

# index output: capture the order, then apply it
idx = A[:, 1].argsort(kind='stable')   # 0-based permutation
S4  = A[idx]
\`\`\`

To get MATLAB's **1-based** \`idx\` (e.g., for a report), use \`idx + 1\`. The converter handles \`sortrows(A)\` and \`sortrows(A, col)\` directly and **flags** the descending / index-output cases for you to finish with these patterns.`,
    },
    {
      heading: 'The pandas alternative for named columns',
      body: `If your data has named columns (or you're already using pandas), \`sort_values\` is far more readable than \`lexsort\`:

\`\`\`python
import pandas as pd
df = pd.DataFrame(A, columns=['a', 'b'])

df.sort_values(['a', 'b'])                          # like sortrows(A)
df.sort_values('b')                                 # like sortrows(A, 2)
df.sort_values(['a', 'b'], ascending=[False, True]) # mixed directions
\`\`\`

For mixed ascending/descending across multiple columns, pandas is the clean choice — \`lexsort\` requires negating numeric keys, which only works for numeric data.`,
    },
    {
      heading: 'Convert your sortrows code automatically',
      body: `The [MATLAB-to-Python converter](/convert) maps \`sortrows(A)\` and \`sortrows(A, col)\` to the correct \`np.lexsort\`/\`argsort\` form, and raises a warning on the descending and index-output variants so you don't silently lose them. Paste your MATLAB in to get the NumPy version in seconds.`,
    },
  ],
}
