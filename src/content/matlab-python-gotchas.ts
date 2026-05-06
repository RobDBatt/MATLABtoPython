export const article = {
  slug: 'matlab-python-gotchas-that-break-your-code',
  title: '7 MATLAB-to-Python Gotchas That Silently Break Your Code',
  description: 'The differences between MATLAB and Python that produce code that runs without errors but gives wrong results. Reshape ordering, 1-based indexing, transpose semantics, and more.',
  publishedAt: '2026-04-13',
  keyword: 'matlab to python differences',
  sections: [
    {
      heading: 'The dangerous bugs are the silent ones',
      body: `When you convert MATLAB to Python, syntax errors are easy — Python tells you what is wrong and where. The dangerous bugs are the ones that produce no errors but give wrong results. Your code runs, your plots look reasonable, and you do not realize the numbers are subtly wrong until someone tries to reproduce your research.

These are the seven most common silent-failure patterns in MATLAB-to-Python conversions. Each one produces valid Python that gives different results from the original MATLAB.`,
    },
    {
      heading: '1. Reshape fills columns first in MATLAB, rows first in Python',
      body: `This is the single most common source of wrong results in converted code, and it produces no error message.

MATLAB:
\`reshape(A, [3, 4])\`

Python (WRONG):
\`A.reshape(3, 4)\`

Python (CORRECT):
\`A.reshape(3, 4, order='F')\`

MATLAB fills matrices in column-major order (Fortran-style): it fills the first column, then the second, then the third. NumPy fills in row-major order (C-style) by default: it fills the first row, then the second, then the third.

For a 1D array \`[1, 2, 3, 4, 5, 6]\` reshaped to 2x3:

MATLAB produces: \`[[1, 3, 5], [2, 4, 6]]\` (columns filled first)
NumPy produces: \`[[1, 2, 3], [4, 5, 6]]\` (rows filled first)

Both are valid 2x3 matrices. Both operations succeed without errors. But every element is in the wrong position. If this is a data matrix you are processing downstream, every subsequent calculation is wrong.

**The fix:** Add \`order='F'\` to every reshape call, or restructure the logic to use row-major ordering. Our converter flags reshape operations with a note about the ordering difference.`,
    },
    {
      heading: '2. Array indexing starts at 1 in MATLAB, 0 in Python',
      body: `Everyone knows about this difference. Not everyone catches every instance in a large codebase.

MATLAB:
\`x = A(3)\` returns the third element.

Python (WRONG):
\`x = A[3]\` returns the fourth element.

Python (CORRECT):
\`x = A[2]\` returns the third element.

The simple cases are easy. The hard cases involve computed indices:

\`idx = find(A > threshold, 1, 'first')\`

In MATLAB, \`find\` returns a 1-based index. If you use that index to access another array without adjusting, you are off by one. In Python, \`np.where\` returns 0-based indices, so using the result directly is correct — but if your code was written assuming 1-based indices and does arithmetic on them, the offset compounds.

Our converter tracks which variables hold 0-based indices (from \`np.where\`, \`np.argmax\`, etc.) and does not double-shift them when they are used as array subscripts. This is one of the harder problems in automated conversion.

**The fix:** Audit every array access. Our converter shifts literal indices automatically and flags computed indices for review.`,
    },
    {
      heading: '3. The end keyword means different things',
      body: `In MATLAB, \`end\` inside an indexing expression refers to the last index of the array:

\`A(end)\` — last element
\`A(end-2:end)\` — last three elements
\`A(1:end-1)\` — all but the last

Python uses negative indexing instead:

\`A[-1]\` — last element
\`A[-3:]\` — last three elements
\`A[:-1]\` — all but the last

The simple substitutions are straightforward. The problem is \`end\` inside complex expressions:

\`gamma_real = gamma_real(1:(end-(T_cqi-1)))\`

This is real code from a StackOverflow question about MATLAB-to-Python conversion. The \`end\` here depends on the length of \`gamma_real\`, and the arithmetic around it needs to be translated carefully. The Python equivalent is:

\`gamma_real = gamma_real[:-(T_cqi-1)]\`

Getting this wrong by one element means your signal processing output has a different length than expected, which silently breaks every downstream operation that assumes a specific array size.

**The fix:** Our converter handles common \`end\` patterns automatically and flags complex expressions for review.`,
    },
    {
      heading: '4. Matrix multiply vs element-wise multiply',
      body: `In MATLAB:
\`A * B\` is matrix multiplication.
\`A .* B\` is element-wise multiplication.

In Python:
\`A * B\` is element-wise multiplication (for NumPy arrays).
\`A @ B\` is matrix multiplication.

This is an inversion. If you convert \`A * B\` to \`A * B\` without changing it, you get element-wise multiplication instead of matrix multiplication. The result has the same shape (for square matrices) but completely different values.

The same inversion applies to division: MATLAB's \`A / B\` is matrix right-division, while Python's \`A / B\` is element-wise.

**The fix:** Our converter maps \`.*\` to \`*\`, \`./\` to \`/\`, and \`.\^\` to \`**\` (element-wise operations). The bare \`*\` is kept as \`*\` because most MATLAB code uses it for both scalar and element-wise multiplication — matrix multiply with \`@\` is flagged where the context is ambiguous.`,
    },
    {
      heading: '5. Covariance and correlation treat rows differently',
      body: `MATLAB:
\`C = cov(X)\` — treats rows as observations, columns as variables.

Python:
\`C = np.cov(X)\` — treats rows as variables, columns as observations.

The matrices are transposed relative to each other. For a 100x5 data matrix (100 observations of 5 variables), MATLAB's \`cov(X)\` returns a 5x5 covariance matrix. NumPy's \`np.cov(X)\` returns a 100x100 matrix — transposing the meaning entirely.

The fix is \`np.cov(X, rowvar=False)\` or \`np.cov(X.T)\`, but if you do not know about this difference, your covariance matrix has the wrong dimensions and every downstream statistical calculation is wrong.

The same applies to \`corrcoef\`.

**The fix:** Our converter maps \`cov\` to \`np.cov\` and flags it with the specific explanation: "MATLAB treats rows as observations while NumPy treats rows as variables. You may need np.cov(X.T) or np.cov(X, rowvar=False)."`,
    },
    {
      heading: '6. Eigenvalue sorting order',
      body: `MATLAB:
\`[V, D] = eig(A)\` — returns eigenvalues sorted in ascending order by default.

Python:
\`eigenvalues, eigenvectors = np.linalg.eig(A)\` — returns eigenvalues in no particular order.

If your code assumes eigenvalues are sorted — for example, taking the largest eigenvalue as \`D(end,end)\` — the Python equivalent may return a completely different eigenvalue.

**The fix:** After calling \`np.linalg.eig\`, add a sort step:

\`idx = np.argsort(eigenvalues)[::-1]\`
\`eigenvalues = eigenvalues[idx]\`
\`eigenvectors = eigenvectors[:, idx]\`

Our converter flags every \`eig\` call with this specific guidance.`,
    },
    {
      heading: '7. Default standard deviation normalization',
      body: `MATLAB:
\`std(x)\` normalizes by N-1 (unbiased estimate) by default.

Python:
\`np.std(x)\` normalizes by N (biased estimate) by default.

For small sample sizes, this difference is significant. A dataset with 10 values will give noticeably different standard deviation and variance values between MATLAB and Python unless you specify \`ddof=1\`:

\`np.std(x, ddof=1)\`

The same applies to \`var\`.

**The fix:** Our converter flags every \`std\` and \`var\` call with "add ddof=1 to match MATLAB (which divides by N-1)."`,
    },
    {
      heading: 'Why automated converters miss these',
      body: `AI-based converters like CodeConvert.ai and ChatGPT often produce code that has these exact bugs. The syntax is correct Python, so it runs without errors. But the results are subtly wrong because the AI does not consistently track the behavioral differences between MATLAB and Python functions.

A deterministic converter with a curated mapping table catches these because each function is individually mapped with its known differences documented. \`cov\` always gets the row-vs-column flag. \`eig\` always gets the sort-order flag. \`std\` always gets the ddof flag. Nothing is left to chance.

This is why our converter flags items for review instead of silently converting them. A flag that says "verify the reshape ordering" takes 30 seconds to check. A silent wrong reshape that goes undetected costs days of debugging.`,
    },
    {
      heading: 'Try it on your code',
      body: `Paste a MATLAB function into the converter and check the flags. Each one identifies a specific difference between MATLAB and Python behavior that could produce wrong results. The flags are not errors — they are the converter protecting you from silent bugs.`,
    },
  ],
}
