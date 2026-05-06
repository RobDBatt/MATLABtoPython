"""
MATLAB runtime for Python.

When you port MATLAB code to Python, some idioms don't translate cleanly
to numpy or scipy alone: cell arrays with grow-on-write semantics, structs
that support both `s.name` and `s.(name)` access, sprintf cycling through
vector arguments, `X(:)` column-major flatten. This package provides the
missing pieces so converted code actually runs without hand-editing every
MATLAB-ism into a numpy equivalent.

Install:
    pip install matlabtopython-compat

Typical usage (what the online converter at https://mtopython.com emits):
    from matlabtopython_compat import CellArray, Struct, sprintf, tic, toc
"""

from .cell_array import CellArray
from .struct import Struct
from .format import sprintf, fprintf
from .timing import tic, toc
from .arrays import flatten_fortran, sort_with_index, matlab_size, matlab_numel

__all__ = [
    "CellArray",
    "Struct",
    "sprintf",
    "fprintf",
    "tic",
    "toc",
    "flatten_fortran",
    "sort_with_index",
    "matlab_size",
    "matlab_numel",
]

__version__ = "0.1.2"
