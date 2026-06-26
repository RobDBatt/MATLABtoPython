export const article = {
  slug: 'matlab-sprintf-num2str-python',
  title: 'MATLAB sprintf and num2str to Python: f-strings and str()',
  description:
    'Convert MATLAB sprintf and num2str to Python. Map the % format specifiers to f-strings, handle num2str precision, and format arrays with the right Python idiom.',
  publishedAt: '2026-06-26',
  keyword: 'matlab sprintf python',
  sections: [
    {
      heading: 'sprintf → f-strings',
      body: `MATLAB's \`sprintf\` builds a formatted string. The most direct Python translation keeps the old \`%\` syntax, but the **idiomatic** target is an f-string:

\`\`\`matlab
% MATLAB
n = 5; t = 12.5;
msg = sprintf('%d items, %.2f total', n, t);
\`\`\`

\`\`\`python
# Python — % style works...
msg = '%d items, %.2f total' % (n, t)

# ...but f-strings are the modern idiom
msg = f'{n} items, {t:.2f} total'
\`\`\`

Both produce \`'5 items, 12.50 total'\`. The converter emits the \`%\` form (a faithful 1:1 mapping); prefer the f-string when you're cleaning up the result.`,
    },
    {
      heading: 'Format specifier cheat sheet',
      body: `The conversion specifiers carry over almost unchanged — they move inside \`{...:}\` in an f-string:

| MATLAB | % style | f-string |
|---|---|---|
| \`%d\` | \`%d\` | \`{x:d}\` or \`{x}\` |
| \`%.2f\` | \`%.2f\` | \`{x:.2f}\` |
| \`%5.2f\` | \`%5.2f\` | \`{x:5.2f}\` |
| \`%e\` | \`%e\` | \`{x:e}\` |
| \`%g\` | \`%g\` | \`{x:g}\` |
| \`%s\` | \`%s\` | \`{x}\` or \`{x:s}\` |
| \`%x\` | \`%x\` | \`{x:x}\` |
| \`%%\` | \`%%\` | \`%\` (literal) |

One real difference: MATLAB's \`sprintf\` **recycles the format** over a vector — \`sprintf('%d ', [1 2 3])\` gives \`'1 2 3 '\`. Python doesn't; use \`' '.join(...)\`:

\`\`\`python
msg = ' '.join(f'{v}' for v in [1, 2, 3])   # '1 2 3'
\`\`\``,
    },
    {
      heading: 'num2str → str(), with a precision caveat',
      body: `\`num2str\` converts a number to text. The quick map is \`str()\`, but watch the precision:

\`\`\`matlab
% MATLAB
s = num2str(3.14159)    % '3.1416'  (≈5 significant digits by default)
s2 = num2str(pi, 8)     % '3.1415927'  (explicit precision)
\`\`\`

\`\`\`python
# Python
s  = str(3.14159)        # '3.14159'  — note: NOT rounded to 5 sig figs
s2 = f'{np.pi:.8g}'      # '3.1415927'  — control precision with :g
\`\`\`

\`str()\` and \`num2str()\` don't round the same way, so if your output is compared as text (filenames, labels, test fixtures), use an explicit f-string format (\`:.4g\`, \`:.2f\`) rather than bare \`str()\`.`,
    },
    {
      heading: 'Formatting arrays: mat2str and beyond',
      body: `For turning a whole array into a string, \`num2str\`/\`mat2str\` map to NumPy's own formatters:

\`\`\`matlab
% MATLAB
mat2str([1 2; 3 4])     % '[1 2;3 4]'
\`\`\`

\`\`\`python
# Python
import numpy as np
np.array2string(np.array([[1, 2], [3, 4]]))   # readable
repr(np.array([[1, 2], [3, 4]]))              # round-trippable
\`\`\`

And the very common \`disp(['Result: ' num2str(x)])\` (string concatenation with a number) becomes a clean f-string: \`print(f'Result: {x}')\`.`,
    },
    {
      heading: 'Convert your formatting code automatically',
      body: `The [MATLAB-to-Python converter](/convert) maps \`sprintf\` to Python string formatting and \`num2str\` to \`str()\` in one pass. For polished output, sweep the result and promote \`%\`-style formatting to f-strings — it's the idiom every Python reviewer expects.`,
    },
  ],
}
