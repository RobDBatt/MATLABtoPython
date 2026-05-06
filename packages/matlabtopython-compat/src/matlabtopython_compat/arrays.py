"""
Array helpers for converted MATLAB code.

Two common MATLAB patterns that don't have a clean one-liner equivalent
in plain numpy:

1. `X(:)` — column-major flatten. numpy's `.flatten()` defaults to
   row-major, which gives different element order. `flatten_fortran`
   forces `order='F'` so converted code matches MATLAB semantics.

2. `[sorted, idx] = sort(X)` — returns BOTH the sorted values and the
   original indices. numpy splits these into `np.sort` and `np.argsort`;
   `sort_with_index` returns the pair in one call.
"""

from __future__ import annotations
from typing import Tuple, Union

try:
    import numpy as np
except ImportError:  # pragma: no cover — numpy is a hard dep
    raise


def flatten_fortran(a):
    """MATLAB `A(:)` — flatten in column-major (Fortran) order."""
    return np.asarray(a).flatten(order="F")


def matlab_size(a, dim: int | None = None) -> Union[tuple, int]:
    """
    MATLAB `size(A)` and `size(A, dim)` semantics.

    MATLAB returns a row vector for `size(A)` (length 2 minimum, padded
    with 1s for trailing dimensions) and a scalar for `size(A, dim)`
    with 1-based `dim`. numpy's `.shape` is a tuple with no padding
    and 0-based indexing. This wrapper matches MATLAB exactly:

        matlab_size(x)       -> tuple, min length 2
        matlab_size(x, 1)    -> first dim (1-based)
        matlab_size(x, 2)    -> second dim

    Useful when the MATLAB code stores `size(x, 1)` results in variables
    that get passed to other functions — the 1-based indexing needs to
    survive translation.
    """
    arr = np.asarray(a)
    shape = arr.shape
    # MATLAB pads scalars/vectors to at least 2 dimensions
    if len(shape) == 0:
        shape = (1, 1)
    elif len(shape) == 1:
        shape = (1, shape[0])  # MATLAB treats 1-D as a row vector

    if dim is None:
        return shape
    if dim < 1:
        raise ValueError(f"matlab_size: dim must be >= 1 (1-based), got {dim}")
    if dim - 1 >= len(shape):
        return 1  # MATLAB returns 1 for trailing singleton dims
    return shape[dim - 1]


def matlab_numel(a) -> int:
    """MATLAB `numel(A)` — total element count. Same as `a.size` for numpy arrays."""
    return int(np.asarray(a).size)


def sort_with_index(a, axis: int = -1, descending: bool = False) -> Tuple:
    """
    MATLAB `[sorted, idx] = sort(X)` — returns (sorted_values, indices).
    indices are 0-based (numpy convention); use +1 if you're porting a
    loop that literally iterates 1..N.
    """
    arr = np.asarray(a)
    idx = np.argsort(arr, axis=axis)
    if descending:
        idx = np.flip(idx, axis=axis)
    sorted_vals = np.take_along_axis(arr, idx, axis=axis) if arr.ndim > 0 else arr[idx]
    return sorted_vals, idx
