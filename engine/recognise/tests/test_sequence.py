"""`sheets.sequence(number, conventions) -> NumberParts | None`: a number's prefix, running number and
suffix, the shape 19b's numbering Check and conflicts build on (fixed by the orchestrator, 29 Sep 2026).

Each side of every edge is decided here: zero padding, no digit, a run too long for `int()`, Unicode
digits, which run is the running number (the last, unless a slash makes it a part), and a letter O
that looks like a zero.
"""

import pytest

from engine.recognise.sheets import MAX_RUNNING_DIGITS, NumberParts, sequence
from engine.recognise.types import SheetConventions

PLAIN = SheetConventions()


def parts(number: str) -> tuple[str, int, str] | None:
    found = sequence(number, PLAIN)
    return None if found is None else (found.prefix, found.running, found.suffix)


@pytest.mark.parametrize(
    ("number", "expected"),
    [
        ("09", ("", 9, "")),
        ("10", ("", 10, "")),
        ("9", ("", 9, "")),
        ("S-09", ("S-", 9, "")),
        ("S-10", ("S-", 10, "")),
        ("S-101A", ("S-", 101, "A")),
        ("S-101B", ("S-", 101, "B")),
        ("S-01/1", ("S-", 1, "/1")),
        ("S-01/2", ("S-", 1, "/2")),
        ("STR 007", ("STR ", 7, "")),
        ("  E-05  ", ("E-", 5, "")),
        ("A-100", ("A-", 100, "")),
        ("S1-01", ("S1-", 1, "")),
        ("S-1.01", ("S-1.", 1, "")),
        ("S-1.01/2", ("S-1.", 1, "/2")),
        ("2-S-015", ("2-S-", 15, "")),
        ("S/1", ("S/", 1, "")),
    ],
)
def test_a_number_splits_into_prefix_running_number_and_suffix(
    number: str, expected: tuple[str, int, str]
) -> None:
    assert parts(number) == expected


def test_the_running_number_is_the_last_run_of_digits_unless_a_slash_makes_it_a_part() -> None:
    """The ruling with 19b (review round 1 of 13): with no pattern in the conventions, the running
    number is the last run of digits; a run right after a `/` is a part suffix, and the running
    number is then the run before it. A run after a `/` with none before it is the running number."""
    assert parts("S1-01") == ("S1-", 1, "")
    assert parts("S-1.01") == ("S-1.", 1, "")
    assert parts("S-01/1") == ("S-", 1, "/1")
    assert parts("S-101A") == ("S-", 101, "A")
    for a, b in (("S1-09", "S1-10"), ("S-1.09", "S-1.10"), ("S-09/1", "S-10/1")):
        first, second = sequence(a, PLAIN), sequence(b, PLAIN)
        assert first is not None
        assert second is not None
        assert first.prefix == second.prefix
        assert second.running - first.running == 1


def test_consecutive_numbers_share_a_prefix_and_step_by_one() -> None:
    """Zero padding is not part of the number: "09" and "10", "S-09" and "S-10" are consecutive."""
    for a, b in (("09", "10"), ("S-09", "S-10"), ("9", "10"), ("S-099", "S-100")):
        first, second = sequence(a, PLAIN), sequence(b, PLAIN)
        assert first is not None
        assert second is not None
        assert first.prefix == second.prefix
        assert second.running - first.running == 1


def test_a_letter_o_is_not_a_zero() -> None:
    """Numbers are read as drawn, never normalised: "S-O1" has the prefix "S-O", so a Check sees it
    is not in the "S-" sequence rather than silently taking it as "S-01"."""
    assert parts("S-O1") == ("S-O", 1, "")
    assert parts("S-01") == ("S-", 1, "")


@pytest.mark.parametrize("number", ["", "   ", "\u200b", "\ufeff\u202e", "S-", "ABC", "--", "\u00b2"])
def test_a_number_with_no_digit_has_no_parts(number: str) -> None:
    assert sequence(number, PLAIN) is None


def test_a_run_too_long_is_refused_before_it_is_counted() -> None:
    """`int()` refuses past 4,300 digits; a run past `MAX_RUNNING_DIGITS` is never turned into one."""
    assert sequence("S-" + "9" * 5000, PLAIN) is None
    assert sequence("S-1-" + "9" * 5000, PLAIN) is None
    assert sequence("S-" + "9" * 5000 + "/1", PLAIN) is None
    assert sequence("S-" + "9" * (MAX_RUNNING_DIGITS + 1), PLAIN) is None
    longest = sequence("S-" + "9" * MAX_RUNNING_DIGITS, PLAIN)
    assert longest is not None
    assert longest.running == int("9" * MAX_RUNNING_DIGITS)


@pytest.mark.parametrize(
    ("number", "expected"),
    [
        ("S-\u09e6\u09ef", ("S-", 9, "")),  # Bangla \u09e6\u09ef
        ("\u0661\u0662", ("", 12, "")),  # Arabic-Indic \u0661\u0662
        ("E-\uff10\uff15", ("E-", 5, "")),  # fullwidth \uff10\uff15
        ("S-2\u00b2", ("S-", 2, "\u00b2")),  # a superscript is not a digit: it is suffix
    ],
)
def test_unicode_digits_follow_one_rule(number: str, expected: tuple[str, int, str]) -> None:
    """A digit is a Unicode decimal digit of any script; a superscript (`isdigit` takes it, `int`
    refuses it) is not one."""
    assert parts(number) == expected


def test_invisible_characters_are_not_part_of_a_number() -> None:
    assert parts("S-\u200b09") == ("S-", 9, "")
    assert parts("\u202eS-09") == ("S-", 9, "")


def test_a_pattern_in_the_conventions_decides_where_the_running_number_is() -> None:
    """An office numbering "S-015-2024" (a running number, then a year) names its parts by pattern
    (data a Drafting Profile holds)."""
    office = SheetConventions(
        number_patterns=(r"^(?P<prefix>[A-Z]-)(?P<running>\d{1,4})(?P<suffix>-\d{4})$",)
    )

    assert sequence("S-015-2024", office) == NumberParts("S-", 15, "-2024")
    assert sequence("S-015-2024", PLAIN) == NumberParts("S-015-", 2024, "")
    assert sequence("S-02", office) == NumberParts("S-", 2, "")
