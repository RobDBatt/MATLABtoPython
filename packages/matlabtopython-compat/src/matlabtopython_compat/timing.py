"""
MATLAB `tic` / `toc` timing helpers.

MATLAB usage:
    tic
    ... code ...
    toc                  % prints `Elapsed time is X seconds.`
    t = toc;             % returns seconds as a number

Our version matches both forms — calling `toc()` with no args prints
AND returns the elapsed seconds; `toc(t_start)` returns elapsed seconds
for a specific handle.

    from matlabtopython_compat import tic, toc
    t0 = tic()
    ...
    toc()                # prints "Elapsed time is 0.01 seconds."
    elapsed = toc(t0)    # returns float
"""

from __future__ import annotations
import time


_last_tic: float | None = None


def tic() -> float:
    """Record a start time. Returns a handle you can pass to toc() later."""
    global _last_tic
    now = time.perf_counter()
    _last_tic = now
    return now


def toc(handle: float | None = None, *, silent: bool = False) -> float:
    """
    Return elapsed seconds since `tic()` (or since the `handle` argument).
    Prints MATLAB-compatible "Elapsed time is X seconds." unless silent=True.
    """
    start = handle if handle is not None else _last_tic
    if start is None:
        raise RuntimeError("toc() called before tic()")
    elapsed = time.perf_counter() - start
    if not silent:
        print(f"Elapsed time is {elapsed:.6f} seconds.")
    return elapsed
