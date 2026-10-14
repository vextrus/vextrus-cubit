"""S28-R1 item 1: "An UNPROVEN finding no longer blocks (`scripts/ledger.py` `STANDS`)." Measured: none
of 260 FIX verdicts rested on UNPROVEN findings alone; a finding blocks only when a refuter CONFIRMED it.
The acceptance pin: "UNPROVEN 80 does not block"."""

import pytest

from scripts.tests.acceptance.ts28r1._bar import LAX, STRICT, decision

STILL_BLOCKED = "scripts.ledger: an UNPROVEN finding still blocks"


@pytest.mark.parametrize(
    "line",
    [
        f"FINDING f1 80 UNPROVEN {STRICT}",  # untagged, as before the tags
        f"FINDING f1 80 UNPROVEN {STRICT} class=user-facing boundary=yes",  # tagged, no observed=
        "FINDING f1 80 UNPROVEN",  # no file: judged strict
    ],
)
def test_an_unproven_80_does_not_block(line: str) -> None:
    decided = decision("FIX", line)
    assert decided.verdict == "PASS", f"{STILL_BLOCKED}: {line!r} decided {decided.verdict}"


def test_an_unproven_80_beside_a_confirmed_80_still_fixes() -> None:
    """Only the UNPROVEN one stops counting: a CONFIRMED 80 still blocks."""
    decided = decision("PASS", f"FINDING f1 80 UNPROVEN {STRICT}", f"FINDING f2 80 CONFIRMED {LAX}")
    assert decided.verdict == "FIX", f"scripts.ledger: a CONFIRMED 80 decided {decided.verdict}"
