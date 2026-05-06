export const article = {
  slug: 'matlab-1-indexed-to-python-0-indexed',
  title: 'MATLAB 1-Indexed to Python 0-Indexed: The Complete Migration Guide',
  description: 'The single biggest source of bugs when converting MATLAB to Python. Every indexing pattern, every gotcha, every pattern for the `end` keyword — with copy-paste conversions.',
  publishedAt: '2026-04-17',
  keyword: 'matlab 1 indexed python 0 indexed',
  sections: [
    {
      heading: 'The one rule that causes 80% of porting bugs',
      body: `MATLAB counts from 1. Python counts from 0. That single difference is responsible for more silent bugs in ported MATLAB code than everything else combined.

In MATLAB:
\`\`\`matlab
v = [10 20 30 40];
v(1)    % → 10
v(end)  % → 40
\`\`\`

In Python (numpy):
\`\`\`python
import numpy as np
v = np.array([10, 20, 30, 40])
v[0]    # → 10
v[-1]   # → 40
\`\`\`

The problem isn't the first example. It's the loop:

\`\`\`matlab
% MATLAB — runs 10 iterations, i = 1..10
for i = 1:10
    A(i) = ...
end
\`\`\`

\`\`\`python
# Python — runs 10 iterations, i = 0..9
for i in range(10):
    A[i] = ...
\`\`\`

Same loop count. Same result. But if you mechanically translate \`1:10\` to \`range(1, 11)\` AND keep the \`A(i)\` indexing as \`A[i]\`, you'll now read \`A[10]\` on the last iteration and crash or silently grab the wrong element. The fix isn't pick-one-or-the-other — it's **consistent shifting at the index site**, not the loop variable.`,
    },
    {
      heading: 'The five indexing patterns you need to know',
      body: `**1. Scalar index**

\`\`\`matlab
v(k)       →  v[k-1]     % if k is a variable
v(3)       →  v[2]       % if it's a literal
\`\`\`

**2. Last element**

\`\`\`matlab
v(end)     →  v[-1]
v(end-1)   →  v[-2]
v(end-k)   →  v[-(k+1)]  % shift the offset too
\`\`\`

**3. Range slice**

\`\`\`matlab
v(2:5)     →  v[1:5]     % start shifted, end NOT shifted (Python excludes end)
v(1:end)   →  v[:]       % all elements
v(1:end-1) →  v[:-1]     % all but last
v(end:-1:1) → v[::-1]    % reverse
\`\`\`

**4. 2D indexing**

\`\`\`matlab
A(i, j)         →  A[i-1, j-1]
A(i, :)         →  A[i-1, :]      % whole row
A(:, j)         →  A[:, j-1]      % whole column
A(1:3, 2:end)   →  A[0:3, 1:]     % submatrix
\`\`\`

**5. Logical indexing**

MATLAB and Python actually agree here — both work:

\`\`\`matlab
v(v > 0)   →  v[v > 0]
\`\`\`

No shifting needed. Logical masks are interpreted positionally the same way in both languages.`,
    },
    {
      heading: 'The `end` keyword, decoded',
      body: `MATLAB's \`end\` inside an index means "the last index of this dimension." Python doesn't have it — you use negative indexing instead.

| MATLAB | Python | Meaning |
|---|---|---|
| \`v(end)\` | \`v[-1]\` | Last element |
| \`v(end-2)\` | \`v[-3]\` | Third-from-last |
| \`v(end-k)\` | \`v[-(k+1)]\` | k-back-from-end (with expression) |
| \`A(end, :)\` | \`A[-1, :]\` | Last row |
| \`A(:, end)\` | \`A[:, -1]\` | Last column |
| \`v(5:end)\` | \`v[4:]\` | From 5 to end |
| \`v(end-4:end)\` | \`v[-5:]\` | Last five |
| \`v(1:end-1)\` | \`v[:-1]\` | All but last |

The tricky case is when \`end\` is part of an arithmetic expression *and* the offset is a variable. In MATLAB:

\`\`\`matlab
v(end-n)
\`\`\`

Python needs \`-(n+1)\`:

\`\`\`python
v[-(n+1)]
\`\`\`

If you forget the \`+1\`, you're off by one. This bug is especially nasty because it passes visual inspection.`,
    },
    {
      heading: 'Reverse iteration',
      body: `Reverse loops are common in MATLAB (\`for i = n:-1:1\`) and trivial to botch.

\`\`\`matlab
% Iterate backwards, 1-based
for i = n:-1:1
    A(i) = 0;
end
\`\`\`

\`\`\`python
# Iterate backwards, 0-based
for i in range(n - 1, -1, -1):
    A[i] = 0
\`\`\`

Or idiomatically:

\`\`\`python
for i in reversed(range(n)):
    A[i] = 0
\`\`\`

The reverse-slice idiom \`v(end:-1:1)\` in MATLAB maps to \`v[::-1]\` in Python — much cleaner.`,
    },
    {
      heading: 'The for-loop variable trap',
      body: `This is the most common bug in hand-converted MATLAB code:

\`\`\`matlab
for i = 1:10
    A(i) = 2 * i;
end
\`\`\`

Tempting, and wrong:
\`\`\`python
for i in range(1, 11):       # DON'T
    A[i] = 2 * i              # will crash — A[10] is out of bounds
\`\`\`

Correct:
\`\`\`python
for i in range(10):          # i = 0..9
    A[i] = 2 * (i + 1)        # still computing with the 1-based "i" for math
\`\`\`

Or, keep the loop variable 1-based and shift only at the index:
\`\`\`python
for i in range(1, 11):       # i = 1..10
    A[i - 1] = 2 * i
\`\`\`

Both are correct. The second version is what automated converters produce because it lets the math in the loop body survive untouched — you only shift at the subscript site. We chose this convention for [our converter](/convert) because it means the user's original formulas read identically after translation.`,
    },
    {
      heading: 'Growing arrays: a MATLAB-ism with a different Python idiom',
      body: `MATLAB lets you assign past the end of an array and it grows:

\`\`\`matlab
A = [];
A(end+1) = 1;  % A is now [1]
A(end+1) = 2;  % A is now [1 2]
\`\`\`

NumPy arrays have fixed size — \`A[2] = 3\` on a length-2 array raises \`IndexError\`. The Python idiom is a list, then convert:

\`\`\`python
A = []
A.append(1)
A.append(2)
A = np.array(A)
\`\`\`

Automated converters handle the common patterns (\`A = [A, x]\` → \`A.append(x)\`) but the \`A(end+1) = x\` form requires rewriting the surrounding context. Always worth double-checking.`,
    },
    {
      heading: 'A rule of thumb that prevents most bugs',
      body: `When porting MATLAB by hand:

1. **Shift indices, not loop variables.** Keep \`for i = 1:n\` as-is mentally and translate the \`A(i)\` to \`A[i-1]\`. Don't try to shift everything.
2. **Treat \`end\` like -1.** Every \`end-k\` becomes \`-(k+1)\`.
3. **Include end in slices carefully.** MATLAB \`v(a:b)\` includes \`b\`; Python \`v[a:b]\` excludes \`b\`. Always add 1 to the stop.
4. **Review logical indexing — it's the same in both.** You don't need to change \`v(v > 0)\` → \`v[v > 0]\`, which is a happy place.

If you'd rather not do any of this manually, [the converter at mtopython.com](/convert) applies these rules systematically and flags any index expression complex enough to need human review. It'll tell you when it's shifting, when it's not, and why.`,
    },
  ],
}
