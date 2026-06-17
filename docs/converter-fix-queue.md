# Converter fix queue

Bugs found in real converter output, highest-leverage first. Each entry has a
minimal repro and current status. Source case: a Signal Processing example
(noisy sine → bandpass → FFT → peaks → energy loop) that exercised four
distinct weaknesses at once.

## Oracle baseline (2026-06)

`scripts/oracle/run-oracle.ts` converts each .m and **executes** the Python
(numpy/scipy), not just `py_compile`. First baselines reordered the priorities:

- **Smoke set** (cloned repos, ~230 sampled): `SyntaxError` is the dominant
  converter defect (~6–8% of files, up to 27% in matrix-heavy code). Root cause:
  matrix-literal space→comma and colon-range handling choke when an element
  itself contains `[...]` indexing, a function call, or `.T`.
- **Curated set** (`tests/oracle-cases/`, self-contained): 5/6 basic idioms fail
  on one root cause — **numeric array literals `[1 2 3]` are emitted as Python
  lists, not `np.array`** — so vector arithmetic, comparison, reduction, and
  `.shape` all break. This is the single biggest lever (see #0 below).

Run: `npx tsx scripts/oracle/run-oracle.ts --set curated` (needs python3 +
numpy + scipy).

---

## Phase 4: CI runnable-rate gate — DONE

**Goal.** The curated runnable rate can never silently regress, and the gate can
never pass vacuously (e.g. because numpy/scipy were missing so nothing ran).

**What landed.**
1. `.github/workflows/converter-gate.yml` — runs on `pull_request` and `push` to
   `master`: checkout → setup-node 20 → setup-python 3.12 →
   `python3 -m pip install numpy==2.4.6 scipy==1.17.1` → import sanity-check →
   `npm ci` → `npm test` → `npx tsx scripts/oracle/run-oracle.ts --set curated --gate`.
   Deps are pinned and installed into the same interpreter the oracle spawns
   (`python3`), which is the documented way the gate would otherwise go toothless.
2. `run-oracle.ts --gate` hardened: it now exits non-zero not only on converter
   defects but also on a **missing-deps environment** — any curated case that
   reports "environmental", or `runs == 0`. Curated cases are self-contained
   (numpy/scipy only), so an environmental result there means the deps aren't
   importable, and the gate fails loudly instead of passing on nothing. A
   one-line summary (`ORACLE SUMMARY [curated]: runs=X/Y defects=Z environmental=W
   attributable-rate=R%`) prints to the CI log every run.
3. `.githooks/pre-push` — local mirror: always `npm test`, then the curated gate
   **only when** numpy/scipy are importable by `python3` (else it skips with an
   install hint, since CI is the real enforcement; a dev without the stack isn't
   blocked from pushing unrelated work). `.gitattributes` forces the hook to LF
   so the shebang works on Linux/macOS.

   Enable locally:  `git config core.hooksPath .githooks`
   Verify:          `git config --get core.hooksPath`  → `.githooks`
   Bypass once:     `git push --no-verify`

**Verified.** `npm test` 184 green. Curated gate exits 0 at 7/7; a deliberately
broken curated case (undefined var → `NameError`, non-environmental) made the
gate exit 1, then reverted. The missing-deps branch shares the same exit path
(`reasons` → `process.exit(1)`), driven by the `envFail`/`runs` counts.

---

## 0. Array literals emitted as Python lists, not np.array — FIXED

**Symptom.** `v = [1 2 3]; w = v .* 2 + 1` → `v = [1, 2, 3]` (a list), then
`[1, 2, 3] * 2 + 1` → `TypeError`. Also `v > 5`, `sqrt(v)`, `length(v)` /
`v.shape`, `[mx, i] = max(v)` all break because `v` is a list, not an ndarray.

**Cause.** MATLAB `[...]` is *always* an array constructor, but the pipeline
emitted a bare Python list. #2 only wrapped literals directly adjacent to
`*`//`@`; the general case (assignment, comparison) was unwrapped.

**Fix.** `wrapArithmeticListLiterals` in `stages/05_cleanup.ts` generalized: a
bracket literal becomes `np.array([...])` when it's a **top-level value**
(paren-depth 0) OR operator-adjacent. Still skips strings, empty `[]`,
ranges/slices (`:`), multiple-return LHS (`[a, b] = ...`), indexing, nested
rows, and already-wrapped `np.array()` args (those are paren-depth > 0 and not
operator-adjacent). Supersedes #2's narrow trigger; regression test added.

**Result (oracle).** Curated runnable rate **33% → 83%** (2/6 → 5/6). Smoke set
unchanged at the sampled offsets (no SyntaxError regression). Remaining curated
failure is a multi-output builtin (`[mx, pos] = max(v)`) — see #3.

---

## Reference: the example that surfaced these

MATLAB in:

```matlab
fs = 1000;
t = linspace(0, 1, fs);
signal = sin(2*pi*50*t) + 0.5*randn(1, length(t));
[b, a] = butter(4, [40 60]/(fs/2), 'bandpass');
filtered = filter(b, a, signal);
Y = fft(filtered);
P = abs(Y/length(Y));
peaks = findpeaks(P);
energy = zeros(1, length(filtered));
for i = 1:length(filtered)
    energy(i) = filtered(i)^2;
end
```

The emitted Python crashed on the first toolbox call and had three more fatal
issues behind it.

---

## 1. Module-alias / variable-name collision — FIXED (first cut)

**Symptom.** `import scipy.signal as signal` followed by `signal = np.sin(...)`
reassigns `signal` to an array, so `signal.butter(...)` → `AttributeError:
'numpy.ndarray' object has no attribute 'butter'`. Fatal on the first call.

**Cause.** A user variable shares a name with the bare alias an import binds
(`signal`, and likewise `stats`, `time`, `io`, `color`, `transform`,
`control`, `optimize`, ...).

**Fix.** The reserved-word rename pass now also treats import-bound names as
reserved. `imports.ts` derives `IMPORT_ALIASES` from `IMPORT_STATEMENTS`; the
rename map in `analysis/rename-reserved.ts` renames any colliding user variable
(`signal` → `signal_`) with a uniqueness guard, so the import alias is never
shadowed. Regression test in `__tests__/converter.test.ts`
("Import alias / variable name collisions").

**Scoping refinement (fixed).** Originally the rename fired whenever a variable
matched *any* alias name, even with no matching import — so a parameter named
`signal` became `signal_` unnecessarily (caught by the "function parameter
treated as variable" test). Now `importedAliasesForSource` (in `imports.ts`)
scans the source for functions/constants that actually trigger each import, and
`buildRenameMap` only reserves *those* aliases. So `signal` stays `signal`
unless the code uses a `scipy.signal` function; renames only when there's a real
shadow.

**Follow-up fixed.** The rename pass was also rewriting the word inside comments
(`% Simple signal analysis` → `# Simple signal_ analysis`). `index.ts` now skips
`isComment` lines when applying renames.

---

## 2. List arithmetic not vectorized — FIXED (first cut)

**Symptom.** `[40, 60]/(fs/2)` is a Python list divided by a float →
`TypeError: unsupported operand type(s) for /: 'list' and 'float'`.

**Cause.** MATLAB matrix/vector literals in arithmetic were emitted as Python
lists instead of `np.array([...])`. Elementwise MATLAB ops (`[40 60]/500`) need
NumPy arrays.

**Fix.** `stages/05_cleanup.ts` gained `wrapArithmeticListLiterals`: a bare list
literal that is an operand of `*`, `/`, or `@` (covers `**` too) is wrapped as
`np.array([...])`. Conservative — fires only when the bracket is a genuine
literal (not preceded by an identifier/`)`/`]`, so indexing is excluded),
contains no quotes, and sits directly adjacent to one of those operators. Leaves
assignment LHS (`[b, a] = ...`), argument lists, slices, and already-wrapped
`np.array([...])` untouched. Verified against those cases.

**Not yet covered.** Literals that need to be arrays for reasons *other* than
`*`//`@` adjacency (e.g. passed to a function expecting an ndarray, or added with
`+`/`-`). Left out deliberately to keep the trigger conservative; revisit if the
corpus shows demand.

---

## 3. `findpeaks` return-shape mismatch — QUEUED (semantic)

**Symptom.** `scipy.signal.find_peaks` returns `(indices, properties)`, a tuple.
Downstream `peaks.shape` / treating `peaks` as peak values → `AttributeError`
and wrong semantics. MATLAB's `findpeaks(P)` returns peak *values*.

**Cause.** Direct name mapping without adapting the return contract. Already
emits a TOOLBOX flag, but the generated code still assigns the raw tuple.

**Fix idea.** For `findpeaks`, emit something like
`peaks = P[signal.find_peaks(P)[0]]` (values at the returned indices), or assign
`peaks_idx, _ = signal.find_peaks(P)` and flag clearly. Keep the TOOLBOX warning.

---

## 4. Row-vector `(1, N)` shape + 1-based loop indexing — FIXED

**Symptom.** `randn(1, length(t))` → `np.random.randn(1, N)` makes a 2-D
`(1, N)` array. `z = zeros(1, N)` then `z[i-1] = i**2` indexes the first axis
(size 1) → `IndexError` for `i-1 >= 1`. (Verified: `IndexError: index 1 is out
of bounds for axis 0 with size 1`.) Only the **leading-1 row vector** crashes —
`zeros(N, 1)` keeps axis 0 = N so single-index access happened to survive.

**Cause.** MATLAB row/col vectors are 2-D `(1, N)`/`(N, 1)` but the index-shift
pass (`04_index.ts`, `transformGeneralIndexing`) rewrites single-subscript
`z(i)` → `z[i - 1]`, indexing axis 0. The constructors emit 2-D: `zeros`/`ones`
via the `reshape` arg-mode tuple-wrap (`03_transform.ts`), `rand`/`randn` via
plain passthrough (numpy takes separate dim args, still 2-D).

**Fix (Candidate A).** Drop a **literal `1`** in the leading or trailing position
of the **2-arg** form so a row/col vector becomes 1-D, for which single-subscript
access is correct. Shared helper `dropSingletonVectorDim` in `03_transform.ts`,
applied to `zeros`/`ones` (scoped by name inside the `reshape` case so `repmat` —
which shares that mode — keeps its reps tuple) and to `rand`/`randn` via a new
`rand_shape` arg-mode that emits separate dim args (`np.random.rand(n)`, not a
tuple). Single-arg `zeros(n)` (MATLAB n×n) is untouched. Regression tests added
(`zeros(1,n)`/`zeros(n,1)` → `np.zeros(n)`; `randn`/`rand`; repmat/matrix kept
2-D). Curated oracle case `tests/oracle-cases/preallocate_loop.m` added — crashed
before, runs after; its `length(z)` line guards that `length` stays correct.

**Result.** `npm test` 180 → 184. Curated oracle 6/6 → **7/7 clean**.

### Follow-up: `size()` / `[r,c]=size()` on a de-2-D'd row vector — OPEN (evidence-gated)

After the fix the array is genuinely 1-D, so `length`/`numel` stay correct
(`np.max(x.shape)` = N, `x.size` = N) but `size()` diverges from MATLAB:
`size(A)` → `A.shape` = `(N,)` not `[1 N]`, `[r, c] = size(A)` can't unpack, and
`size(A, 2)` → `A.shape[1]` → IndexError. Accepted tradeoff: the
preallocate-then-loop idiom (the common case) now runs correctly, which is what
moves the runnable rate. **Do not** add shape-aware `size`/`length` speculatively
— revisit only if the corpus shows real `size(rowvec, 2)` / `[r,c]=size(rowvec)`
usage on a de-2-D'd vector.

---

## Colon-range vs `(:)`-flatten in space-separated rows — FIXED

**Symptom.** `r = [a(:) b(:)]` → `np.arange(a(, ) + ) b(, ) b()` (garbage,
SyntaxError). Part of the smoke `SyntaxError` bucket; common in spatialmath-style
`[n(:) o(:) a(:)]` rotation-matrix builds.

**Precise trigger (isolated).** ONLY space-separated *multiple* `(:)` flattens in
one bracket row. All adjacent forms are correct: `a(:)`, `[a(:)]`,
`a(:) + b(:)`, and column form `[a(:); b(:)]`.

**Cause (refined by tracing).** Not a Stage-03 range handler — the corruption
happens earlier, inside the **idiom pass** (`analysis/idioms.ts`, the first
sub-step of `preTransform`). The 3-part bracket-range rule
`[a:step:b] → np.arange(a, b + step, step)` uses a permissive char class
(`[^\[\],;]+?`) that allows parens, spaces, and colons, so on `[a(:) b(:)]` it
reads the three colons inside the `(:)` calls as a `start:step:stop` range. Its
2-part sibling (char class `[\w.+\-*/]+`) excludes parens and never misfired —
that asymmetry made the 3-part rule the sole offender. The line-aware flatten
rewrite (`rewriteFlattenCall`) ran *after* the idiom-rule loop, too late.

**Fix.** Reordered `applyIdioms` so the line-aware `rewriteFlattenCall` pass runs
**before** the `IDIOM_RULES` loop. `(:)` becomes `.flatten(order="F")` first, so
the colons are gone before the bracket-range rules run and they can't misfire.
`rewriteFlattenCall` already has the required LHS-skip (it only rewrites the RHS
of a top-level `=`), so `A(:) = v` is untouched and still becomes a Stage-04
slice assignment. No new regex; reuses existing LHS-aware logic. Regression test
added (`[a(:) b(:)]` and `[n(:) o(:) a(:)]` → flatten form, no `np.arange`);
full `npm test` green (179 → 180).

## Horizontal concat of column vectors → np.column_stack — OPEN

**Symptom.** `r = [a(:) b(:)]` now emits valid Python
`r = [a.flatten(order="F"), b.flatten(order="F")]` — a Python *list of two
arrays*, not MATLAB's N×2 horizontal concatenation. The semantically faithful
output is `np.column_stack([a.flatten(order="F"), b.flatten(order="F")])` (or
`np.array([...]).T`).

**Scope.** This is a pre-existing **row-concat-of-vectors shape gap**, not
specific to `(:)`: the same question applies to `[a b]` of two column vectors,
and to #0's `np.array([...])` wrapping (what shape does a space-separated row of
vectors produce?). The colon-range fix above deliberately stayed in scope —
"stop the corruption, emit valid Python" — which is what moves the oracle
runnable rate. Correct N×2 shaping is a separate, lower-urgency semantics item:
the current output is valid Python and runs; it's just shaped as a list rather
than a 2-D array.

**Fix idea.** When a bracket row is a space-separated concat of ≥2 column
vectors / `(:)` flattens (no `;` row separators), emit
`np.column_stack([...])` instead of a bare list. Coordinate with #0's array-
literal wrapping so the two rules agree on the shape contract for row-of-vectors.

## Matrix-literal rows with nested elements — FIXED (partial bucket)

**Symptom.** The dominant smoke `SyntaxError` bucket. Rows of a `;`-matrix whose
elements contain nested `[...]`/`(...)`/`.T` were left space-separated:
`[[x[1:2, 1:2] [0, 0].T x[1:2, 2]], ...]` → Python rejects it.

**Cause.** `rewriteVerticalConcat` only space→comma-split a row when it contained
*no comma at all* (`!row.includes(',')`) — but those commas were inside nested
brackets, not top-level separators, so rows with nested indexing were skipped.

**Fix.** Rows are now split with the depth-aware `splitAllElements`, which
separates top-level space-delimited elements while preserving nested commas.
`[A(1,1) 5; 6 7]` → `np.array([[A[0, 0], 5], [6, 7]])`. Regression test added.

**Result (oracle).** Worst slice (spatialmath, offset 700/70): **51 → 57 runs,
SyntaxError 19 → 13**. Curated stays 6/6. Not the whole bucket — colon-ranges
containing function calls (`np.arange(unit(n[, ]) ...)`) are still mangled and
need separate work.

## Registry coverage notes (2026-06)

Corpus scan: ~360 functions mapped; most *common* MATLAB functions are already
covered (mod, rem, cumsum, diff, norm, trace, fliplr, dot, cross, floor/ceil/
round, …). Added this pass: `any`/`all` → `np.any`/`np.all`, `kron` → `np.kron`.
Still genuinely unmapped / buggy (queued): `isfield` (→ `'f' in s`, needs custom
arg-reorder), `isa`, `get`/`set` (graphics).

## repmat → np.tile argument structure — FIXED

**Symptom.** `repmat(A, 2, 3)` → `np.tile((A, 2, 3))` — every arg jammed into one
tuple, so np.tile got a single positional arg and `reps` was missing →
`TypeError: tile() missing 1 required positional argument: 'reps'`. All forms
were affected (`repmat(A, 2)`, `repmat(A, [m, n])`, `repmat(5, 1, n)`, …).

**Cause.** `repmat` was mapped with `args: 'reshape'` — the arg-mode that tuples
*all* args together (correct for `zeros`/`ones`, where every arg is a dimension).
But repmat's first arg is the array to tile and the rest are the reps; numpy's
`np.tile(A, reps)` needs them as two separate positionals.

**Fix.** New `tile` arg-mode (`03_transform.ts`, registry entry switched to it):
keeps arg 0 as the array and builds the reps from the rest —
`repmat(A, m, n, …)` → `np.tile(A, (m, n, …))`; `repmat(A, n)` →
`np.tile(A, (n, n))` (MATLAB's scalar n means n×n; `np.tile(A, n)` would only
tile the last axis); `repmat(A, [m, n])` → `np.tile(A, [m, n])` (numpy accepts an
array-like reps). Regression tests added (all four shapes + nested-call first
arg); curated oracle case `tests/oracle-cases/repmat_tile.m` added.

**Result.** `npm test` 184 → 185. Curated oracle 7/7 → **8/8 clean**.

## Dual-return max/min — FIXED

**Symptom.** `[mx, pos] = max(v)` → `mx, pos = np.max(v)` → "cannot unpack
non-iterable" (np.max is value-only). The last curated red.

**Fix.** Idiom rules in `analysis/idioms.ts`: `[v, i] = max(X)` →
`v, i = np.amax(X), np.argmax(X)` (and `min`/`argmin`). Uses `amax`/`amin` so
the registry's `max`→`np.max` rule doesn't re-prefix to `np.np.max`. Index is
0-based per the existing `[~, idx]` convention. Regression test added.

**Result.** Curated runnable rate **83% → 100% (6/6)**. Smoke unchanged.

---

_Found via manual review + execution oracle (2026-06). Fixed: #0, #1 (+scoping +
comment-rename), #2, dual-return max/min, #4 (row-vector `(1,N)` de-2-D) —
curated set now 7/7. Still open: #3 (findpeaks return-shape), the #4 follow-up
(`size()` on de-2-D'd vectors, evidence-gated), and the smoke **SyntaxError /
matrix-literal** bucket (the big one — see baseline).
Telemetry (site='matlab') shows flag-type frequency in real usage, but specific
construct names stay private — prioritize the open buckets from the corpus +
oracle, not telemetry strings._
