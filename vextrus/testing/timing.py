"""Wall-clock bounds scaled by the machine (S29-F2a, #851): a test that must bound an act's time
takes `scaled(seconds)`, never a fixed number, because one machine running several suites at once
(CI's parallel PRs, a builder's verify) is slower than the bound's author's.

The factor is a load margin (`MARGIN`), or `VEXTRUS_TIME_SCALE` when that is larger: the fast verify
sets it from the machine's load (`scripts.verify.time_scale`). A bound so scaled still catches what it
was written for (an act that waits on a lock waits the 3 s lock_timeout, longer than 0.5 s x 3); a
proof that something did not wait belongs to a count or Postgres's `pg_blocking_pids`, not a clock.
"""

import math
import os

SCALE_ENV = "VEXTRUS_TIME_SCALE"
MARGIN = 3.0
"""A loaded machine's slowdown a bound absorbs at least: #851 measured 0.587 s against 0.5 s."""


def factor() -> float:
    """`VEXTRUS_TIME_SCALE` when it is a finite number above `MARGIN`, else `MARGIN`; read each call."""
    given = os.environ.get(SCALE_ENV, "").strip()
    try:
        value = float(given)
    except ValueError:
        return MARGIN
    return value if math.isfinite(value) and value > MARGIN else MARGIN


def scaled(seconds: float) -> float:
    """A bound of `seconds` on this machine: `seconds` times `factor()`."""
    return seconds * factor()
