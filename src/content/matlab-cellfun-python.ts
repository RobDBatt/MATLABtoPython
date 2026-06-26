export const article = {
  slug: 'matlab-cellfun-python',
  title: 'MATLAB cellfun to Python: list comprehensions over cell arrays',
  description:
    'Convert MATLAB cellfun to Python. A cell array becomes a list, and cellfun becomes a list comprehension. Handles UniformOutput and the common string/length cases.',
  publishedAt: '2026-06-26',
  keyword: 'matlab cellfun python',
  sections: [
    {
      heading: 'cell array → list, cellfun → comprehension',
      body: `A MATLAB cell array maps to a Python **list**, and \`cellfun\` (apply a function to every cell) maps to a **list comprehension**. That's the whole idea:

\`\`\`matlab
% MATLAB
C = {'aa', 'bbb', 'c'};
lens = cellfun(@length, C);   % [2 3 1]
\`\`\`

\`\`\`python
# Python
C = ['aa', 'bbb', 'c']
lens = [len(x) for x in C]    # [2, 3, 1]
\`\`\`

\`cellfun(@fn, C)\` is exactly \`[fn(x) for x in C]\`. If you want a NumPy array of the results (numeric case), wrap it: \`np.array([len(x) for x in C])\`.`,
    },
    {
      heading: 'UniformOutput=false → keep it a list',
      body: `By default \`cellfun\` expects each result to be a scalar and returns a numeric array. When results vary in size/type you pass \`'UniformOutput', false\` and get a cell back — in Python, just leave it as a list:

\`\`\`matlab
% MATLAB
up = cellfun(@upper, C, 'UniformOutput', false);   % {'AA','BBB','C'}
\`\`\`

\`\`\`python
# Python
up = [x.upper() for x in C]    # ['AA', 'BBB', 'C']
\`\`\`

Same rule as \`arrayfun\`: default → \`np.array([...])\`; \`UniformOutput=false\` → plain \`[...]\`.`,
    },
    {
      heading: 'Anonymous functions and multiple cell inputs',
      body: `Anonymous functions become lambdas or inline expressions; multiple cell inputs become \`zip\`:

\`\`\`matlab
% MATLAB
names = {'Alice','Bob'};
ages  = {30, 25};
labels = cellfun(@(n,a) sprintf('%s:%d', n, a), names, ages, ...
                 'UniformOutput', false);
\`\`\`

\`\`\`python
# Python
names = ['Alice', 'Bob']
ages  = [30, 25]
labels = [f'{n}:{a}' for n, a in zip(names, ages)]
\`\`\`

For two or more cell-array arguments, \`zip\` pairs the elements the way \`cellfun\` lines them up positionally.`,
    },
    {
      heading: 'isempty, ischar, and predicate cellfun',
      body: `A very common pattern is \`cellfun\` with a test, to filter or check a cell array:

\`\`\`matlab
% MATLAB
mask  = cellfun(@isempty, C);          % logical array
keep  = C(~cellfun(@isempty, C));      % drop empties
\`\`\`

\`\`\`python
# Python
mask = np.array([len(x) == 0 for x in C])
keep = [x for x in C if len(x) != 0]    # drop empties directly
\`\`\`

In Python you often skip the mask entirely and filter inside the comprehension with \`if\` — more direct than building a logical array and indexing with it.

> Note: the converter currently leaves \`cellfun\` for manual translation (the right target — comprehension vs array vs filter — depends on intent), so convert these by hand using the patterns above.`,
    },
    {
      heading: 'Convert the surrounding code automatically',
      body: `The [MATLAB-to-Python converter](/convert) handles the mechanical parts of your script; translate the \`cellfun\` calls with the comprehension patterns here. Once you internalize "cell array = list, cellfun = comprehension," these conversions become muscle memory.`,
    },
  ],
}
