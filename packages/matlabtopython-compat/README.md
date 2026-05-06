# matlabtopython-compat

**The Python runtime for ported MATLAB code.**

When you translate MATLAB to Python, some idioms don't map cleanly to
numpy or scipy alone:

- Cell arrays with grow-on-write semantics
- Structs that support both `s.name` and `s.('name')` access
- `sprintf` cycling format specifiers through vector arguments
- `X(:)` column-major flatten (numpy defaults to row-major)
- `[sorted_vals, idx] = sort(X)` returning a pair

This package fills those gaps so ported code runs without hand-editing
every MATLAB-ism into a numpy equivalent. Pair it with the online
converter at [mtopython.com](https://mtopython.com) for a zero-edit
path, or use it directly if you're porting MATLAB by hand.

## Install

```bash
pip install matlabtopython-compat
```

Optional `.mat` file I/O adds a scipy dependency:

```bash
pip install "matlabtopython-compat[mat-io]"
```

## What's in it

| Helper | MATLAB equivalent | Why it's here |
|---|---|---|
| `CellArray` | `c = {a, b, c}` | Lists work for most cells but miss `c{1} = ...` grow-on-write semantics. |
| `Struct` | `s.name`, `s.(name)` | Combines attribute + dict access in one object. |
| `sprintf` | `sprintf('%d\n', [1 2 3])` | Vector arguments cycle through format specifiers — Python's `%` doesn't. |
| `fprintf` | `fprintf(fid, fmt, args)` | Same, with file-handle form. |
| `tic` / `toc` | `tic; ... toc` | MATLAB-compatible timing output. |
| `flatten_fortran` | `X(:)` | Column-major flatten (numpy defaults to row-major). |
| `sort_with_index` | `[s, i] = sort(X)` | Returns both sorted values and indices. |

## Example

```python
from matlabtopython_compat import CellArray, Struct, sprintf, tic, toc

# Cells with grow-on-write
c = CellArray()
c.cell_set(1, 'Alice')
c.cell_set(2, 42)
print(c.cell_get(1))  # 'Alice'

# Struct with both access styles
s = Struct(name='Alice', age=30)
print(s.name, s['age'])

# Vector-argument sprintf
print(sprintf('%d\n', [1, 2, 3]))  # '1\n2\n3\n'

# MATLAB-style timing
t0 = tic()
# ... code ...
toc()  # "Elapsed time is X seconds."
```

## License

MIT. No runtime calls to external services; everything is pure Python.
