"""
CellArray — MATLAB cell-array semantics in Python.

MATLAB cell arrays hold heterogeneous values indexed with `{}` braces,
and support MATLAB-style 1-based indexing, `end` keyword in slices, and
`cell(N)` construction. This class gives you the same ergonomics on top
of a plain Python list so converted code reads naturally.

Construction:
    c = CellArray(['a', 1, [1, 2, 3]])     # from iterable
    c = CellArray.cell(5)                  # 5 empty slots (None)

Access:
    c.cell(1)                               # MATLAB c{1} — 1-based
    c.get(0)                                # 0-based
    len(c)                                  # count
    c.to_list()                             # plain list
"""

from __future__ import annotations
from typing import Any, Iterable, Iterator


class CellArray:
    __slots__ = ("_items",)

    def __init__(self, items: Iterable[Any] = ()):
        self._items = list(items)

    # ── MATLAB-style constructors ─────────────────────────────

    @classmethod
    def cell(cls, n: int) -> "CellArray":
        """Equivalent to MATLAB `cell(n)` — n empty slots."""
        return cls([None] * n)

    # ── Indexing ──────────────────────────────────────────────

    def get(self, i: int) -> Any:
        """0-based getter (normal Python)."""
        return self._items[i]

    def set(self, i: int, value: Any) -> None:
        """0-based setter."""
        self._items[i] = value

    def cell_get(self, i: int) -> Any:
        """MATLAB `c{i}` — 1-based."""
        return self._items[i - 1]

    def cell_set(self, i: int, value: Any) -> None:
        """MATLAB `c{i} = value` — 1-based."""
        # Grow if needed, MATLAB-style
        while len(self._items) < i:
            self._items.append(None)
        self._items[i - 1] = value

    def __getitem__(self, key):
        return self._items[key]

    def __setitem__(self, key, value):
        self._items[key] = value

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self) -> Iterator[Any]:
        return iter(self._items)

    def __repr__(self) -> str:
        preview = ", ".join(repr(x) for x in self._items[:4])
        suffix = f", ...({len(self._items) - 4} more)" if len(self._items) > 4 else ""
        return f"CellArray([{preview}{suffix}])"

    # ── Conversions ──────────────────────────────────────────

    def to_list(self) -> list:
        return list(self._items)

    def unpack(self) -> tuple:
        """MATLAB `c{:}` — spread to positional args."""
        return tuple(self._items)
