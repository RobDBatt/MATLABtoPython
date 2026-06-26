export const article = {
  slug: 'matlab-bsxfun-python',
  title: 'MATLAB bsxfun to Python: NumPy broadcasting',
  description:
    'Convert MATLAB bsxfun to Python. NumPy broadcasts element-wise operations natively, so bsxfun(@plus, A, b) becomes simply A + b. Includes the operator-handle mapping.',
  publishedAt: '2026-06-26',
  keyword: 'matlab bsxfun python',
  sections: [
    {
      heading: 'bsxfun disappears — NumPy broadcasts natively',
      body: `\`bsxfun\` ("binary singleton expansion function") exists because older MATLAB wouldn't auto-expand mismatched dimensions. **NumPy broadcasts by default**, so the entire \`bsxfun\` wrapper vanishes — you just write the operation:

\`\`\`matlab
% MATLAB
A = [1 2 3; 4 5 6];
b = [10 20 30];
C = bsxfun(@plus, A, b);    % add row vector to each row
D = bsxfun(@times, A, 2);
\`\`\`

\`\`\`python
# Python — broadcasting does it for free
import numpy as np

A = np.array([[1, 2, 3], [4, 5, 6]])
b = np.array([10, 20, 30])
C = A + b          # (2,3) + (3,) broadcasts across rows
D = A * 2
\`\`\`

\`bsxfun(@op, X, Y)\` → \`X op Y\`. That's exactly what the converter produces, and it's correct.`,
    },
    {
      heading: 'The function-handle → operator map',
      body: `Each \`@handle\` becomes its Python operator:

| MATLAB | Python |
|---|---|
| \`bsxfun(@plus, A, B)\` | \`A + B\` |
| \`bsxfun(@minus, A, B)\` | \`A - B\` |
| \`bsxfun(@times, A, B)\` | \`A * B\` |
| \`bsxfun(@rdivide, A, B)\` | \`A / B\` |
| \`bsxfun(@power, A, B)\` | \`A ** B\` |
| \`bsxfun(@max, A, B)\` | \`np.maximum(A, B)\` |
| \`bsxfun(@ge, A, B)\` | \`A >= B\` |
| \`bsxfun(@eq, A, B)\` | \`A == B\` |

The only ones that aren't a bare operator are the named functions like \`@max\`/\`@min\` → \`np.maximum\`/\`np.minimum\` (the element-wise pair versions, which broadcast).`,
    },
    {
      heading: 'Getting the broadcast shapes right',
      body: `Broadcasting works when trailing dimensions match or are 1. The common case — applying a **column** vector down the rows — needs an explicit column shape in NumPy:

\`\`\`matlab
% MATLAB — subtract a column vector from each column
col = [1; 2];
C = bsxfun(@minus, A, col);   % A is 2×3, col is 2×1
\`\`\`

\`\`\`python
# Python — make col a (2,1) column so it broadcasts down rows
col = np.array([[1], [2]])    # shape (2,1)
C = A - col
# or from a 1-D array: A - col[:, None]
\`\`\`

A 1-D NumPy array broadcasts against the **last** axis (like a row). For column behavior, reshape to \`(n, 1)\` or index with \`[:, None]\`.`,
    },
    {
      heading: 'Convert your bsxfun code automatically',
      body: `The [MATLAB-to-Python converter](/convert) drops the \`bsxfun\` wrapper and emits the plain broadcast operation. Note that modern MATLAB (R2016b+) broadcasts natively too, so a lot of \`bsxfun\` code is already legacy — the Python version is simply the clean arithmetic underneath.`,
    },
  ],
}
