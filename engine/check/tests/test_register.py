"""The drawing-list Check, the numbering's run and `parse` (ticket 19b), on hand-made candidates and
13's stand-in readers. Every finding is asserted by its code, params and subject."""

import re
import unicodedata
from typing import Any

import pytest

from engine.check import register
from engine.check.register import Gap, Parsed, Refused, Run, check, numbering, parse
from engine.recognise.tests.candidates import same, sheet
from engine.recognise.tests.stand_ins import Counted, stand_in_sequence, stand_ins
from engine.recognise.types import (
    Box,
    CheckResult,
    DisciplineConvention,
    DrawingList,
    ListEntry,
    ListSource,
    RegisterEntry,
    SetReading,
    SheetCandidate,
    SheetConventions,
)
from engine.testing.bounds import peak_memory

READERS = stand_ins()
CONVENTIONS = SheetConventions(
    disciplines=(
        DisciplineConvention("structural", ("S", "ST")),
        DisciplineConvention("architectural", ("A",)),
    ),
    revision_mark_pattern=r"R\d+|Rev [A-Z]",
)


def entry(on: SheetCandidate, number: str | None, title: str | None = None) -> RegisterEntry:
    return RegisterEntry(sheet=on, row_box=Box(0, 0, 10, 1), number=number, title=title)


def reading(
    sheets: list[SheetCandidate],
    register_entries: tuple[RegisterEntry, ...] = (),
    lists: tuple[DrawingList, ...] = (),
    read: frozenset[str] = frozenset({"register"}),
    conventions: SheetConventions | None = CONVENTIONS,
) -> SetReading:
    return SetReading(
        sheets=tuple(sheets),
        views=tuple(() for _ in sheets),
        register=register_entries,
        lists=lists,
        read=read,
        conventions=conventions,
    )


def outcomes(results: list[CheckResult]) -> list[tuple[str, Any, Any]]:
    """Each result as (outcome, subject, finding): the finding's code and params, never a count."""
    return [(str(r.outcome), r.subject, r.finding) for r in results]


def typed(group: str, discipline: str, *numbers: str) -> DrawingList:
    return DrawingList(group, discipline, ListSource.TYPED, tuple(ListEntry(n, line=1) for n in numbers))


# The list both ways ----------------------------------------------------------------------------------


def test_a_read_list_meets_bare_title_block_numbers_through_the_disciplines_prefixes() -> None:
    cover, pile, beam = sheet("01", "Notes"), sheet("02", "Pile layout"), sheet("04", "Beams")
    rows = (entry(cover, "S-01"), entry(cover, "S-02"), entry(cover, "S-03"))

    results = check(reading([cover, pile, beam], rows), recognisers=READERS)

    assert all(r.code == "register" for r in results)
    assert outcomes(results) == [
        ("passed", rows[0], None),
        ("passed", rows[1], None),
        ("fired", rows[2], {"code": "engine.register_check.not_found", "params": {"number": "S-03"}}),
        ("passed", cover, None),
        ("passed", pile, None),
        ("fired", beam, {"code": "engine.register_check.not_listed", "params": {"number": "04"}}),
    ]
    assert same([r.subject for r in results], [*rows, cover, pile, beam])


@pytest.mark.parametrize(
    ("listed", "printed", "meets"),
    [
        ("S-07", "S-07", True),
        ("S-7", "07", True),  # padding is no part of a running number
        ("ST-07", "S-07", True),  # a Discipline's prefixes are all its own
        ("s 07", "S-07", True),
        ("S-O7", "S-07", False),  # a letter O is not a zero
        ("S-07A", "S-07", False),
        ("SD-07", "07", False),  # a prefix no Discipline owns is kept
        ("SK-A", "sk-a", True),  # no running number: compared in normal form
        ("SK-A", "SK-B", False),
    ],
)
def test_numbers_meet_by_13s_reading_with_a_disciplines_own_prefix_as_none(
    listed: str, printed: str, meets: bool
) -> None:
    cover, other = sheet("S-00", "Cover"), sheet(printed, "Plan")
    results = check(
        reading([cover, other], lists=(typed("set", "structural", "S-00", listed),)), recognisers=READERS
    )
    expected = "passed" if meets else "fired"
    assert [str(r.outcome) for r in results] == ["passed", expected, "passed", expected]


def test_a_read_entry_goes_to_the_discipline_its_prefix_names_else_its_sheets() -> None:
    cover = sheet("S-01", "Drawing list")
    plan_a, plan_b = sheet("A-01", discipline="architectural"), sheet("A-02", discipline="architectural")
    rows = (entry(cover, "S-01"), entry(cover, "A-01"), entry(cover, "02"))

    results = check(reading([cover, plan_a, plan_b], rows), recognisers=READERS)

    by_subject = {id(r.subject): (str(r.outcome), r.finding) for r in results}
    assert by_subject[id(rows[1])] == ("passed", None)  # A-01 is architectural's, and found there
    assert by_subject[id(plan_a)] == ("passed", None)
    assert by_subject[id(plan_b)][1] == {
        "code": "engine.register_check.not_listed",
        "params": {"number": "A-02"},
    }
    assert by_subject[id(rows[2])][1] == {  # a bare number stays with its sheet's Discipline
        "code": "engine.register_check.not_found",
        "params": {"number": "02"},
    }


def test_a_prefix_two_disciplines_share_names_neither() -> None:
    conventions = SheetConventions(
        disciplines=(DisciplineConvention("structural", ("X",)), DisciplineConvention("fire", ("X",)))
    )
    cover, plan = sheet("X-01", "List"), sheet("X-02")
    rows = (entry(cover, "X-01"), entry(cover, "X-02"))

    results = check(reading([cover, plan], rows, conventions=conventions), recognisers=READERS)

    assert [str(r.outcome) for r in results] == ["passed"] * 4


def test_a_pasted_or_typed_list_has_no_candidate_to_name_so_its_entries_are_the_sets() -> None:
    one, two = sheet("A-01", discipline="architectural"), sheet("A-03", discipline="architectural")
    pasted = DrawingList(
        "set",
        "architectural",
        ListSource.PASTED,
        (ListEntry("A-01", 2, "Site plan"), ListEntry("A-02", 3, "Ground floor plan")),
    )

    results = check(reading([one, two], lists=(pasted,)), recognisers=READERS)

    assert outcomes(results) == [
        ("passed", None, None),
        ("fired", None, {"code": "engine.register_check.not_found", "params": {"number": "A-02"}}),
        ("passed", one, None),
        ("fired", two, {"code": "engine.register_check.not_listed", "params": {"number": "A-03"}}),
    ]


def test_lists_compare_within_their_group_and_discipline() -> None:
    here, there = sheet("S-01"), sheet("S-01", group="building-2")
    listed = typed("building-2", "structural", "S-01", "S-02")

    results = check(reading([here, there], lists=(listed,)), recognisers=READERS)

    assert outcomes(results) == [
        ("passed", None, None),
        ("fired", None, {"code": "engine.register_check.not_found", "params": {"number": "S-02"}}),
        ("passed", there, None),
        ("passed", None, None),  # building 1's structural sheets have no list: their numbering runs
    ]


def test_a_check_whose_input_was_not_read_says_nothing() -> None:
    sheets = [sheet("S-01"), sheet("S-03")]
    listed = (typed("set", "structural", "S-01"),)
    assert check(reading(sheets, lists=listed, read=frozenset()), recognisers=READERS) == []
    assert check(reading(sheets, lists=listed, conventions=None), recognisers=READERS) == []


@pytest.mark.parametrize(
    ("make", "error", "match"),
    [
        (
            lambda s: reading([s], (entry(s, "S-01"),), lists=(typed("set", "structural", "S-01"),)),
            ValueError,
            "beside a list read on a sheet",
        ),
        (
            lambda s: reading(
                [s], lists=(typed("set", "structural", "S-01"), typed("set", "structural", "S-02"))
            ),
            ValueError,
            "beside another pasted or typed list",
        ),
        (lambda s: reading([s], (entry(sheet("S-09"), "S-01"),)), ValueError, "does not hold"),
        (lambda s: reading([sheet("S-01", group=None)]), ValueError, "no group"),
        (lambda s: reading([s, s]), ValueError, "given twice"),
    ],
)
def test_what_the_check_cannot_compare_is_refused(make: Any, error: type[Exception], match: str) -> None:
    with pytest.raises(error, match=match):
        check(make(sheet("S-01", "Notes")), recognisers=READERS)


def test_sheets_with_no_discipline_or_number_sit_out() -> None:
    loose = [sheet("S-05", discipline=None), sheet(None, "Untitled"), sheet("\u200b")]
    results = check(reading(loose, lists=(typed("set", "structural", "S-01"),)), recognisers=READERS)
    assert outcomes(results) == [
        ("fired", None, {"code": "engine.register_check.not_found", "params": {"number": "S-01"}})
    ]


# The numbering, with no list -------------------------------------------------------------------------


def test_with_no_list_each_gap_fires_named_by_its_neighbours_and_a_run_without_one_passes() -> None:
    structural = [sheet(n) for n in ("01", "02", "04", "05", "07", "10", "10")]
    architectural = [sheet(n, discipline="architectural") for n in ("A-01", "A-02", "A-03")]

    results = check(reading(structural + architectural), recognisers=READERS)

    def gap(after: str, before: str, missing: int) -> tuple[str, None, dict[str, Any]]:
        params = {"after": after, "before": before, "missing": missing, "discipline": "structural"}
        return ("fired", None, {"code": "engine.register_check.gap", "params": params})

    assert outcomes(results) == [
        gap("02", "04", 1),
        gap("05", "07", 1),
        gap("07", "10", 2),
        ("passed", None, None),
    ]


def test_the_numbering_is_a_run_per_series_as_19a_and_22_read_it() -> None:
    sheets = [
        sheet("S-01"),
        sheet("02"),
        sheet("S-101A"),
        sheet("S-101B"),
        sheet("SD-01"),
        sheet("SD-03"),
        sheet("S-03"),
        sheet("A-07", discipline="architectural"),
        sheet("S-01", group="building-2"),
        sheet("SK-A"),
        sheet("S-99", discipline=None),
    ]

    runs = numbering(sheets, conventions=CONVENTIONS, recognisers=READERS)

    assert runs == [
        Run("set", "structural", "S-01", "S-101A", 5, (Gap("S-03", "S-101A", 97),)),
        Run("set", "structural", "SD-01", "SD-03", 2, (Gap("SD-01", "SD-03", 1),)),
        Run("set", "architectural", "A-07", "A-07", 1, ()),
        Run("building-2", "structural", "S-01", "S-01", 1, ()),
    ]


def test_a_gap_of_millions_is_one_finding_named_by_its_count() -> None:
    sheets = [sheet("01"), sheet("5000000"), sheet("9" * 16), sheet("9" * 5000)]

    [run] = numbering(sheets, conventions=CONVENTIONS, recognisers=READERS)

    assert run.gaps == (Gap("01", "5000000", 4_999_998),)
    assert run.sheets == 2  # past the running-number limit, or unreadable: no running number


def test_each_number_is_read_once() -> None:
    counted = Counted(stand_in_sequence)
    sheets = [sheet(f"S-{k:03}") for k in range(2000)] + [sheet("S-000")]
    listed = typed("set", "structural", *(f"S-{k:03}" for k in range(1000)))

    results = check(reading(sheets, lists=(listed,)), recognisers=stand_ins(sequence=counted))

    assert len(results) == 1000 + 2001
    assert counted.calls == 2000  # "S-000" twice, and each listed number is a sheet's too


# parse: a pasted list or a typed range ----------------------------------------------------------------


def parsed(text: str) -> Parsed:
    return parse(text, CONVENTIONS, recognisers=READERS)


def refusal(text: str) -> dict[str, Any]:
    with pytest.raises(Refused) as caught:
        parsed(text)
    return dict(caught.value.finding)


def test_a_pasted_spreadsheet_is_read_by_its_cells_with_its_serial_column_set_aside() -> None:
    text = (
        "Drawing list\n"
        "Sl\tDrawing no\tTitle\tRev\n"
        "1\tS-01\tGeneral notes\tR2\n"
        "2\tS-02\tPile layout\tRev B\n"
        "\n"
        "3\tS-03\t2nd floor beam layout\n"
    )

    result = parsed(text)

    assert result == Parsed(
        ListSource.PASTED,
        (
            ListEntry("S-01", 3, "General notes", "R2"),
            ListEntry("S-02", 4, "Pile layout", "Rev B"),
            ListEntry("S-03", 6, "2nd floor beam layout"),
        ),
        ignored=2,
    )


def test_pasted_lines_of_words_keep_their_title_and_a_bare_number_its_ordinal_title() -> None:
    result = parsed("S-01 General notes\nS-02 - Pile layout\n01 2ND FLOOR BEAM LAYOUT\nS-09\n")

    assert result.entries == (
        ListEntry("S-01", 1, "General notes"),
        ListEntry("S-02", 2, "Pile layout"),
        ListEntry("01", 3, "2ND FLOOR BEAM LAYOUT"),
        ListEntry("S-09", 4),
    )
    assert result.source == ListSource.PASTED


@pytest.mark.parametrize(
    ("text", "numbers"),
    [
        ("A-01 to A-03", ["A-01", "A-02", "A-03"]),
        ("A-01 TO A-03", ["A-01", "A-02", "A-03"]),
        ("A-01\u2013A-03", ["A-01", "A-02", "A-03"]),
        ("A-01 \u2014 A-03", ["A-01", "A-02", "A-03"]),
        ("08\u201311", ["08", "09", "10", "11"]),
        ("9 to 11", ["9", "10", "11"]),
        ("S-07 to S-07", ["S-07"]),
    ],
)
def test_a_typed_range_is_every_number_in_it_without_titles(text: str, numbers: list[str]) -> None:
    result = parsed(text)

    assert result.source == ListSource.TYPED
    assert result.entries == tuple(ListEntry(n, 1) for n in numbers)


def test_a_typed_range_of_fifty_seven_and_a_list_mixing_ranges_and_lines() -> None:
    assert len(parsed("01\u201357").entries) == 57
    mixed = parsed("S-01 General notes\nS-02 to S-04")
    assert mixed.source == ListSource.PASTED
    assert [e.number for e in mixed.entries] == ["S-01", "S-02", "S-03", "S-04"]


@pytest.mark.parametrize(
    ("text", "code", "params"),
    [
        ("57\u201301", "range_backwards", {"line": 1, "first": "57", "last": "01"}),
        ("S-01\nA-01\u2013B-09", "range_mixed", {"line": 2, "first": "A-01", "last": "B-09"}),
        (
            "01\u20135000000",
            "range_too_long",
            {"line": 1, "first": "01", "last": "5000000", "limit": 10000},
        ),
        ("01-57", "range_hyphen", {"line": 1, "first": "01", "last": "57"}),
        ("01 - 57", "range_hyphen", {"line": 1, "first": "01", "last": "57"}),
        ("A-01-A-29", "range_hyphen", {"line": 1, "first": "A-01", "last": "A-29"}),
        ("", "nothing_found", {}),
        ("Drawing list\nnone yet", "nothing_found", {}),
    ],
)
def test_what_parse_cannot_read_is_refused_by_code(text: str, code: str, params: dict[str, Any]) -> None:
    assert refusal(text) == {"code": f"engine.register_check.{code}", "params": params}


def test_parse_is_bounded() -> None:
    assert refusal("S-01 x" + " " * register.TEXT_LIMIT) == {
        "code": "engine.register_check.text_too_long",
        "params": {"limit": 1_000_000},
    }
    many = "\n".join(f"S-{k}" for k in range(register.ENTRY_LIMIT + 1))
    assert refusal(many) == {"code": "engine.register_check.too_many", "params": {"limit": 10_000}}
    assert refusal("S-01 to S-9000\nS-9001 to S-10001")["code"] == "engine.register_check.too_many"
    long_line = "S-02 " + "x" * register.LINE_LIMIT
    assert parsed(f"S-01 Notes\n{long_line}") == Parsed(
        ListSource.PASTED, (ListEntry("S-01", 1, "Notes"),), ignored=1
    )
    assert parsed("S-01\n" + "9" * 5000).ignored == 1  # no number: 13 bounds it before int()
    assert parsed("S-01\nS-" + "1" * 70).ignored == 1  # longer than a number


def test_the_revision_mark_pattern_meets_only_short_cells() -> None:
    """13's conventions refuse a pattern that backtracks (`(a+)+b`); the cells a pattern meets are
    bounded here too (`MARK_LIMIT`), so a long cell is never tried."""
    marks = SheetConventions(revision_mark_pattern=r"R\d{1,30}")
    long_mark = "R" + "0" * register.MARK_LIMIT
    [entry] = parse(f"S-01\tNotes\t{long_mark}", marks, recognisers=READERS).entries
    assert entry.revision_mark is None
    [entry] = parse("S-01\tNotes\tR02", marks, recognisers=READERS).entries
    assert entry.revision_mark == "R02"
    assert parse("S-01\tNotes\tx\t", SheetConventions(), recognisers=READERS).entries == (
        ListEntry("S-01", 1, "Notes"),
    )


def test_parse_refuses_what_is_not_text() -> None:
    with pytest.raises(TypeError, match="text"):
        parse(b"S-01", CONVENTIONS, recognisers=READERS)  # type: ignore[arg-type]


def test_a_parsed_list_is_what_the_check_takes() -> None:
    result = parsed("S-01 to S-03")
    listed = DrawingList("set", "structural", result.source, result.entries)
    sheets = [sheet("01"), sheet("02"), sheet("03")]

    results = check(reading(sheets, lists=(listed,)), recognisers=READERS)

    assert [str(r.outcome) for r in results] == ["passed"] * 6


# No office's literal ----------------------------------------------------------------------------------


def test_two_sets_drawn_differently_read_alike() -> None:
    """ADR 0039: no Discipline key, prefix or sheet count lives in the code."""

    def drawn(discipline: str, prefix: str, sep: str) -> list[tuple[str, Any]]:
        conventions = SheetConventions(disciplines=(DisciplineConvention(discipline, (prefix,)),))
        sheets = [sheet(n, discipline=discipline) for n in ("0001", "0002", "0004")]
        cover = sheets[0]
        rows = (entry(cover, f"{prefix}{sep}0001"), entry(cover, f"{prefix}{sep}0003"))
        results = check(reading(sheets, rows, conventions=conventions), recognisers=READERS)
        found = [(str(r.outcome), r.finding and r.finding["code"]) for r in results]
        runs = numbering(sheets, conventions=conventions, recognisers=READERS)
        return [*found, ("runs", [(r.sheets, [g.missing for g in r.gaps]) for r in runs])]

    assert (
        drawn("structural", "S", "-")
        == drawn("tragwerk", "TW", ".")
        == [
            ("passed", None),
            ("fired", "engine.register_check.not_found"),
            ("passed", None),
            ("fired", "engine.register_check.not_listed"),
            ("fired", "engine.register_check.not_listed"),
            ("runs", [(3, [1])]),
        ]
    )


def test_parse_runs_no_regular_expression_over_a_line(monkeypatch: pytest.MonkeyPatch) -> None:
    """Work linear in the text: a pattern like \\s+to\\s+ backtracks over a line of spaces (a 1 MB
    paste of such lines took 3 s of CPU); only the conventions' revision-mark pattern is compiled, and
    it meets short cells only."""

    class NoPatterns:
        compile = staticmethod(__import__("re").compile)

        def __getattr__(self, name: str) -> Any:
            raise AssertionError(f"parse used re.{name}")

    patterns = [name for name, value in vars(register).items() if isinstance(value, re.Pattern)]
    assert patterns == []  # none compiled at import either
    monkeypatch.setattr(register, "re", NoPatterns())
    lines = ["a" + " " * 997 + "b", "-" + " " * 997 + "-", "a" + " -" * 498 + "b", "01 - 57"]
    for line in lines[:3]:
        assert parsed("\n".join([line] * 999) + "\nS-01 x").ignored == 999
    assert refusal(lines[3])["code"] == "engine.register_check.range_hyphen"
    assert parsed("A-01   TO   A-02").entries == (ListEntry("A-01", 1), ListEntry("A-02", 1))


def test_an_entry_on_an_equal_copy_of_a_sheet_is_refused() -> None:
    cover = sheet("S-01", "List")
    copy = SheetCandidate(**{f: getattr(cover, f) for f in cover.__dataclass_fields__})
    with pytest.raises(ValueError, match="does not hold"):
        check(reading([cover], (entry(copy, "S-01"),)), recognisers=READERS)


def _lines(action: Any) -> int:
    """How many lines of engine/check/register.py ran: work counted, never timed."""
    import sys

    count = 0

    def tracer(frame: Any, event: str, arg: object) -> Any:
        nonlocal count
        if frame.f_code.co_filename != register.__file__:
            return None
        count += event == "line"
        return tracer

    sys.settrace(tracer)
    try:
        action()
    finally:
        sys.settrace(None)
    return count


def test_the_check_and_the_numbering_do_linear_work() -> None:
    def work(n: int) -> int:
        sheets = [sheet(f"S-{2 * k}") for k in range(n)]
        listed = typed("set", "structural", *(f"S-{2 * k + 1}" for k in range(n)))
        a = _lines(lambda: check(reading(sheets, lists=(listed,)), recognisers=READERS))
        return a + _lines(lambda: numbering(sheets, conventions=CONVENTIONS, recognisers=READERS))

    small, large = work(1_000), work(2_000)
    assert large < 2.2 * small, (small, large)


def test_a_hyphenated_number_with_its_title_is_one_sheet_as_the_refusal_says() -> None:
    assert refusal("01-57")["code"] == "engine.register_check.range_hyphen"
    assert parsed("01-57 GENERAL NOTES").entries == (ListEntry("01-57", 1, "GENERAL NOTES"),)


def test_a_title_ending_in_a_digit_never_takes_the_number_s_place() -> None:
    """The refuter's round 1: a bare number before such a title was set aside as a serial number."""
    text = "01\tGENERAL NOTES\n02\tCOLUMN SCHEDULE SHEET 1\n03\tCOLUMN SCHEDULE SHEET 2\n"
    assert parsed(text).entries == (
        ListEntry("01", 1, "GENERAL NOTES"),
        ListEntry("02", 2, "COLUMN SCHEDULE SHEET 1"),
        ListEntry("03", 3, "COLUMN SCHEDULE SHEET 2"),
    )
    assert parsed("01 TYPE-2 FOUNDATION").entries == (ListEntry("01", 1, "TYPE-2 FOUNDATION"),)
    assert parsed("01\tSECTION 2").entries == (ListEntry("01", 1, "SECTION 2"),)
    serials = parsed("1\tS-01\tGeneral notes\n2\t02\tPile layout\n3 ST-03 Beams")
    assert [e.number for e in serials.entries] == ["S-01", "2", "ST-03"]  # the documented ambiguity
    listed = DrawingList("set", "structural", ListSource.PASTED, parsed(text).entries)
    sheets = [sheet("01", "GENERAL NOTES"), sheet("02"), sheet("03")]
    results = check(reading(sheets, lists=(listed,)), recognisers=READERS)
    assert [str(r.outcome) for r in results] == ["passed"] * 6


def test_a_cell_of_several_words_is_no_sheet_number() -> None:
    assert parsed("Drawing no 1\tTitle\nS-01\tNotes").entries == (ListEntry("S-01", 2, "Notes"),)


def test_a_format_character_inside_a_listed_number_is_read_as_its_normal_form() -> None:
    zero_width = "S-1\u200b0"
    assert parsed(f"{zero_width} Notes").entries == (ListEntry(zero_width, 1, "Notes"),)
    assert [e.number for e in parsed(f"S-08 to {zero_width}").entries] == ["S-08", "S-09", "S-10"]
    listed = typed("set", "structural", zero_width)
    results = check(reading([sheet("S-10")], lists=(listed,)), recognisers=READERS)
    assert [str(r.outcome) for r in results] == ["passed", "passed"]


@pytest.mark.parametrize(
    ("text", "numbers"),
    [
        # The refuter's round 2: a title starting with a count keeps its sheet number.
        ("01 5 STOREY SECTION", ["01"]),
        ("01 1250 SFT TYPICAL FLOOR PLAN\n02 GROUND FLOOR PLAN", ["01", "02"]),
        ("07\t2\tR1", ["07"]),
        ("05  12 STOREY ELEVATION", ["05"]),
        ("01 2ND FLOOR BEAM LAYOUT\n02 3RD FLOOR BEAM LAYOUT", ["01", "02"]),  # ordinals
        # The refuter's round 3: titles of unit sizes; serials that skip or restart.
        ("01 1250 SFT TYPE-A PLAN\n02 1450 SFT TYPE-B PLAN", ["01", "02"]),
        ("1\tS-01\tA\n2\tS-02\tB\n4\tS-03\tC", ["S-01", "S-02", "S-03"]),
        ("1\tS-01\tA\n2\tS-02\tB\n1\tST-01\tC", ["S-01", "S-02", "ST-01"]),
        # A count is set aside only before a number carrying a Discipline's prefix.
        ("1\tS-01\tNotes", ["S-01"]),
        ("1\tS 01\tNotes\n2\tS-02\tPiles", ["S 01", "S-02"]),
        ("S 01\tGENERAL NOTES", ["S 01"]),  # two words, the first a Discipline's prefix
        # The documented ambiguity: before a bare or unknown-prefixed number, the count stays.
        ("1 01 2ND FLOOR\n2 02 3RD FLOOR", ["1", "2"]),
        ("1 SD-01 SHOP DRAWING\n2 SD-02 SHOP DRAWING", ["1", "2"]),
    ],
)
def test_a_count_is_set_aside_only_before_a_disciplines_number(text: str, numbers: list[str]) -> None:
    assert [e.number for e in parsed(text).entries] == numbers


def test_a_title_starting_with_a_count_raises_no_false_finding() -> None:
    listed = parsed("01 1250 SFT TYPE-A PLAN\n02 1450 SFT TYPE-B PLAN")
    drawing_list = DrawingList("set", "structural", listed.source, listed.entries)
    results = check(reading([sheet("01"), sheet("02")], lists=(drawing_list,)), recognisers=READERS)
    assert [str(r.outcome) for r in results] == ["passed"] * 4


# Review round 1 (each test failed before its fix) ----------------------------------------------------


def test_ranges_past_the_entry_limit_are_refused_before_their_numbers_are_built() -> None:
    """Finding 1: every range was built before the limit was checked (22 KB of text took 1.1 GB)."""
    with peak_memory(16 * 2**20):  # one range of 9,999 entries at most, never 50
        assert refusal("01 to 9999\n" * 50)["code"] == "engine.register_check.too_many"


@pytest.mark.parametrize(
    ("text", "entries"),
    [
        ("S-01\x00 Plan", [("S-01", "Plan")]),
        ("S-\x0002 Pl\x00an", [("S-02", "Plan")]),
        ("\u202eS-02 Notes\u202c", [("S-02", "Notes")]),
        ("\u2066S-03\u2069 \u200fNotes", [("S-03", "Notes")]),
        ("S-01 to S-0\x003", [("S-01", None), ("S-02", None), ("S-03", None)]),
    ],
)
def test_control_characters_and_bidi_controls_never_reach_an_entry(
    text: str, entries: list[tuple[str, str | None]]
) -> None:
    """Finding 3: PostgreSQL refuses a NUL, and a direction override would reach a Question."""
    assert [(e.number, e.title) for e in parsed(text).entries] == entries


def test_an_escape_sequence_leaves_no_control_character_in_an_entry() -> None:
    [entry] = parsed("S-01\x07\x1b[31m Title").entries
    for value in (entry.number, entry.title or ""):
        assert not any(unicodedata.category(char) == "Cc" for char in value), repr(value)


def test_a_line_of_many_hyphens_is_tried_as_a_range_once() -> None:
    """Finding 4: every hyphen was tried as a range's split (a crafted 1 MB paste took 7 s)."""
    counted = Counted(stand_in_sequence)
    lines = [("1 - " * 32) + "1", "A" + " - 1" * 31]  # 32 hyphens; 31, halves of two kinds
    text = "\n".join(lines * 500) + "\nS-01 Notes"

    parse(text, CONVENTIONS, recognisers=stand_ins(sequence=counted))

    assert counted.calls <= 6 * 1000 + 10, counted.calls


def test_a_refusal_counts_lines_as_the_qs_sees_them() -> None:
    """Finding 7: `splitlines` also split on NEL, the line separator and form feeds."""
    for joiner in ("\x85", "\u2028", "\x0c", "\x1c", "\r"):
        found = refusal(f"S-01{joiner}S-02\n57 to 01")
        assert found["params"]["line"] == 2, (repr(joiner), found)
    assert refusal("S-01\r\n57 to 01")["params"]["line"] == 2


@pytest.mark.parametrize(
    ("text", "numbers"),
    [
        ("S1-01 to S1-03", ["S1-01", "S1-02", "S1-03"]),  # the orchestrator's ruling
        ("S-1.08 to S-1.10", ["S-1.08", "S-1.09", "S-1.10"]),
    ],
)
def test_ranges_of_numbers_with_a_digit_before_the_running_number(text: str, numbers: list[str]) -> None:
    assert [e.number for e in parsed(text).entries] == numbers


def test_a_range_over_part_suffixes_is_refused_as_mixed() -> None:
    assert refusal("S-01/1 to S-01/3")["code"] == "engine.register_check.range_mixed"


def test_gaps_in_numbers_with_a_digit_before_the_running_number() -> None:
    sheets = [sheet(n) for n in ("S-1.01", "S-1.02", "S-1.05")]

    [run] = numbering(sheets, conventions=CONVENTIONS, recognisers=READERS)

    assert run == Run("set", "structural", "S-1.01", "S-1.05", 3, (Gap("S-1.02", "S-1.05", 2),))
