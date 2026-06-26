export const article = {
  slug: 'matlab-interp1-python',
  title: 'MATLAB interp1 to Python: np.interp and scipy interp1d',
  description:
    "Convert MATLAB interp1 to Python. Use np.interp for linear (mind the argument order) and scipy.interpolate.interp1d for spline/cubic, plus how to match MATLAB's extrapolation.",
  publishedAt: '2026-06-26',
  keyword: 'matlab interp1 python',
  sections: [
    {
      heading: 'Two replacements, depending on the method',
      body: `MATLAB's \`interp1\` does both simple linear interpolation and higher-order methods. Python splits that across two tools:

- **\`np.interp\`** — fast, linear only. Good for the default \`interp1(x, y, xi)\`.
- **\`scipy.interpolate.interp1d\`** — supports \`'nearest'\`, \`'cubic'\`, spline, and extrapolation control.

Pick \`np.interp\` for plain linear; reach for SciPy the moment a method or extrapolation is involved.`,
    },
    {
      heading: 'The argument-order gotcha (np.interp)',
      body: `This trips up almost every port: **\`np.interp\` takes its arguments in a different order than MATLAB's \`interp1\`.**

\`\`\`matlab
% MATLAB:  interp1(x, y, xi)  →  (sample x, sample y, query points)
x  = [1 2 3 4 5];
y  = [10 20 15 25 30];
xi = [1.5 2.5 3.5];
yi = interp1(x, y, xi);
\`\`\`

\`\`\`python
# Python: np.interp(QUERY, x, y)  →  query points FIRST
import numpy as np

x  = np.array([1, 2, 3, 4, 5])
y  = np.array([10, 20, 15, 25, 30])
xi = np.array([1.5, 2.5, 3.5])
yi = np.interp(xi, x, y)      # note the order: xi, x, y
\`\`\`

MATLAB puts the query points **last**; \`np.interp\` puts them **first**. Translating \`interp1(x, y, xi)\` straight to \`np.interp(x, y, xi)\` runs without error and returns garbage. Always reorder to \`np.interp(xi, x, y)\`.`,
    },
    {
      heading: 'Methods: spline, cubic, nearest (scipy)',
      body: `\`np.interp\` is linear only — it ignores any method argument. For anything else, use \`scipy.interpolate.interp1d\` (note the natural \`(x, y)\` construction, then call with the query points):

\`\`\`matlab
% MATLAB
yc = interp1(x, y, xi, 'spline');
yn = interp1(x, y, xi, 'nearest');
\`\`\`

\`\`\`python
# Python
from scipy.interpolate import interp1d

yc = interp1d(x, y, kind='cubic')(xi)     # 'spline' ≈ cubic
yn = interp1d(x, y, kind='nearest')(xi)
\`\`\`

Method mapping: MATLAB \`'linear'\`→\`kind='linear'\`, \`'nearest'\`→\`'nearest'\`, \`'pchip'\`→use \`scipy.interpolate.PchipInterpolator\`, \`'spline'\`/\`'cubic'\`→\`kind='cubic'\` (or \`CubicSpline\` for a true natural spline).`,
    },
    {
      heading: 'Matching MATLAB extrapolation',
      body: `The behavior outside the data range differs by default, so set it explicitly:

- **MATLAB** \`interp1\` returns \`NaN\` outside \`[x(1), x(end)]\` unless you pass \`'extrap'\`.
- **\`np.interp\`** *clamps* — it returns the first/last \`y\` value outside the range (no NaN). Use the \`left=\`/\`right=\` keywords (e.g. \`left=np.nan, right=np.nan\`) to mimic MATLAB's NaN behavior.
- **\`interp1d\`** raises a \`ValueError\` outside the range unless you pass \`fill_value\`:

\`\`\`python
# MATLAB-style: NaN outside the range
f = interp1d(x, y, kind='cubic', bounds_error=False, fill_value=np.nan)

# MATLAB's 'extrap'
f = interp1d(x, y, kind='cubic', fill_value='extrapolate')
\`\`\`

So \`interp1(x, y, xi, 'spline', 'extrap')\` → \`interp1d(x, y, kind='cubic', fill_value='extrapolate')(xi)\`.`,
    },
    {
      heading: 'Convert your MATLAB code automatically',
      body: `The [MATLAB-to-Python converter](/convert) maps your interpolation calls to NumPy/SciPy. For \`interp1\` specifically, confirm the argument order (\`np.interp\` wants the query points first) and that the method maps to the right \`scipy.interpolate\` call — the two places these conversions most often need a human glance.

Paste your MATLAB into the [converter](/convert) to get a runnable Python starting point fast.`,
    },
  ],
}
