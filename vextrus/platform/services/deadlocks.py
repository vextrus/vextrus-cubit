"""An act's transaction tried again when PostgreSQL aborted it to end a deadlock, or for a
serialization failure (#227): the backstop behind the lock orders that keep acts and read jobs out
of a cycle, so a QS's act is never lost to one as a 500.

    view = deadlocks.retried(lambda: act(...), what="step1.confirm")

Only an outermost transaction is tried again (inside another, the error is the outer one's to
handle, and its locks are still held). Each retry is logged.
"""

import logging
import random
import time
from collections.abc import Callable

from django.db import OperationalError, connection

logger = logging.getLogger(__name__)

RETRIES = 2
"""Tries after the first, each after a short jittered pause."""
ABORTED = frozenset({"40P01", "40001"})
"""deadlock_detected and serialization_failure: PostgreSQL rolled the transaction back whole."""


def aborted(error: OperationalError) -> bool:
    """Whether PostgreSQL aborted the transaction to end a deadlock or a serialization failure."""
    return getattr(error.__cause__, "sqlstate", None) in ABORTED


def retried[T](act: Callable[[], T], *, what: str, pause: float = 0.05) -> T:
    """`act()` (which opens its own transaction), tried again up to `RETRIES` times when aborted."""
    outermost = not connection.in_atomic_block
    for attempt in range(RETRIES + 1):
        try:
            return act()
        except OperationalError as error:
            if not outermost or attempt == RETRIES or not aborted(error):
                raise
            logger.warning(
                "%s: transaction aborted (%s), retry %d of %d",
                what,
                getattr(error.__cause__, "sqlstate", ""),
                attempt + 1,
                RETRIES,
            )
            time.sleep(pause * (attempt + 1) * (1 + random.random()))
    raise AssertionError("unreachable")
