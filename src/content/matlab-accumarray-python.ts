export const article = {
  slug: 'matlab-accumarray-python',
  title: 'MATLAB accumarray to Python: np.bincount, np.add.at, pandas groupby',
  description:
    'Convert MATLAB accumarray to Python. Use np.bincount with weights for sums (mind the 1-based subscripts), np.add.at for in-place accumulation, and pandas groupby for other reducers.',
  publishedAt: '2026-06-26',
  keyword: 'matlab accumarray python',
  sections: [
    {
      heading: 'The sum case: np.bincount with weights',
      body: `\`accumarray\` groups values by subscript and reduces each group (sum by default). NumPy has no single equivalent, but for the common **sum** case, \`np.bincount\` with \`weights\` is the fast, direct answer:

\`\`\`matlab
% MATLAB
subs = [1; 2; 1; 3];
vals = [10; 20; 30; 40];
totals = accumarray(subs, vals);
% totals = [40; 20; 40]   (group 1: 10+30, group 2: 20, group 3: 40)
\`\`\`

\`\`\`python
# Python
import numpy as np

subs = np.array([1, 2, 1, 3])
vals = np.array([10, 20, 30, 40])
totals = np.bincount(subs - 1, weights=vals)
# array([40., 20., 40.])
\`\`\`

There's no built-in for this in plain NumPy other than \`bincount\` — it's the idiomatic choice for grouped sums.`,
    },
    {
      heading: 'The 1-based subscript gotcha',
      body: `MATLAB subscripts are **1-based**; \`np.bincount\` produces a bin for every index from \`0\`. If you pass \`subs\` straight through, you get a spurious leading zero and everything shifts:

\`\`\`python
np.bincount(subs, weights=vals)        # [ 0. 40. 20. 40.]  ← wrong: extra bin 0
np.bincount(subs - 1, weights=vals)    # [40. 20. 40.]       ← right
\`\`\`

Subtract one from \`subs\` so MATLAB group 1 maps to Python bin 0. This is the single most common mistake porting \`accumarray\`.`,
    },
    {
      heading: 'Counting and in-place accumulation',
      body: `\`accumarray(subs, 1)\` (counting occurrences) is just \`bincount\` with no weights:

\`\`\`matlab
counts = accumarray(subs, 1);   % how many in each group
\`\`\`

\`\`\`python
counts = np.bincount(subs - 1)  # [2 1 1]
\`\`\`

For accumulating into an existing array (or when you'd rather be explicit), \`np.add.at\` does an unbuffered in-place scatter-add — the closest structural twin to \`accumarray\`:

\`\`\`python
out = np.zeros(subs.max())
np.add.at(out, subs - 1, vals)  # out[i] += vals where subs-1 == i
\`\`\``,
    },
    {
      heading: 'Other reducers: pandas groupby',
      body: `\`accumarray\` takes a function handle (\`@max\`, \`@mean\`, etc.) as a fourth argument. \`bincount\` only sums, so for any other reducer reach for **pandas**:

\`\`\`matlab
% MATLAB — max within each group
peaks = accumarray(subs, vals, [], @max);
means = accumarray(subs, vals, [], @mean);
\`\`\`

\`\`\`python
# Python — pandas groupby handles any reducer
import pandas as pd
g = pd.Series(vals).groupby(subs - 1)
peaks = g.max().to_numpy()
means = g.mean().to_numpy()
\`\`\`

For heavy use or multi-dimensional subscripts, the \`numpy-groupies\` package provides an \`aggregate()\` that mirrors \`accumarray\` directly. But for the everyday sum/count/mean cases, \`bincount\` + \`groupby\` cover it.`,
    },
    {
      heading: 'Convert your MATLAB code automatically',
      body: `\`accumarray\` has no one-line NumPy twin, so convert it deliberately with the patterns above — \`bincount\` for sums/counts, \`groupby\` for everything else, and always \`subs - 1\` for the 1-based offset. Paste the [rest of your script into the converter](/convert) to handle the mechanical parts around it.`,
    },
  ],
}
