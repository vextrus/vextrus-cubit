"""Nothing this lane drives may speak on the caller's own streams (L-CAD-01, L-CAD-04).

`cad/` is a subprocess whose answer is the artifact it writes, so its stdout and stderr belong to
whoever spawned it. A reader library disagrees by default: every `logging.WARNING` ezdxf emits
travels to `logging.lastResort`, which writes it straight onto this process's stderr, and a library
warning would do the same. Both are held here for the duration of a read instead. What was said is
not thrown away — it is handed back to the caller, which folds it into the refusal that names the
drawing (L-CAD-04's loud failures), rather than leaking beside the answer.
"""

from __future__ import annotations

import logging
import warnings
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Final

#: The libraries this lane reads with; each one's records are held for the read's duration.
_LIBRARIES: Final = ("ezdxf",)

#: How much of a library's own words a refusal carries.
_SAID_TAIL: Final = 400


class _Held(logging.Handler):
    """A handler that keeps what it is given rather than writing it anywhere."""

    def __init__(self, said: list[str]) -> None:
        super().__init__()
        self._said = said

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self._said.append(record.getMessage())
        except Exception:
            # A record this handler cannot render is still not noise to put on the caller's
            # stderr, which is what logging's own error handling would do with it.
            self._said.append(str(record.msg))


@contextmanager
def held_library_words() -> Iterator[list[str]]:
    """Hold every library log record and warning raised inside the block; say nothing."""
    said: list[str] = []
    held = _Held(said)
    restored: list[tuple[logging.Logger, bool]] = []
    for name in _LIBRARIES:
        logger = logging.getLogger(name)
        restored.append((logger, logger.propagate))
        logger.addHandler(held)
        # Handled here and nowhere above: a root handler the caller configured, or the last-resort
        # one it did not, would otherwise write these records to a stream that is not ours.
        logger.propagate = False
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            yield said
    finally:
        for logger, propagate in restored:
            logger.removeHandler(held)
            logger.propagate = propagate


def said(words: list[str]) -> str:
    """A library's own words, deduplicated in order and trimmed, for a refusal that quotes them."""
    seen = dict.fromkeys(word.strip() for word in words if word.strip())
    spoken = "; ".join(seen)
    return f" — {spoken[-_SAID_TAIL:]}" if spoken else ""
