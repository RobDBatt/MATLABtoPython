export const article = {
  slug: 'matlab-regexprep-python',
  title: 'MATLAB regexprep to Python: re.sub, arg order, and backreferences',
  description:
    'Convert MATLAB regexprep to Python re.sub. Mind the reversed argument order, use raw strings for patterns, and translate $1 backreferences to \\1. Plus regexp to re.findall.',
  publishedAt: '2026-06-26',
  keyword: 'matlab regexprep python',
  sections: [
    {
      heading: 'regexprep → re.sub — but the arguments are reordered',
      body: `MATLAB's \`regexprep\` maps to Python's \`re.sub\`, with a critical reordering: **MATLAB puts the string first; \`re.sub\` puts it last.**

\`\`\`matlab
% MATLAB:  regexprep(STRING, pattern, replacement)
s = 'hello   world';
out = regexprep(s, '\\s+', '_');     % 'hello_world'
\`\`\`

\`\`\`python
# Python:  re.sub(pattern, replacement, STRING)
import re

s = 'hello   world'
out = re.sub(r'\\s+', '_', s)        # 'hello_world'
\`\`\`

So \`regexprep(s, pat, rep)\` → \`re.sub(pat, rep, s)\`. Translating it positionally (string first) is a silent bug — it runs but treats your string as the pattern. Always move the string to the **last** argument.`,
    },
    {
      heading: 'Use raw strings for patterns',
      body: `MATLAB regex strings and Python regex strings share the same metacharacters (\`\\s\`, \`\\d\`, \`\\w\`, \`+\`, \`*\`, \`[...]\`), but Python needs **raw strings** (\`r'...'\`) so the backslashes survive:

\`\`\`python
re.sub(r'\\d+', '#', s)        # raw string — \\d stays \\d
re.sub('\\d+', '#', s)         # works, but escape-prone; avoid
\`\`\`

Without the \`r\`, \`'\\d'\` can be mangled by Python's own string escaping before the regex engine ever sees it. Make \`r'...'\` a habit for every pattern.`,
    },
    {
      heading: 'Backreferences: $1 becomes \\1',
      body: `In the **replacement** string, MATLAB uses \`$1\`, \`$2\` for captured groups; Python uses \`\\1\`, \`\\2\` (or \`\\g<1>\`):

\`\`\`matlab
% MATLAB — swap "user@host" to "host.user"
t = regexprep('alice@example', '(\\w+)@(\\w+)', '$2.$1');
\`\`\`

\`\`\`python
# Python
t = re.sub(r'(\\w+)@(\\w+)', r'\\2.\\1', 'alice@example')   # 'example.alice'
\`\`\`

Note the replacement is also a raw string. \`$1\` → \`\\1\`, \`$2\` → \`\\2\`, and named groups \`$<name>\` → \`\\g<name>\`.`,
    },
    {
      heading: 'Options, and the regexp family',
      body: `Case-insensitive and other modes move from trailing options to the \`flags\` argument:

\`\`\`matlab
out = regexprep(s, 'abc', 'x', 'ignorecase');
\`\`\`

\`\`\`python
out = re.sub(r'abc', 'x', s, flags=re.IGNORECASE)
\`\`\`

The rest of the family maps cleanly: \`regexp(s, pat, 'match')\` → \`re.findall(pat, s)\`; \`regexp(s, pat, 'tokens')\` → \`re.findall\` with groups; \`regexp(s, pat, 'once')\` → \`re.search\`; \`regexp\` for positions → \`[m.start() for m in re.finditer(pat, s)]\` (0-based — add 1 for MATLAB-style positions).

> Heads-up: regex conversion is one place to convert deliberately — the argument order, raw strings, and \`$\`→\`\\\` backreference change all need a human eye.`,
    },
    {
      heading: 'Convert your code automatically',
      body: `The [MATLAB-to-Python converter](/convert) handles the bulk of your script; apply the \`re.sub\` patterns here for regex calls, watching the three differences that matter most: **string goes last, patterns are raw strings, and \`$1\` becomes \`\\1\`.**`,
    },
  ],
}
