"""17's edits to 19b's `register.parse` (#100), on the refuter's inputs: nothing between two digits
joins them, and a revision written after a number is split off wherever the line puts it."""

import json
from pathlib import Path

import pytest

from engine.check.register import parse
from engine.recognise import conflicts
from engine.recognise.types import SheetConventions

CONVENTIONS = SheetConventions.from_json(
    json.loads(
        (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(
            encoding="utf-8"
        )
    )
)
READERS = conflicts.recognisers(CONVENTIONS)


def read(text: str) -> list[tuple[str, str | None, str | None]]:
    entries = parse(text, CONVENTIONS, recognisers=READERS).entries
    return [(e.number, e.revision_mark, e.title) for e in entries]


@pytest.mark.parametrize("between", ["\u200f", "\u202e", "\u2066", "\u2028", "\u2029"])
def test_a_direction_control_or_separator_between_digits_never_joins_them(between: str) -> None:
    found = read(f"S-01{between}9\tPILE LAYOUT PLAN\nS-02\tCOLUMN LAYOUT PLAN\n")
    assert "S-019" not in [n for n, _, _ in found]
    assert ("S-02", None, "COLUMN LAYOUT PLAN") in found


@pytest.mark.parametrize(
    ("line", "entry"),
    [
        ("1\tS-01 R1\tPILE LAYOUT PLAN", ("S-01", "R1", "PILE LAYOUT PLAN")),
        ("1 S-01 R1 PILE LAYOUT PLAN", ("S-01", "R1", "PILE LAYOUT PLAN")),
        ("S-01 R1 PILE LAYOUT PLAN", ("S-01", "R1", "PILE LAYOUT PLAN")),
        ("S-01 REV A\tPILE LAYOUT PLAN", ("S-01", "REV A", "PILE LAYOUT PLAN")),
        ("S-01 REV A PILE LAYOUT PLAN", ("S-01", "REV A", "PILE LAYOUT PLAN")),
        ("S-01\tPILE LAYOUT PLAN\tR2", ("S-01", "R2", "PILE LAYOUT PLAN")),
        ("S-01 R1\tPILE LAYOUT PLAN\tR2", ("S-01", "R2", "PILE LAYOUT PLAN")),  # the column wins
    ],
)
def test_a_revision_after_the_number_is_split_off_wherever_it_stands(
    line: str, entry: tuple[str, str | None, str | None]
) -> None:
    assert read(line + "\n") == [entry]


@pytest.mark.parametrize("hidden", ["\u200b", "\u00ad", "\u2060", "\ufeff"])
def test_a_format_character_in_a_pasted_number_is_dropped(hidden: str) -> None:
    """The ruling of 17's fix round 1: zero-width space, soft hyphen, word joiner, byte-order mark."""
    assert read(f"S-0{hidden}7\tPILE LAYOUT PLAN\n") == [("S-07", None, "PILE LAYOUT PLAN")]
