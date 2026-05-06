export const article = {
  slug: 'why-we-built-this',
  title: 'Why We Built a Deterministic MATLAB-to-Python Converter (And Why It Doesn\'t Promise 100%)',
  description: 'MathWorks killed perpetual licenses. Every existing converter is dead or AI-based. We built the tool we wished existed — one that tells you what it can\'t do instead of guessing wrong.',
  publishedAt: '2026-04-13',
  keyword: 'why switch from matlab to python 2026',
  sections: [
    {
      heading: 'The license change that started a migration wave',
      body: `In January 2026, MathWorks ended perpetual MATLAB licenses. Every seat is now subscription-only at $2,000+ per year. Add Simulink, add a toolbox or two, and a 10-person engineering team is looking at $80,000-$100,000 over three years for software they previously bought once.

Python with NumPy, SciPy, and matplotlib does the same computational work for $0. The math has never been clearer: the cost of migrating is a one-time project, the cost of staying is a recurring bill that grows every year.

Research labs, aerospace teams, pharmaceutical companies, and university departments are all having the same conversation. The question is not whether to migrate — it is how.`,
    },
    {
      heading: 'We looked for a converter. There wasn\'t one.',
      body: `The first thing any engineer does when facing a migration is search for a tool. We did the same. Here is what we found:

SMOP, the most promising open-source MATLAB-to-Python compiler, self-describes as "alpha quality" and has not been meaningfully updated. Its output is what the developers call "matlabic" — MATLAB patterns written in Python syntax.

LiberMate is deprecated. Its own developer says to use SMOP instead. It cannot handle \`grid on\` — a command every MATLAB user writes daily.

OMPC, from 2008, does not actually convert MATLAB to Python. It creates a compatibility layer that lets MATLAB code run in a Python interpreter. Your code still looks like MATLAB and depends on an unmaintained runtime library. The online translator shut down in 2021.

The various Mat2py projects on GitHub are abandoned experiments. None have been updated in years. None handle toolbox functions, plotting, or modern MATLAB.

CodeConvert.ai is the only active option, and it is a generic AI wrapper — not MATLAB-specific. It handles 60+ language pairs with the same underlying model. In our testing, it silently dropped 30% of a real MATLAB file without any warning. Run the same code twice and you get different output.

There is no dedicated, actively maintained, MATLAB-specific converter. That is the gap we built into.`,
    },
    {
      heading: 'The design decision: flag, don\'t guess',
      body: `When we started building, we made one decision that shaped everything else: if the converter is not certain a transformation is correct, it flags it for human review instead of guessing.

This sounds obvious but it is the opposite of what AI converters do. An AI always produces output. It never says "I am not sure about this line." It generates something plausible-looking whether it is right or wrong, and you have no way to tell which parts it is confident about.

A deterministic converter applies the same rules every time. \`zeros(3,4)\` always becomes \`np.zeros((3,4))\`. \`for i = 1:10\` always becomes \`for i in range(10)\`. \`butter(4, 0.5)\` always becomes \`signal.butter(4, 0.5)\` with the scipy.signal import added automatically. These rules are tested, predictable, and auditable.

When a construct has a Python equivalent that behaves slightly differently — like \`cov(X)\` where MATLAB treats rows as observations and NumPy treats rows as variables — the converter maps the function name correctly and adds a specific flag: "You may need np.cov(X.T) or np.cov(X, rowvar=False)."

When a construct has no Python equivalent at all — like Simulink model references or MEX file calls — the converter marks it as unsupported and explains why.

The result is output where every converted line is correct and every uncertain line is explicitly marked. You know exactly what to review and what to trust.`,
    },
    {
      heading: 'Why it will never be 100%',
      body: `We get asked this question a lot: why does the converter not produce code that runs without any changes? The answer is that MATLAB and Python are fundamentally different languages, and some of those differences cannot be resolved by any automated tool — deterministic or AI.

**The indexing problem.** MATLAB arrays start at 1. Python arrays start at 0. For literal numbers, the converter shifts automatically: \`A(3)\` becomes \`A[2]\`. For variables, it shifts when it can determine the context: \`A(i)\` becomes \`A[i-1]\` when A is a known array. But for complex expressions like \`A(end-f(x):end)\`, the converter cannot know the value of \`f(x)\` at compile time. It flags these for review because guessing wrong would produce code that silently accesses the wrong element — a bug that might not surface for months.

**The transpose ambiguity.** In MATLAB, the single quote character means both "this is a string" and "transpose this matrix." In \`data'\`, the quote is a transpose. In \`fprintf('hello')\`, the quotes are string delimiters. Context usually makes this clear, but in deeply nested expressions mixing strings and matrix operations, the converter cannot always distinguish them. A proper tokenizer — our planned V2 upgrade — will resolve this for nearly all cases.

**Toolbox function behavior differences.** MATLAB's \`cov(X)\` and NumPy's \`np.cov(X)\` both compute covariance matrices, but they treat rows and columns differently by default. The converter maps the function name and flags the difference. An engineer reads the flag and adds \`rowvar=False\` in 10 seconds. An automated tool that silently picks one behavior or the other has a 50% chance of introducing a bug.

**MATLAB-specific runtime features.** Functions like \`nargin\` (count of input arguments), \`nargout\` (count of output arguments), \`drawnow\` (GUI update), and \`evalin\` (evaluate in workspace) are MATLAB runtime concepts with no Python equivalent. The converter explains what each one does and suggests the Python pattern to use instead, but it cannot make the structural decision for you.

**The honest math:** on a typical modern MATLAB script written in the last 5-10 years, the converter handles 95-100% of the code automatically. The remaining items are flagged with specific explanations and take an engineer 5 minutes each to resolve. For a 500-line file, that is 1-2 hours of review instead of 15-20 hours of manual translation.

A tool that claims 100% conversion is either lying, silently producing bugs, or only tested on toy examples. We chose to be honest about what automation can and cannot do, because engineers deserve to know what they are getting.`,
    },
    {
      heading: 'What we actually built',
      body: `The converter is a 5-stage deterministic pipeline:

**Stage 1: Tokenize.** Join continuation lines, split multi-statement lines, strip semicolons, convert comments.

**Stage 2: Structure.** Detect block boundaries — functions, loops, conditionals, switch/case — and build the indentation tree that Python requires.

**Stage 3: Transform.** Apply 200+ function mappings (NumPy, SciPy, matplotlib, scikit-image, python-control, SymPy, PyWavelets), operator conversions (element-wise vs matrix), constant substitutions, and format string conversions.

**Stage 4: Index shift.** A dedicated pass that converts 1-based to 0-based indexing, tracking which variables are arrays, which are functions, and which indices come from already-0-based sources like \`np.where\`.

**Stage 5: Cleanup.** Inject imports in the correct order, apply Python indentation, remove \`end\` lines, validate syntax, and generate the compatibility report.

The entire pipeline runs at approximately 8,000 lines per second. A 500-line file converts in under 100 milliseconds. A 5,000-line file converts in under a second. The output is identical every time — same input, same output, guaranteed.`,
    },
    {
      heading: 'Who this is for',
      body: `This tool is for engineers and researchers who are migrating real MATLAB code to Python and need to trust the output.

If you have a single 20-line function and want a quick translation, ChatGPT works fine. Paste it in, test the output, move on.

If you have 50 scripts totaling 10,000 lines and need to migrate them reliably over a few weeks, you need a tool that processes every line, flags every uncertainty, and gives you the same result every time you run it. That is what we built.

The Migration Pass ($49 for 30 days) is designed for one-time migration projects. The Individual Pro ($19.99/month) is for researchers who regularly convert MATLAB scripts. Both include file upload, Python file download, and the full compatibility report with actionable flags.

The free tier converts 50 lines with no account required — enough to evaluate the output on your own code before deciding.`,
    },
    {
      heading: 'Try it',
      body: `Paste a MATLAB function and see the output, the flags, and the stats. Compare it to any other tool. We built the converter we wished existed when we started looking, and we think you will see the difference.`,
    },
  ],
}
