"""Smoke tests for matlabtopython-compat."""

import numpy as np
import pytest

from matlabtopython_compat import (
    CellArray,
    Struct,
    sprintf,
    tic,
    toc,
    flatten_fortran,
    sort_with_index,
    matlab_size,
    matlab_numel,
)


# ── CellArray ────────────────────────────────────────────────

def test_cell_array_grow_on_write():
    c = CellArray()
    c.cell_set(3, "x")
    assert len(c) == 3
    assert c.cell_get(3) == "x"
    assert c.cell_get(1) is None


def test_cell_array_from_iterable():
    c = CellArray([1, "two", [3, 3]])
    assert c.cell_get(1) == 1
    assert c.cell_get(2) == "two"
    assert c.cell_get(3) == [3, 3]


def test_cell_array_unpack():
    c = CellArray(["a", "b"])
    def f(x, y):
        return x + y
    assert f(*c.unpack()) == "ab"


# ── Struct ───────────────────────────────────────────────────

def test_struct_both_access_styles():
    s = Struct(name="Alice", age=30)
    assert s.name == "Alice"
    assert s["age"] == 30
    s.age = 31
    assert s["age"] == 31
    s["name"] = "Bob"
    assert s.name == "Bob"


def test_struct_contains_and_iter():
    s = Struct(a=1, b=2)
    assert "a" in s
    assert sorted(list(s.keys())) == ["a", "b"]


def test_struct_from_dict():
    s = Struct({"x": 1, "y": 2})
    assert s.x == 1
    assert s.y == 2


def test_struct_delete():
    s = Struct(x=1)
    del s.x
    assert "x" not in s


# ── sprintf ──────────────────────────────────────────────────

def test_sprintf_plain():
    assert sprintf("hello") == "hello"
    assert sprintf("x = %d", 5) == "x = 5"


def test_sprintf_vector_expansion():
    # MATLAB: sprintf('%d\n', [1 2 3]) → '1\n2\n3\n'
    result = sprintf("%d\n", [1, 2, 3])
    assert result == "1\n2\n3\n"


def test_sprintf_numpy_vector():
    result = sprintf("%d\n", np.array([4, 5, 6]))
    assert result == "4\n5\n6\n"


def test_sprintf_multi_spec_cycle():
    # `'%d=%d\n' % (1, 2, 3, 4)` — two specs, cycles: '1=2\n3=4\n'
    assert sprintf("%d=%d\n", [1, 2, 3, 4]) == "1=2\n3=4\n"


# ── tic / toc ────────────────────────────────────────────────

def test_tic_toc():
    t0 = tic()
    elapsed = toc(t0, silent=True)
    assert elapsed >= 0


# ── Array helpers ────────────────────────────────────────────

def test_flatten_fortran_preserves_column_major():
    a = np.array([[1, 2, 3], [4, 5, 6]])
    # Row-major (numpy default): 1, 2, 3, 4, 5, 6
    # Column-major (MATLAB):      1, 4, 2, 5, 3, 6
    assert list(flatten_fortran(a)) == [1, 4, 2, 5, 3, 6]


def test_sort_with_index_1d():
    x = np.array([3, 1, 2])
    sorted_vals, idx = sort_with_index(x)
    assert list(sorted_vals) == [1, 2, 3]
    assert list(idx) == [1, 2, 0]


def test_sort_with_index_descending():
    x = np.array([1, 3, 2])
    sorted_vals, idx = sort_with_index(x, descending=True)
    assert list(sorted_vals) == [3, 2, 1]
    assert list(idx) == [1, 2, 0]


# ── matlab_size ──────────────────────────────────────────────

def test_matlab_size_2d():
    a = np.zeros((3, 4))
    assert matlab_size(a) == (3, 4)
    assert matlab_size(a, 1) == 3
    assert matlab_size(a, 2) == 4


def test_matlab_size_1d_treated_as_row():
    # MATLAB: size([1 2 3 4]) → [1 4]
    a = np.array([1, 2, 3, 4])
    assert matlab_size(a) == (1, 4)


def test_matlab_size_trailing_singleton():
    # MATLAB: size([1 2 3], 5) → 1
    a = np.array([1, 2, 3])
    assert matlab_size(a, 5) == 1


def test_matlab_size_scalar():
    # MATLAB: size(5) → [1 1]
    assert matlab_size(5) == (1, 1)


# ── matlab_numel ─────────────────────────────────────────────

def test_matlab_numel():
    assert matlab_numel(np.zeros((3, 4))) == 12
    assert matlab_numel([1, 2, 3, 4, 5]) == 5
    assert matlab_numel(7) == 1
