"""The one place a plot test reads a clock: each timed side is the least of several runs."""

import time
from collections.abc import Callable

RUNS = 5


def best_of(
    call: Callable[[], object], *, runs: int = RUNS, clock: Callable[[], float] = time.monotonic
) -> float:
    """The least time, in seconds, of `runs` calls: a loaded runner slows some runs, not all of them,
    while a real regression slows every run."""
    least = float("inf")
    for _ in range(runs):
        began = clock()
        call()
        least = min(least, clock() - began)
    return least
