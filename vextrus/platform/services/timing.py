"""A request's server time, split, as its `Server-Timing` header (S29-M0b): G1's act timer reads it per
act, so the walk can tell the server's work from waiting on a lock.

The tenant middleware opens one `request()` around the whole request (its retries included). A route
names the waits it reports (`report("lock")`, written 0 when nothing waited); code that waits measures
the wait under that name (`waited("lock")`). The header is written only on a response whose request
reported or measured a wait (any route that takes Step 1's write lock), as `app;dur=<ms>,
<name>;dur=<ms>`: `app` is the request's time less every wait, each in milliseconds to a tenth. Outside
a request (a job, the seed) nothing is measured.

    with timing.request() as timed:
        response = view(request)
    timing.write(response, timed)
"""

import contextlib
import contextvars
import time
from collections.abc import Iterator
from dataclasses import dataclass, field

from django.http import HttpResponse

HEADER = "Server-Timing"
APP = "app"


@dataclass
class Timed:
    """One request's clock: when it started, and each reported wait's total in seconds."""

    started: float = field(default_factory=time.perf_counter)
    waits: dict[str, float] = field(default_factory=dict)


_TIMED: contextvars.ContextVar[Timed | None] = contextvars.ContextVar("server_timing", default=None)


@contextlib.contextmanager
def request() -> Iterator[Timed]:
    """A request's clock, from now to its block's end; a block inside another shares the outer's."""
    outer = _TIMED.get()
    if outer is not None:
        yield outer
        return
    timed = Timed()
    token = _TIMED.set(timed)
    try:
        yield timed
    finally:
        _TIMED.reset(token)


def report(*names: str) -> None:
    """The waits this request's answer reports by name, 0 until one is measured."""
    timed = _TIMED.get()
    if timed is None:
        return
    for name in names:
        if name == APP:
            raise ValueError(f"{APP!r} is the request's own time, not a wait")
        timed.waits.setdefault(name, 0.0)


@contextlib.contextmanager
def waited(name: str) -> Iterator[None]:
    """The block's time added to the wait `name`, in a request (a retried act's waits add up)."""
    timed = _TIMED.get()
    if timed is None:
        yield
        return
    began = time.perf_counter()
    try:
        yield
    finally:
        timed.waits[name] = timed.waits.get(name, 0.0) + time.perf_counter() - began


def header(timed: Timed, *, now: float | None = None) -> str:
    """`app;dur=<ms>` then each wait's `<name>;dur=<ms>`, in the order reported."""
    total = (time.perf_counter() if now is None else now) - timed.started
    waits = sum(timed.waits.values())
    metrics = [(APP, max(0.0, total - waits)), *timed.waits.items()]
    return ", ".join(f"{name};dur={seconds * 1000:.1f}" for name, seconds in metrics)


def write(response: HttpResponse, timed: Timed) -> None:
    """The header on `response` when its request reported or measured a wait; else as it is."""
    if timed.waits:
        response[HEADER] = header(timed)
