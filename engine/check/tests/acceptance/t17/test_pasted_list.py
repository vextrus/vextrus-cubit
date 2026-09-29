"""Ticket 17's acceptance on 19b's `engine.check.register.parse` (a named shared edit; #100 and the
session-06 rulings, "17"): a pasted list's control characters become a space and never join digits;
a bare carriage return is a line break; a revision in the number is split off.

Read with 13's own readers under the default sheet conventions.
"""

import json
from pathlib import Path

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


def numbers(text: str) -> list[str]:
    return [e.number for e in parse(text, CONVENTIONS, recognisers=READERS).entries]


def test_a_control_character_between_digits_becomes_a_space_never_joining_them() -> None:
    """ "S-01\\x7f9" is not sheet "S-019"."""
    found = numbers("S-01\x7f9\tPILE LAYOUT PLAN\nS-02\tCOLUMN LAYOUT PLAN\n")
    assert "S-019" not in found
    assert "S-02" in found


def test_other_control_characters_become_a_space() -> None:
    for control in ("\x00", "\x07", "\x1b", "\x85"):
        found = numbers(f"S-01{control}2\tPILE LAYOUT PLAN\n")
        assert "S-012" not in found, repr(control)


def test_a_bare_carriage_return_is_a_line_break() -> None:
    """A paste from an API client with bare CRs: every sheet read, none lost."""
    entries = parse(
        "S-01\tPILE LAYOUT PLAN\rS-02\tCOLUMN LAYOUT PLAN\rS-03\tBEAM LAYOUT PLAN",
        CONVENTIONS,
        recognisers=READERS,
    ).entries
    assert [(e.number, e.title) for e in entries] == [
        ("S-01", "PILE LAYOUT PLAN"),
        ("S-02", "COLUMN LAYOUT PLAN"),
        ("S-03", "BEAM LAYOUT PLAN"),
    ]
    assert [e.line for e in entries] == [1, 2, 3]


def test_a_revision_in_the_number_is_split_off() -> None:
    """ "S-01 R1" in the number's cell: the sheet is S-01, its revision mark R1."""
    (entry,) = parse("S-01 R1\tPILE LAYOUT PLAN\n", CONVENTIONS, recognisers=READERS).entries
    assert (entry.number, entry.revision_mark, entry.title) == ("S-01", "R1", "PILE LAYOUT PLAN")
