"""S28-R1 item 2: "A 50-74 finding blocks only when its input is one a QS would meet or it is on a trust
boundary; else it is filed with its owed check. Mechanically: each lens tags a finding `observed=yes|no`
beside `class=` and `boundary=` on its FINDING line ... and `ledger.could_block` for 50-74 requires
`observed=yes` or `boundary=yes` (75 and more unchanged). A 50-74 finding with neither goes to the
ledger's `to-file` list with its owed check."

The acceptance pins: 60 observed=no boundary=no does not block and is listed to-file; 60 observed=yes
blocks; 60 boundary=yes blocks; 75 observed=no blocks. `class=` no longer decides a 50-74 on its own: a
user-facing 60 that no Development Set, `seed_demo` or the served stack produced is filed."""

import pytest

from scripts import ledger
from scripts.tests.acceptance.ts28r1._bar import HEAD, LAX, decision

CLASSES = ("user-facing", "edge", "rule-only")


@pytest.mark.parametrize("kind", CLASSES)
def test_a_60_neither_observed_nor_on_a_boundary_does_not_block_and_is_filed(kind: str) -> None:
    line = f"FINDING f1 60 CONFIRMED {LAX} class={kind} boundary=no observed=no"
    decided = decision("FIX", line)
    assert (decided.verdict, decided.to_file) == ("PASS", ("f1",)), (
        f"scripts.ledger: {line!r} decided {decided.verdict}, to file {decided.to_file}"
    )


def test_a_60_with_no_refuter_verdict_that_cannot_block_is_filed_not_refused() -> None:
    """A finding that cannot block needs no refuter: `decide` refuses only one that could block."""
    line = f"FINDING f1 60 - {LAX} class=user-facing boundary=no observed=no"
    decided = decision("FIX", line)
    assert (decided.verdict, decided.to_file) == ("PASS", ("f1",)), (
        f"scripts.ledger: {line!r} decided {decided.verdict}, to file {decided.to_file}"
    )


@pytest.mark.parametrize(
    "line",
    [
        f"FINDING f1 60 CONFIRMED {LAX} class=user-facing boundary=no observed=yes",
        f"FINDING f1 60 CONFIRMED {LAX} class=edge boundary=yes observed=no",
        f"FINDING f1 75 CONFIRMED {LAX} class=edge boundary=no observed=no",
        f"FINDING f1 75 CONFIRMED {LAX} class=rule-only boundary=no observed=no",
    ],
    ids=["60-observed", "60-on-a-boundary", "75-edge-not-observed", "75-rule-only-not-observed"],
)
def test_a_finding_that_still_blocks_records_fix(line: str) -> None:
    decided = decision("PASS", line)
    assert (decided.verdict, decided.to_file) == ("FIX", ()), (
        f"scripts.ledger: {line!r} decided {decided.verdict}, to file {decided.to_file}"
    )


@pytest.mark.parametrize("value", ["maybe", "", "YES", "true"])
def test_an_observed_tag_but_yes_or_no_is_refused(value: str) -> None:
    """The ledger is a gate's parser: a tag it cannot read is refused, never guessed (as `class=` and
    `boundary=` are)."""
    line = f"FINDING f1 60 CONFIRMED {LAX} class=edge boundary=no observed={value}"
    with pytest.raises(ledger.BadInput):
        ledger.decide(f"VERDICT: FIX at {HEAD}\n{line}\n".encode(), HEAD)
