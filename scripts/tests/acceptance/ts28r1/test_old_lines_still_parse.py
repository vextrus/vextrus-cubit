"""S28-R1 item 4 and the orchestrator's hold (the owner's Q9, reversible default): "A FINDING line
missing `observed=`: ... parse as `observed=no`, so the finding blocks only on boundary=yes or score
>= 75 — and the parser must not crash on old lines in the ledger." The acceptance pin: "old FINDING
lines without observed= still parse"."""

import pytest

from scripts.tests.acceptance.ts28r1._bar import LAX, STRICT, decision


@pytest.mark.parametrize("kind", ["user-facing", "edge", "rule-only"])
def test_an_old_tagged_60_off_a_boundary_reads_as_not_observed_and_is_filed(kind: str) -> None:
    line = f"FINDING f1 60 CONFIRMED {LAX} class={kind} boundary=no"
    decided = decision("FIX", line)
    assert (decided.verdict, decided.to_file) == ("PASS", ("f1",)), (
        f"scripts.ledger: an old line without observed= {line!r} decided {decided.verdict}, "
        f"to file {decided.to_file}"
    )


@pytest.mark.parametrize(
    "line",
    [
        f"FINDING f1 60 CONFIRMED {LAX} class=user-facing boundary=yes",
        f"FINDING f1 75 CONFIRMED {LAX} class=edge boundary=no",
    ],
    ids=["60-on-a-boundary", "75"],
)
def test_an_old_tagged_line_on_a_boundary_or_at_75_still_blocks(line: str) -> None:
    decided = decision("PASS", line)
    assert decided.verdict == "FIX", f"scripts.ledger: an old line {line!r} decided {decided.verdict}"


@pytest.mark.parametrize(
    "line",
    [
        f"FINDING f1 60 CONFIRMED {LAX}",
        f"FINDING f1 60 REFUTED {STRICT}",
        "FINDING f1 40 CONFIRMED",
        f"FINDING r1-f1 80 REFUTED {STRICT}:12 class=edge boundary=no",
    ],
)
def test_an_old_line_still_parses(line: str) -> None:
    """Untagged lines (before the 13 Oct tags) and tagged ones (before R1) are read, not refused; the
    verdict of an untagged 50-74 on a strict path is not pinned here (the ticket leaves the path bar)."""
    assert decision("PASS", line).verdict in ("PASS", "FIX")
