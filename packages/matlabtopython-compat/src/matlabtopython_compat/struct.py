"""
Struct — MATLAB struct with attribute AND dict-style access.

MATLAB structs let you write `s.name = value` or `s.(dynfield) = value`.
Python's `dict` gives you the second form; `types.SimpleNamespace` gives
you the first. Struct combines them so converted MATLAB code reads the
same as the original, regardless of whether the user wrote `s.name` or
`s.('name')`.

Construction:
    s = Struct(name='Alice', age=30)
    s = Struct({'name': 'Alice', 'age': 30})   # from dict

Usage:
    s.name          # 'Alice'
    s['name']       # 'Alice'
    s.name = 'Bob'
    s['name'] = 'Bob'
    'name' in s     # True
    list(s.keys())  # ['name', 'age']
"""

from __future__ import annotations
from typing import Any, Iterator


class Struct:
    def __init__(self, *args, **kwargs):
        if len(args) > 1:
            raise TypeError("Struct() takes at most one positional argument")
        object.__setattr__(self, "_data", {})
        if args:
            source = args[0]
            if isinstance(source, dict):
                self._data.update(source)
            elif isinstance(source, Struct):
                self._data.update(source._data)
            else:
                raise TypeError(
                    f"Struct() positional arg must be dict or Struct, got {type(source).__name__}"
                )
        self._data.update(kwargs)

    # ── Attribute access (MATLAB `s.name`) ────────────────────

    def __getattr__(self, key: str) -> Any:
        try:
            return self._data[key]
        except KeyError:
            raise AttributeError(f"Struct has no field '{key}'")

    def __setattr__(self, key: str, value: Any) -> None:
        if key == "_data":
            object.__setattr__(self, key, value)
        else:
            self._data[key] = value

    def __delattr__(self, key: str) -> None:
        try:
            del self._data[key]
        except KeyError:
            raise AttributeError(f"Struct has no field '{key}'")

    # ── Dict access (MATLAB `s.(name)`) ───────────────────────

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self._data[key] = value

    def __delitem__(self, key: str) -> None:
        del self._data[key]

    def __contains__(self, key: object) -> bool:
        return key in self._data

    # ── Introspection ────────────────────────────────────────

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Struct):
            return self._data == other._data
        if isinstance(other, dict):
            return self._data == other
        return NotImplemented

    def __repr__(self) -> str:
        entries = ", ".join(f"{k}={v!r}" for k, v in list(self._data.items())[:4])
        suffix = f", ...({len(self._data) - 4} more)" if len(self._data) > 4 else ""
        return f"Struct({entries}{suffix})"

    def to_dict(self) -> dict:
        return dict(self._data)
