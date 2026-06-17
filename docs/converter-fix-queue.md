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

**Known tradeoff.** The rename fires whenever a variable matches an alias name,
even if that module isn't imported in the given file (e.g. a variable `time`
with no `time` import still becomes `time_`). Harmless and deterministic, but
could later be scoped to only the imports actually injected (requires moving the
rename pass to run after import resolution).

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

## 4. Row-vector `(1, N)` shape + 1-based loop indexing — QUEUED

**Symptom.** `randn(1, length(t))` → `np.random.randn(1, N)` makes a 2-D
`(1, N)` array. `energy = zeros((1, N))` then `energy[i-1] = filtered[i-1]**2`
indexes the first axis (size 1) → `IndexError` for `i-1 >= 1`.

**Cause.** MATLAB row vectors are 2-D `(1, N)` but idiomatic NumPy wants 1-D
`(N,)`; the index-shift pass then indexes the wrong axis.

**Fix idea.** Either emit 1-D shapes for MATLAB row/col vectors where the second
dim is 1 (`np.zeros(N)`, `np.random.randn(N)`), or, when a 2-D `(1, N)` is kept,
index the trailing axis (`energy[0, i-1]`). The former is cleaner and matches
how the rest of the code indexes with a single subscript.

---

_Found via manual review of converter output (2026-06). #1 and #2 fixed (plus
the comment-rename follow-up); #3–#4 are open. Telemetry (site='matlab') will
show how often these flag types appear in real usage, but the specific construct
names stay private — so prioritize #3–#4 from the corpus + this doc, not from
telemetry strings._
