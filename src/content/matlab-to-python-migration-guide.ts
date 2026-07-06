export const article = {
  slug: 'matlab-to-python-migration-guide',
  title: 'MATLAB to Python Migration Guide 2026: The Complete Walkthrough',
  description: 'The complete guide for engineers migrating from MATLAB to Python in 2026. Environment setup, syntax, indexing, toolboxes, and a realistic strategy for real codebases.',
  publishedAt: '2026-05-09',
  keyword: 'matlab to python migration',
  sections: [
    {
      heading: 'Why 2026 is the inflection point',
      body: `In January 2026, MathWorks discontinued perpetual Home and Student licenses and now steers new commercial buyers toward annual subscriptions — roughly $860/year per seat for base MATLAB, far more with toolboxes (a perpetual commercial seat is still sold at around $2,150 one-time). For a team of ten engineers running Simulink and a couple of toolboxes, that's $40,000+ annually, recurring, just to keep existing code running.

Python has been the dominant scientific computing language for years. NumPy, SciPy, matplotlib, pandas, scikit-learn, PyTorch — the Python scientific stack covers everything MATLAB does, and more. The migration cost is real but it's a one-time investment, not a recurring fee.

This guide gives you the complete picture: environment, syntax, the major gotchas, a toolbox-by-toolbox replacement map, and a realistic strategy for migrating code that's actually used in production.`,
    },
    {
      heading: 'Environment setup: Anaconda, pip, and virtual environments',
      body: `MATLAB ships as a single package. Python requires assembling the stack. Here's what you actually need:

\`\`\`bash
# Install Miniconda (lightweight Anaconda)
# Download from: https://docs.conda.io/en/latest/miniconda.html

# Create an environment matching your MATLAB toolbox usage
conda create -n matlab-migration python=3.12
conda activate matlab-migration

# Core scientific stack (replaces MATLAB + Statistics + Optimization)
pip install numpy scipy matplotlib pandas scikit-learn

# Toolbox-specific packages
pip install scikit-image          # Image Processing Toolbox
pip install python-control        # Control System Toolbox
pip install sympy                 # Symbolic Math Toolbox
pip install pywavelets            # Wavelet Toolbox

# Development tools
pip install jupyter notebook      # MATLAB-like interactive workflow
pip install spyder                # MATLAB-like IDE (optional)
\`\`\`

**Recommended editor:** VS Code with the Python extension, or JupyterLab for exploratory work. Spyder is the closest to the MATLAB desktop environment if your team needs the familiar layout during transition.`,
    },
    {
      heading: 'The six core syntax differences',
      body: `**1. Indexing: 1-based vs 0-based**

This is the biggest source of bugs in MATLAB migrations. Every array index shifts by 1.

\`\`\`matlab
% MATLAB
v = [10, 20, 30, 40];
first = v(1);        % 10
last  = v(end);      % 40
slice = v(2:3);      % [20, 30]
\`\`\`

\`\`\`python
# Python
v = np.array([10, 20, 30, 40])
first = v[0]         # 10
last  = v[-1]        # 40
slice = v[1:3]       # [20, 30]  — end is exclusive
\`\`\`

**2. Matrix multiply: \`*\` vs \`@\`**

\`\`\`matlab
C = A * B;           % matrix multiply
D = A .* B;          % element-wise multiply
\`\`\`

\`\`\`python
C = A @ B            # matrix multiply
D = A * B            # element-wise multiply (NumPy default)
\`\`\`

**3. Semicolons: output suppression vs statement separation**

In MATLAB, \`;\` at the end of a line suppresses console output. In Python, there's no console output by default — semicolons are optional and have no effect in scripts.

**4. Logical NOT: \`~\` vs \`not\` / \`~\`**

\`\`\`matlab
if ~isempty(x)    % MATLAB logical not
\`\`\`

\`\`\`python
if len(x) > 0:    # Python — explicit check
if not x:         # works for lists; careful with NumPy arrays
if x.size > 0:    # safest for NumPy arrays
\`\`\`

**5. Boolean short-circuit: \`&&\`/\`||\` vs \`and\`/\`or\`**

\`\`\`matlab
if a > 0 && b > 0    % MATLAB scalar short-circuit
\`\`\`

\`\`\`python
if a > 0 and b > 0:  # Python — works for scalars
# For NumPy arrays, use np.logical_and(a, b) or (a > 0) & (b > 0)
\`\`\`

**6. String quotes: single vs double**

\`\`\`matlab
s = 'hello';          % MATLAB: single quotes for char
s = "hello";          % MATLAB R2016b+: double quotes for string object
\`\`\`

\`\`\`python
s = 'hello'           # Python: both work, single preferred by convention
s = "hello"
\`\`\``,
    },
    {
      heading: 'Toolbox replacement map',
      body: `| MATLAB Toolbox | Python replacement | Install |
|---|---|---|
| Core (matrices, linear algebra) | NumPy + SciPy | \`pip install numpy scipy\` |
| Statistics Toolbox | scipy.stats + pandas | \`pip install scipy pandas\` |
| Signal Processing Toolbox | scipy.signal | included with scipy |
| Image Processing Toolbox | scikit-image | \`pip install scikit-image\` |
| Optimization Toolbox | scipy.optimize | included with scipy |
| Control System Toolbox | python-control | \`pip install python-control\` |
| Symbolic Math Toolbox | SymPy | \`pip install sympy\` |
| Deep Learning Toolbox | PyTorch or Keras/TensorFlow | \`pip install torch\` |
| Curve Fitting Toolbox | scipy.optimize + scipy.interpolate | included with scipy |
| Parallel Computing Toolbox | joblib, multiprocessing, or dask | \`pip install joblib\` |
| Wavelet Toolbox | PyWavelets | \`pip install pywavelets\` |

For functions with no direct equivalent, use \`scipy.special\`, \`statsmodels\`, or search PyPI. The Python ecosystem is larger than MATLAB's — most niche functions have been implemented.`,
    },
    {
      heading: 'The migration workflow: file by file',
      body: `Don't try to migrate everything at once. Use this workflow:

**Step 1: Inventory your codebase**

Run a directory scan to list all \`.m\` files and their sizes. Sort by lines of code — migrate the simplest functions first to build confidence and test coverage.

**Step 2: Use the converter for first-pass conversion**

Paste each \`.m\` file into the [converter at mtopython.com/convert](/convert). The converter produces a Python file with:
- All registry-mapped functions replaced with correct NumPy/SciPy equivalents
- 0-based indexing applied
- Imports injected
- \`# TODO:\` flags on anything that needs manual attention

**Step 3: Fix the flagged items**

Each \`# TODO:\` flag identifies a construct the converter couldn't translate automatically — OOP patterns, \`eval()\` calls, complex \`nargin\` logic. Address these manually.

**Step 4: Write tests before the conversion, verify after**

The most reliable migration strategy: capture the MATLAB output for a set of representative inputs, then verify the Python function produces the same values. Even simple numerical assertions catch most bugs.

**Step 5: Migrate in layers, not all at once**

Keep the MATLAB version running in production until the Python version is validated. Call Python from MATLAB (or vice versa) during the transition if needed.`,
    },
    {
      heading: 'The indexing pitfall in detail',
      body: `1-based to 0-based indexing is the source of 80% of migration bugs. Here's every pattern you need to know:

\`\`\`matlab
% MATLAB indexing patterns
v(1)        → v[0]          % first element
v(end)      → v[-1]         % last element
v(end-1)    → v[-2]         % second to last
v(2:5)      → v[1:5]        % elements 2,3,4,5 (MATLAB inclusive both ends)
v(1:2:end)  → v[0::2]       % every other element from start
A(i, j)     → A[i-1, j-1]  % 2D matrix element
A(:, 2)     → A[:, 1]       % second column
A(end, :)   → A[-1, :]      % last row
\`\`\`

**For loops:** MATLAB \`for i = 1:n\` is typically converted to \`for i in range(1, n+1):\` (keeping the 1-based variable) so array indexing with \`A[i-1]\` is still correct. Alternatively, rewrite to \`for i in range(n):\` and update all index expressions to \`A[i]\`.

The converter chooses the 1-based loop variable approach to minimize the number of index changes throughout the function body.`,
    },
    {
      heading: 'Handling MATLAB-specific patterns with no Python equivalent',
      body: `Some MATLAB patterns don't map cleanly and need judgment calls:

**\`nargin\` / optional arguments:**

\`\`\`matlab
function y = foo(x, n)
    if nargin < 2, n = 10; end
    y = x + n;
end
\`\`\`

\`\`\`python
def foo(x, n=10):     # Python default argument — cleaner
    return x + n
\`\`\`

**\`eval()\` and \`feval()\`:** Avoid these in Python too — use a dispatch dict or \`getattr\`.

**\`global\` variables:** Refactor to pass parameters explicitly. MATLAB global state causes the same bugs in Python.

**\`fprintf\`:** Map to Python \`print()\` for stdout, or f-strings:

\`\`\`matlab
fprintf('Value: %.3f\\n', x);
\`\`\`

\`\`\`python
print(f'Value: {x:.3f}')
\`\`\`

**Handle classes (\`@myClass\`):** Convert to Python classes using \`class\`. MATLAB handle semantics (reference behaviour) maps to normal Python object references.`,
    },
    {
      heading: 'Start the migration now',
      body: `The migration from MATLAB to Python in 2026 is well-trodden territory. The ecosystem is mature, the toolboxes are mapped, and the converter does the mechanical work.

Typical migration results:
- **66.7% of real-world MATLAB files** compile to valid, flag-free Python on the first pass, needing zero review — and 94.9% produce valid Python overall (measured against 1,062 files from public research repositories); the rest gets flagged instead of silently guessed wrong
- **Most remaining issues** are OOP patterns, eval() usage, or toolbox functions requiring manual mapping
- **Average review time:** 20–30 minutes per 200-line function for flagged items

Paste your MATLAB code into the [free converter at mtopython.com/convert](/convert) to get Python output, a full compatibility report, and a checklist of items needing manual review. Free for 50 lines; file upload for full migrations.`,
    },
  ],
}
