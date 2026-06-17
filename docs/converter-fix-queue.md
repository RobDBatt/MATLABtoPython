# Converter fix queue

Bugs found in real converter output, highest-leverage first. Each entry has a
minimal repro and current status. Source case: a Signal Processing example
(noisy sine → bandpass → FFT → peaks → energy loop) that exercised four
distinct weaknesses at once.

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

---

## 2. List arithmetic not vectorized — QUEUED

**Symptom.** `[40, 60]/(fs/2)` is a Python list divided by a float →
`TypeError: unsupported operand type(s) for /: 'list' and 'float'`.

**Cause.** MATLAB matrix/vector literals in arithmetic are emitted as Python
lists instead of `np.array([...])`. Elementwise MATLAB ops (`[40 60]/500`) need
NumPy arrays.

**Fix idea.** When a bracket literal participates in arithmetic (`/ * + - .^`
etc.) or is passed where an array is expected, wrap it as `np.array([...])`.
Detect in the transform stage; conservative trigger to avoid wrapping literals
used as indices or function-arg lists.

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

_Found via manual review of converter output (2026-06). #1 fixed in the same
pass; #2–#4 are open. Telemetry (site='matlab') will show how often these flag
types appear in real usage, but the specific construct names stay private — so
prioritize #2–#4 from the corpus + this doc, not from telemetry strings._
