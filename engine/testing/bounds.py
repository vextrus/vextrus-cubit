"""Bounds a test asserts on the work a piece of code does: its peak memory and how many times it
calls something. Never wall time, which moves with the machine (session 05's reviews needed these
three times: a range built before its limit was checked, a walk keeping every transform, a read
visiting each space again).

    with peak_memory(16 * 2**20):
        refuse(hostile)

    with calls(module, "read_space", at_most=len(spaces)) as counted:
        read(drawing)
"""

import functools
import inspect
import tracemalloc
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any


@dataclass
class Peak:
    bytes: int = 0
    """The most traced memory the block held at once, over what it held on entry."""


@contextmanager
def peak_memory(limit: int) -> Iterator[Peak]:
    """Asserts the block's peak traced allocation (Python's allocator only, not a C library's own)
    stays under `limit` bytes. Inside another trace, it resets the peak and leaves the trace on."""
    tracing = tracemalloc.is_tracing()
    if tracing:
        tracemalloc.reset_peak()
    else:
        tracemalloc.start()
    start, _ = tracemalloc.get_traced_memory()
    peak = Peak()
    try:
        yield peak
        _, top = tracemalloc.get_traced_memory()
        peak.bytes = top - start
    finally:
        if not tracing:
            tracemalloc.stop()
    assert peak.bytes < limit, f"peak {peak.bytes:,} bytes, over the bound of {limit:,}"


@dataclass
class Calls:
    calls: int = 0


@contextmanager
def calls(owner: Any, name: str, *, at_most: int) -> Iterator[Calls]:
    """Counts the block's calls of `owner.name` (a module's function, a class's method, static or
    class method, or an instance's) and asserts no more than `at_most`. What `owner` held is put
    back after, whatever the block raised: its own descriptor, or nothing if it inherited it."""
    raw = inspect.getattr_static(owner, name)
    own = name in getattr(owner, "__dict__", {})
    counted = Calls()
    kind = type(raw) if isinstance(raw, staticmethod | classmethod) else None
    function: Callable[..., Any] = raw.__func__ if kind else raw

    @functools.wraps(function)
    def counting(*args: Any, **kwargs: Any) -> Any:
        counted.calls += 1
        return function(*args, **kwargs)

    setattr(owner, name, kind(counting) if kind else counting)
    try:
        yield counted
    finally:
        if own:
            setattr(owner, name, raw)
        else:
            delattr(owner, name)
    assert counted.calls <= at_most, f"{name} called {counted.calls:,} times, over {at_most:,}"
