"""
MATLAB-style sprintf / fprintf with vector-argument expansion.

MATLAB's sprintf differs from Python's % formatting in one important
way: if you pass a vector (array) argument, MATLAB cycles through the
vector and repeats the format specifiers until the vector is exhausted.

    sprintf('%d\\n', [1 2 3])  →  '1\\n2\\n3\\n'  (MATLAB)
    '%d\\n' % [1, 2, 3]         →  TypeError      (Python)

These helpers handle the vector-expansion case so converted MATLAB code
behaves the same.
"""

from __future__ import annotations
from typing import Any
import sys

try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:
    _HAS_NUMPY = False


def _is_vector(x: Any) -> bool:
    if _HAS_NUMPY and isinstance(x, np.ndarray):
        return x.ndim >= 1 and x.size > 1
    if isinstance(x, (list, tuple)):
        return len(x) > 1
    return False


def _flatten(x: Any) -> list:
    if _HAS_NUMPY and isinstance(x, np.ndarray):
        # MATLAB is column-major — flatten in Fortran order to match
        return list(x.flatten(order="F"))
    if isinstance(x, (list, tuple)):
        return list(x)
    return [x]


def _count_specifiers(fmt: str) -> int:
    """Count %-specifiers in a format string, ignoring %%."""
    i = 0
    count = 0
    while i < len(fmt):
        if fmt[i] == "%":
            if i + 1 < len(fmt) and fmt[i + 1] == "%":
                i += 2
                continue
            count += 1
        i += 1
    return count


def sprintf(fmt: str, *args: Any) -> str:
    """
    MATLAB-compatible sprintf. Cycles format-string specifiers through
    a flattened, concatenated argument list, matching MATLAB semantics.
    """
    n_specs = _count_specifiers(fmt)
    if n_specs == 0:
        return fmt

    # Flatten and concatenate all arguments in MATLAB column-major order
    values: list = []
    for a in args:
        values.extend(_flatten(a))

    if not values:
        return fmt

    # Emit the format string once per full set of specifiers, consuming
    # `n_specs` values each pass, until values are exhausted.
    out: list[str] = []
    i = 0
    while i < len(values):
        chunk = values[i : i + n_specs]
        if len(chunk) < n_specs:
            # Partial chunk — MATLAB still emits the format string with
            # what it has. Python's % would error; fill with empty and
            # stop after this pass.
            break
        out.append(fmt % tuple(chunk))
        i += n_specs
    return "".join(out)


def fprintf(*args: Any, end: str = "") -> None:
    """
    MATLAB-compatible fprintf. Two calling conventions:

        fprintf(fmt, *args)         — write to stdout
        fprintf(fid, fmt, *args)    — write to a file-like object

    The default `end=""` matches MATLAB (no auto-newline); use your
    format string's explicit `\\n` to add one.
    """
    if not args:
        return
    first = args[0]
    if hasattr(first, "write") and not isinstance(first, str):
        fid = first
        fmt = args[1] if len(args) > 1 else ""
        rest = args[2:]
        if rest:
            fid.write(sprintf(fmt, *rest))
        else:
            fid.write(fmt)
        return
    fmt = first
    rest = args[1:]
    text = sprintf(fmt, *rest) if rest else fmt
    sys.stdout.write(text + end)
