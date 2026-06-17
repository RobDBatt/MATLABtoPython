export const article = {
  slug: 'matlab-cell-arrays-to-python',
  title: 'MATLAB Cell Arrays in Python: Lists, Dicts, and NumPy Object Arrays',
  description: 'Cell arrays are MATLAB\'s heterogeneous container. In Python use lists, dicts, or NumPy object arrays. Learn which to use and how to convert your existing code.',
  publishedAt: '2026-05-09',
  keyword: 'matlab cell array python equivalent',
  sections: [
    {
      heading: 'What cell arrays actually are — and why Python has three replacements',
      body: `A MATLAB cell array is an ordered container that holds elements of different types: numbers, strings, matrices, other cell arrays. Think of it as a matrix where each slot holds an arbitrary value instead of a scalar.

Python has no single equivalent because different uses of cell arrays call for different structures:

| MATLAB cell array pattern | Python replacement |
|---|---|
| \`{'hello', 'world', 'foo'}\` — list of strings | \`['hello', 'world', 'foo']\` — Python list |
| \`{1, 'text', [1 2 3]}\` — mixed bag | \`[1, 'text', np.array([1,2,3])]\` — Python list |
| \`C{i}\` in a for loop | \`c[i]\` — list indexing |
| \`cellfun(@func, C)\` | \`[func(x) for x in c]\` — list comprehension |
| \`C = cell(m, n)\` — 2D cell grid | \`np.empty((m, n), dtype=object)\` — NumPy object array |
| Named fields per element | \`[{'name': ..., 'val': ...}]\` — list of dicts |

The most common case — a list of strings or a list of mixed values — is just a Python list.`,
    },
    {
      heading: 'Curly brace indexing: C{i} to c[i-1]',
      body: `MATLAB uses \`{}\` for value access and \`()\` for sub-array extraction. Python uses \`[]\` for both, with the standard 0-based offset:

\`\`\`matlab
% MATLAB
C = {'apple', 'banana', 'cherry'};
first = C{1};       % 'apple'   — 1-based
last  = C{end};     % 'cherry'
sub   = C(1:2);     % {'apple', 'banana'} — still a cell array
\`\`\`

\`\`\`python
# Python
c = ['apple', 'banana', 'cherry']
first = c[0]        # 'apple'   — 0-based
last  = c[-1]       # 'cherry'
sub   = c[0:2]      # ['apple', 'banana'] — already a list
\`\`\`

**The golden rule:** every \`C{i}\` in MATLAB becomes \`c[i-1]\` in Python. The converter applies this automatically, but confirm it in any performance-critical loop.`,
    },
    {
      heading: 'Creating and growing cell arrays',
      body: `\`\`\`matlab
% MATLAB — pre-allocate and fill
C = cell(1, 5);
for i = 1:5
    C{i} = i^2;
end

% Append
C{end+1} = 99;

% 2D cell array
grid = cell(3, 4);
grid{2, 3} = 'hello';
\`\`\`

\`\`\`python
# Python — lists grow dynamically (no pre-allocation needed)
c = [i**2 for i in range(1, 6)]    # [1, 4, 9, 16, 25]

# Append
c.append(99)                        # in-place
c = c + [99]                        # or create new list

# 2D: use NumPy object array for grid-like access
import numpy as np
grid = np.empty((3, 4), dtype=object)
grid[1, 2] = 'hello'                # 0-based: row 1, col 2 = MATLAB row 2, col 3
\`\`\`

For simple 1D sequences, the Python list is more ergonomic than pre-allocating. Only use a NumPy object array when you need 2D indexed access or want to slice and reshape.`,
    },
    {
      heading: 'cellfun: mapping a function over every element',
      body: `\`cellfun\` applies a function to every cell. Python uses list comprehensions or \`map()\`:

\`\`\`matlab
% MATLAB
words = {'hello', 'world', 'foo'};
lengths = cellfun(@length, words);      % [5, 5, 3]
upper   = cellfun(@upper, words, 'UniformOutput', false);  % {'HELLO','WORLD','FOO'}
\`\`\`

\`\`\`python
# Python — list comprehension (preferred)
words = ['hello', 'world', 'foo']
lengths = [len(w) for w in words]          # [5, 5, 3]
upper   = [w.upper() for w in words]       # ['HELLO', 'WORLD', 'FOO']

# Or use map() for simple single-argument functions:
lengths = list(map(len, words))
\`\`\`

**\`UniformOutput=false\` → always a list in Python.** MATLAB requires \`UniformOutput=false\` when the function returns non-scalars; Python lists always hold anything, so there's no equivalent flag.

For NumPy operations across all elements, \`np.vectorize\` works but is rarely faster than a comprehension:

\`\`\`python
import numpy as np
f = np.vectorize(lambda x: x**2 + 1)
result = f(np.array([1, 2, 3, 4]))   # array([2, 5, 10, 17])
\`\`\``,
    },
    {
      heading: 'Cell arrays of strings: strcmp, strfind, strsplit',
      body: `MATLAB's string-in-cell-array idiom maps cleanly to Python lists of str:

\`\`\`matlab
% MATLAB
labels = {'alpha', 'beta', 'gamma'};
idx    = find(strcmp(labels, 'beta'));    % 2
match  = cellfun(@(s) contains(s,'a'), labels);  % [1 0 1]
joined = strjoin(labels, ', ');          % 'alpha, beta, gamma'
split  = strsplit('a,b,c', ',');         % {'a','b','c'}
\`\`\`

\`\`\`python
# Python
labels = ['alpha', 'beta', 'gamma']
idx    = labels.index('beta')            # 1 (0-based)
match  = ['a' in s for s in labels]     # [True, False, True]
joined = ', '.join(labels)              # 'alpha, beta, gamma'
split  = 'a,b,c'.split(',')            # ['a', 'b', 'c']

# If you need the index (not just True/False):
indices = [i for i, s in enumerate(labels) if 'a' in s]  # [0, 2]
\`\`\``,
    },
    {
      heading: 'Nested cell arrays',
      body: `MATLAB allows cell arrays of cell arrays. Python's lists nest naturally:

\`\`\`matlab
% MATLAB — nested cells
nested = {{1, 2}, {3, 4}, {5, 6}};
val = nested{2}{1};   % 3
\`\`\`

\`\`\`python
# Python — nested lists
nested = [[1, 2], [3, 4], [5, 6]]
val = nested[1][0]    # 3  (0-based on both dimensions)
\`\`\`

For ragged 2D structures (rows of different lengths), a list of lists is the right tool. For rectangular grids where all rows have the same length, consider \`np.array\` or \`np.empty(dtype=object)\`.`,
    },
    {
      heading: 'Convert your cell array code now',
      body: `The mental model: everywhere MATLAB uses \`{}\` for a heterogeneous container, Python uses \`[]\`. The conversion is mechanical:

- \`C{i}\` → \`c[i-1]\`
- \`C(end)\` → \`c[-1]\`
- \`cell(1, n)\` → \`[None] * n\` or \`[]\` + appends
- \`cellfun(@f, C)\` → \`[f(x) for x in c]\`
- 2D cell grid → \`np.empty((m, n), dtype=object)\`

Paste your MATLAB code into the [free converter at mtopython.com/convert](/convert). The converter handles cell array indexing, \`cellfun\`, and \`cell()\` constructor calls automatically, shifting indices from 1-based to 0-based throughout.`,
    },
  ],
}
