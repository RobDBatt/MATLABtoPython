# MATLAB→Python Converter — Review Punch-List

Generated from a behavioral probe of the live `convert()` on 22 common MATLAB
idioms that the 24-case verification harness does **not** exercise. Every item
below was reproduced by running the actual converter (not by reading code).

## ⬛ LOCKED — decisions & oracle verdict (read first)

**Octave numeric oracle ran** (`scripts/octave_oracle.mts`, Octave installed):
of the real MATLAB scripts that can be numerically verified, the converter
produces the **correct answer in ~100% of cases** — **zero genuine silent-wrong
bugs** in the measurable sample. Converter-caused crashes are ~0.4%. The **only
systematic divergence from MATLAB is the 0-based index contract.** Conclusion:
the converter is good; no large correctness investment is warranted.

**DECISION (locked): index contract = "0-based + flag on display."** Keep returned
indices 0-based (correct for subscripting — `v(ix)`/`x(locs)` already match
MATLAB via the Stage-04 tracker). Do **not** change the indexing math. Instead,
**emit a `# WARN`/flag when a tracked 0-based index is used as a *value*** (in a
`print`/`fprintf`/`disp` arg or arithmetic), since that's where it's off-by-one
vs MATLAB. So the "A1" item below is NOT a value fix — it's an add-a-flag task.

**Revised top priorities given the above:**
1. **The flag net (Root Cause E)** — highest value. 88% of real scripts can't be
   auto-verified, and the converter doesn't warn on its uncertain spots. Make it
   flag (incl. the index-on-display case from the decision above).
2. **The rare crashes (Root Cause A resolver, C1 cell)** — ~0.4%, but real.
3. **Polish:** B-family (reshape order, `*` matmul, `rem`) — low priority; they
   did NOT surface in the random corpus sample, so they're genuine edge cases.

## TL;DR

- **14 issues**, clustering into **4 root causes + 1 systemic meta-issue**.
- The dominant root cause is MATLAB's **`()` call-vs-index ambiguity** — it
  underlies ~6 of the bugs. Fixing the resolver clears a whole cluster.
- **Every issue is silent: zero flags fired** on any wrong or crashing output.
  That is the single most important systemic finding (see Root Cause E).
- The converter is genuinely solid on straightforward cases — see
  "Verified correct (do not regress)" at the bottom.

## Executed verification (Python 3.14, not inferred)

The four highest-severity cases were run through Python. These are runtime facts:

| Case | Converter output, executed | Verdict |
|---|---|---|
| A1 double-correction | prints `5`; MATLAB gives `9` | **runs clean, silently wrong** |
| A2 expression subscript | `TypeError: 'numpy.ndarray' object is not callable` | crash |
| A3 anonymous-fn call | `TypeError: 'function' object is not subscriptable` | crash |
| C1 cell array | `TypeError: unsupported operand type(s) for +: 'int' and 'str'` | crash |

**A1 is the most dangerous:** no exception, no flag — just a wrong number. Crashes
are visible; silent wrong answers are not. Prioritize accordingly.

## Real-world prevalence (923-file corpus, measured)

The bugs above are real, but a full-corpus run shows how often they actually bite.
Read "P0" as *severe when hit*, not *common*.

**Syntax** — `py_compile` across 923 real toolbox files (autofft, vbmc, ypea,
spatialmath, DeepLearnToolbox, …): **91.0% valid Python · 69.6% flag-clean ·
9.0% syntactically broken.**

**Runtime** — executed the 840 valid files under Python:
- **80.5% ran clean end-to-end** (676 files).
- 19.5% failed at runtime, but **mostly environmental** — missing toolbox
  functions / python modules / data files, which the original MATLAB would also
  fail on without its toolboxes. Not the converter's fault.
- **Converter-attributable runtime crashes: 0.4%** (the `not callable` /
  `not subscriptable` family — A2/A3/C1). Real and confirmed in the wild, but rare.

**The takeaway that reorders this list:** crashes are RARE (0.4%) and
SELF-ANNOUNCING (the user sees a traceback). The dangerous bugs are the
SILENT-WRONG ones (A1, B1–B4): they pass `py_compile` AND run clean AND emit zero
flags — invisible at every layer except a numeric oracle. Their prevalence is
UNMEASURED because nothing detects them. That unknown is the real risk, not the
visible 0.4%.

## How to use this

Fix by **root cause, not symptom** — several bugs share one fix. For each, follow
the converter-debug loop: minimal failing `_debug.test.ts` → registry/stage fix →
`regressions.test.ts` entry → **add a `tests/verification-corpus/` case** (these
are precisely the gaps the green 24-case matrix missed) → unit + py_compile green
→ background corpus run (no >0.5pt drop).

Severity: **P0** = silent-wrong or crash on a common idiom · **P1** = less common
or more visible · **P2** = hygiene/standards.

---

## Root Cause A — the `()` call-vs-index ambiguity  [P0, the big one]

MATLAB overloads `()` for both function calls and array indexing. The converter's
disambiguation fails in several composite cases. A proper fix needs **symbol-kind
tracking** (is this name a lambda / dict / numpy array / function?) plus handling
of nested/expression subscripts. Fixing this resolves A1–A4 together.

**A1. Multi-return index → double-correction (silent wrong value).**
```matlab
v = [3 1 4 1 5 9 2 6];
[mx, ix] = max(v);
m = v(ix);
```
- current: `mx, ix = np.amax(v), np.argmax(v)` then `m = v[ix - 1]`  → `m = 5` (WRONG)
- correct: `m = v[ix]`  → `m = 9`
- cause: `buildZeroBasedVars` only matches single-assignment `ix = np.argmax(...)`.
  A max-index is always multi-return (`mx, ix = …, np.argmax(v)`), which no pattern
  catches, so `ix` isn't tracked and the `−1` is wrongly applied. Same gap for
  `find`→`np.flatnonzero` (also untracked).

**A2. Expression / call subscripts → left as a call (crash) and unshifted.**
```matlab
first = v(idx(1));        % also: v(mod(i,3)+1)
```
- current: `first = v(idx[0])`  → `'ndarray' object is not callable`
- correct: `first = v[idx[0]]`
- cause: Stage-04 array-indexing handles `v(simplevar)` but not `v(<expression>)`.
  For arithmetic subscripts like `v(mod(i,3)+1)` it also drops the `−1` shift.

**A3. Anonymous-function call → array subscript (crash).**
```matlab
f = @(x) x.^2 + 1;
y = f(3);
```
- current: `f = lambda x: x**2 + 1` then `y = f[2]`  → `'function' is not subscriptable`
- correct: `y = f(3)`
- cause: the call-vs-index heuristic classifies the lambda var `f` as an array.

**A4. `containers.Map` read not converted (crash); LHS/RHS asymmetric.**
```matlab
m = containers.Map();
m('key') = 1;
v = m('key');
```
- current: `m['key'] = 1` (write OK) but `v = m('key')`  → `'dict' object is not callable`
- correct: `v = m['key']`

---

## Root Cause B — MATLAB↔numpy semantic mismatches  [P0/P1]

The converter picks the wrong-but-plausible mapping and ships it silently.

**B1. `*` matrix-multiply → elementwise (P0, silent wrong math).**
```matlab
C = A .* B;   D = A * B;
```
- current: both → `A * B` (numpy `*` is elementwise)
- correct: `C = A * B` (elementwise, OK) but `D = A @ B` (matmul)
- note: needs operand-shape awareness; when ambiguous (operands unknown), **flag**
  rather than silently choosing elementwise. `.^`/`./` are already correct.

**B2. `rem` → `np.remainder` is wrong for negatives (P1).**
```matlab
b = rem(-7, 3);
```
- current: `np.remainder(-7, 3)` → `2` (that's MATLAB `mod`, not `rem`)
- correct: `np.fmod(-7, 3)` → `-1`

**B3. `reshape` ignores MATLAB column-major order (P1, silent wrong matrix).**
```matlab
e = reshape(1:6, 2, 3);
```
- current: `np.arange(1, 6+1).reshape(2, 3)`  → `[[1,2,3],[4,5,6]]`
- correct: `... .reshape(2, 3, order='F')`     → `[[1,3,5],[2,4,6]]`

**B4. `for v = matrix` iterates rows, not columns (P1, silent wrong loop).**
```matlab
for col = [1 2 3; 4 5 6]
```
- current: `for col in np.array([[1,2,3],[4,5,6]])` (2 row iters)
- correct: `for col in np.array([...]).T` (3 column iters of `[1,4],[2,5],[3,6]`)

**B5. (minor) `round` uses numpy banker's rounding;** MATLAB rounds half away from
zero (`round(2.5)`: MATLAB 3, numpy 2). Consider a custom round or a flag.

---

## Root Cause C — container types  [P0/P1]

**C1. Cell array literal → addition expression (P0, crash).**
```matlab
c = {1, 'two', [3 4]};
```
- current: `c = 1 + 'two' + np.array([3, 4])`  → `TypeError` (int + str)
- correct: `c = [1, 'two', np.array([3, 4])]`  (Python list; `c{i}` indexing already OK)

**C2. Struct arrays not initialized (P1, crash).**
```matlab
s(1).x = 1;  s(2).x = 2;  t = s(2).x;
```
- current: `s[0].x = 1` on an undefined `s` → `NameError`; also dict-vs-attr mismatch
- correct: initialize a list of dicts/objects and use the matching access form.
  Scalar structs (→ dict) are already fixed; this is the *array* case.

---

## Root Cause D — output-standard / hygiene  [P2]

- **D1.** `sprintf('%d-%d',3,4)` → `'%d-%d' % (3,4)`. Works, but violates the
  mandatory **f-string** output standard (`f'{3}-{4}'`).
- **D2.** Verify a numpy import is emitted when the **first** statement is a 2D
  array literal (`A = [1 2 3; 4 5 6]`) — one probe appeared to omit
  `import numpy as np`. Confirm; if real, it's a `NameError`.

---

## Root Cause E — SILENT FAILURE (systemic)  [P0]

**Across all 22 probes, not a single `# TODO:` or warning flag was emitted** — not
on crashing output, not on silently-wrong math. The converter's stated
**flag-don't-guess** contract is effectively not firing for this entire class.

This is the most important finding: even where a faithful conversion is hard, the
converter must **flag**, so a user never unknowingly ships wrong/crashing Python.
Audit why `detectResidualFlags` / the Stage-05 net doesn't catch:
- an `arr(...)` call surviving into the output on a known array,
- a cell-as-addition expression,
- an ambiguous `*` on matrix operands.

Treat "add a flag" as a valid fix when a correct mapping isn't feasible.

---

## Priority order to fix (re-ranked by RISK = impact × invisibility)

Corpus data flips the ranking. Severity ≠ priority: a 0.4% crash that announces
itself matters less than a silent-wrong answer the user ships unknowingly.

**TIER 1 — SILENT-WRONG (invisible; the real risk).** Run clean, pass every
existing check, emit no flag, return the wrong answer:
- **A1** multi-return index double-correction (`m=v(ix)` → wrong element). Fix the
  index tracker (`buildZeroBasedVars` multi-return gap).
- **B1** `*` matrix-multiply emitted as elementwise — wrong math, and matmul is common.
- **B3** `reshape` ignoring MATLAB column-major — wrong matrix.
- **B2** `rem`→`np.remainder` (wrong for negatives); **B4** `for v = matrix` iterating
  rows not columns.

**TIER 2 — THE FLAG NET (Root Cause E): the single highest-leverage fix.** Make the
converter emit a `# TODO:`/flag whenever it can't map correctly (ambiguous `*`,
`arr(...)` surviving as a call, cell-as-addition). This converts the entire
silent-wrong class into *visible* — the difference between a user unknowingly
shipping a wrong answer and seeing a warning. Given silent-wrong is the top risk,
this is the most valuable single change in the list.

**TIER 3 — CRASHES (real but rare, ~0.4%; self-announcing).** Lower urgency than
their P0 label implied:
- **Root Cause A resolver** (A2/A3/A4 call-vs-index → `not callable` etc.)
- **C1** cell-array literal → addition; **C2** struct arrays uninitialized.

**TIER 4 — hygiene:** D1 sprintf f-strings, B5 round, D2 import check.

Add a verification-corpus case for **every** item above — that converts this
punch-list into permanent harness coverage.

## Highest-leverage INVESTMENT (not a bug fix)

Wire up the **Octave numeric oracle**: auto-compare converted output against real
MATLAB (run the `.m` in GNU Octave, run the converted Python, diff the numbers)
across the corpus. It is the **only** thing that can detect the Tier-1
silent-wrong class at scale. Without it, those bugs are undetectable and their
prevalence stays unknown — which is exactly the gap this review couldn't close.

---

## Verified correct (do NOT regress these)

Simple 1-D and **2-D indexing** (`A(2,3)`, `A(end,:)`, `A(:,1)`), **`end`
arithmetic** (`v(end-1)`, `v(end-2:end)`), **logical-index read & assignment**
(`v(v<0)=0`), **array growth** (`acc(end+1)=…` → `np.append`), **`switch/case`**,
**`try/catch`**, **logical ops** (`~=`,`&&`,`~`), **string fns** (`strcmp`,
`num2str`, `strrep`), **constants/utility** (`pi`, `NaN`, `Inf`, `isempty`,
`numel`, `true`), and most math (`mod`, `fix`, `.*`, `./`, `.^`). These all
produced correct Python in the probe.
