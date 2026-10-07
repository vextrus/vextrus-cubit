"""An act's transaction tried again when PostgreSQL aborted it to end a deadlock, or for a
serialization failure (#227): the backstop behind the lock orders that keep acts and read jobs out
of a cycle, so a QS's act is never lost to one as a 500.

    view = deadlocks.retried(lambda: act(...), what="step1.confirm")

The transaction tried again is the outermost one, whose rollback released every lock:
- **In a request** (the tenant middleware wraps each request in one transaction, `requests`): the act
  runs once; aborted, it marks the request and raises, the request is rolled back (a 500 inside), and
  the middleware runs the whole request again. Only a request whose act called `retried` is ever
  run again: the act routes opt in.
- **Outside any transaction** (a worker, a command): the act itself is tried again.
- **Inside another transaction**, not a request's: the error is raised (its locks are still held).

At most `RETRIES` retries, each after a short jittered pause, each logged as a warning.

**A lock wait is bounded** (S15-A2): the act runs in a savepoint whose transaction waits on any lock
(a row, Step 1's write lock) at most `LOCK_TIMEOUT_MS` (`SET LOCAL lock_timeout`); a wait that runs
out rolls the act back and refuses it, `platform.acts.busy` (503), so a QS is told to try again
rather than left waiting on a stuck writer. The request's transaction stays usable, and is rolled
back as every refused request is.
"""

import contextvars
import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from django.db import OperationalError, connection, transaction

from vextrus.platform.messages import acts as said
from vextrus.platform.services import auth

logger = logging.getLogger(__name__)

RETRIES = 2
"""Tries after the first, each after a short jittered pause."""
ABORTED = frozenset({"40P01", "40001"})
"""deadlock_detected and serialization_failure: PostgreSQL rolled the transaction back whole."""
PAUSE = 0.05
"""Seconds, before the jitter and the try's multiple."""
LOCK_TIMEOUT_MS = 3000
"""How long an act's transaction waits on one lock before it is refused (`platform.acts.busy`):
longer than a read job's short write phase, well inside a QS's patience (S15-A2)."""
LOCK_NOT_AVAILABLE = "55P03"
"""lock_not_available: a lock wait ran past `lock_timeout`."""


def aborted(error: BaseException) -> bool:
    """Whether PostgreSQL aborted the transaction to end a deadlock or a serialization failure."""
    return isinstance(error, OperationalError) and _code(error) in ABORTED


def _code(error: BaseException) -> str:
    return str(getattr(error.__cause__, "sqlstate", "") or "")


@dataclass
class Request:
    """A request's tries (the tenant middleware's): the act aborted in its last try, if any."""

    aborted_act: str = ""
    code: str = ""


_REQUEST: contextvars.ContextVar[Request | None] = contextvars.ContextVar(
    "deadlocks_request", default=None
)


def will_retry(error: BaseException) -> bool:
    """Whether the request now running will be run again for this error (`retried` marked it)."""
    request = _REQUEST.get()
    return request is not None and bool(request.aborted_act) and aborted(error)


def pause(attempt: int, base: float | None = None) -> None:
    time.sleep((PAUSE if base is None else base) * (attempt + 1) * (1 + random.random()))


def log_retry(what: str, code: str, attempt: int) -> None:
    logger.warning("%s: transaction aborted (%s), retry %d of %d", what, code, attempt + 1, RETRIES)


def requests(run: Callable[[], Any], *, done: Callable[[Any], bool], base: float | None = None) -> Any:
    """Run a request (`run` opens its transaction and answers its response) up to `RETRIES` more
    times while an act in it was aborted (`retried`) and `done(response)` is False (a streamed
    response is never run again: the caller says so)."""
    for attempt in range(RETRIES + 1):
        tries = Request()
        token = _REQUEST.set(tries)
        try:
            response = run()
        finally:
            _REQUEST.reset(token)
        if not tries.aborted_act or attempt == RETRIES or done(response):
            return response
        log_retry(tries.aborted_act, tries.code, attempt)
        pause(attempt, base)
    raise AssertionError("unreachable")


def retried[T](act: Callable[[], T], *, what: str, base: float | None = None) -> T:
    """`act()`, its lock waits bounded, tried again when PostgreSQL aborts its transaction (see the
    module)."""
    request = _REQUEST.get()
    if connection.in_atomic_block:
        try:
            return _bounded(act)
        except OperationalError as error:
            if request is not None and aborted(error):
                request.aborted_act, request.code = what, _code(error)
            raise
    for attempt in range(RETRIES + 1):
        try:
            return _bounded(act)
        except OperationalError as error:
            if attempt == RETRIES or not aborted(error):
                raise
            log_retry(what, _code(error), attempt)
            pause(attempt, base)
    raise AssertionError("unreachable")


def _bounded[T](act: Callable[[], T]) -> T:
    """`act()` in a savepoint that waits on a lock at most `LOCK_TIMEOUT_MS`; a wait that ran out is
    refused, `platform.acts.busy` (503), the act rolled back."""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("select set_config('lock_timeout', %s, true)", [f"{LOCK_TIMEOUT_MS}ms"])
            return act()
    except OperationalError as error:
        if _code(error) != LOCK_NOT_AVAILABLE:
            raise
        logger.warning("an act waited on a lock past %d ms: refused, to try again", LOCK_TIMEOUT_MS)
    raise auth.Refused(said.BUSY(), status=503)
