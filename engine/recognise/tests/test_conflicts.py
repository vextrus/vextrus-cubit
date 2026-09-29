"""The conflicts and continuations (ticket 19b), on hand-made candidates and 13's stand-in readers.

Every rule of engine/recognise/conflicts.py is tested on each side of its edge; every finding by its
kind, candidates (by identity) and evidence, never by its count alone.
"""

import sys
from collections.abc import Callable, Iterator, Sequence
from functools import partial
from types import FrameType
from typing import Any

import pytest

from engine.messages import conflicts as codes
from engine.recognise import conflicts
from engine.recognise.conflicts import (
    RUNNING_LIMIT,
    Recognisers,
    compare,
    find,
    normal,
)
from engine.recognise.tests.candidates import plan, same, sheet
from engine.recognise.tests.stand_ins import (
    Counted,
    StandInParts,
    stand_in_sequence,
    stand_ins,
)
from engine.recognise.types import (
    Conflict,
    Continuation,
    DisciplineConvention,
    Exclusion,
    ExclusionReason,
    Layer,
    SheetCandidate,
    SheetConventions,
    ViewCandidate,
    ViewKind,
)

READERS = stand_ins()
CONVENTIONS = SheetConventions(
    disciplines=(
        DisciplineConvention("structural", ("S",)),
        DisciplineConvention("architectural", ("A",)),
    )
)


def run(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]] | None = None,
    readers: Recognisers = READERS,
) -> list[Any]:  # Conflicts and Continuations; each test asserts which
    views = views if views is not None else [()] * len(sheets)
    return compare(sheets, views, conventions=CONVENTIONS, recognisers=readers)


def conflicts_of(found: list[Conflict | Continuation], kind: str | None = None) -> list[Conflict]:
    return [c for c in found if isinstance(c, Conflict) and (kind is None or c.kind == kind)]


def continuations_of(found: list[Conflict | Continuation]) -> list[Continuation]:
    return [c for c in found if isinstance(c, Continuation)]


def named(item: Conflict | Continuation) -> Sequence[object]:
    return item.candidates if isinstance(item, Conflict) else item.sheets


# Two sheets, one number ------------------------------------------------------------------------------


def test_two_sheets_with_one_number_are_one_conflict_naming_both_with_the_number_and_copies() -> None:
    rev_b, other, rev_a = sheet("S-07", "Slab", revision="B"), sheet("S-08"), sheet("S-07", revision="A")

    found = run([rev_b, other, rev_a])

    assert found == conflicts_of(found)
    [conflict] = found
    assert conflict.kind == "same_number"
    assert same(conflict.candidates, [rev_b, rev_a])
    assert conflict.evidence == {"number": "S-07", "copies": 2}
    assert codes.SAME_NUMBER(**conflict.evidence)["code"] == "engine.conflicts.same_number"


def test_a_blank_layout_s_values_are_shown_but_never_compared() -> None:
    """A stale layout proposed out as blank shows its title block's "01" (13), and raises no
    Conflict or Continuation with the live sheet it would otherwise clash with."""
    blank = sheet("S-07", "Slab", exclusion=Exclusion(ExclusionReason.BLANK))
    live = sheet("S-07", "Slab")
    other = sheet("S-10", "Stair")

    assert blank.blank
    assert not live.blank
    assert run([blank, live, other]) == []
    assert conflicts_of(run([sheet("S-07"), live]))  # the same pair, live, is one


def test_numbers_are_compared_in_one_normal_form() -> None:
    forms = ["S-07", " s-07 ", "S\u200b-07", "S-\u00ad07", "\ufeffS-07", "\uff33-\uff10\uff17", "S  -07"]
    sheets = [sheet(n) for n in forms]

    [conflict] = run(sheets)

    assert conflict.evidence == {"number": "S-07", "copies": 7}
    assert same(conflict.candidates, sheets)  # "S  -07" too: a prefix is compared by its letters
    assert normal("S  -07") == "s -07"
    assert normal("S-07") == "s-07"


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("S-O1", "S-01"),  # a letter O for a zero
        ("\u0421-01", "C-01"),  # a Cyrillic Es for a Latin C: letters that look alike stay apart
        ("S-01 R2", "S-01"),
        ("S-01/1", "S-01"),
    ],
)
def test_numbers_that_differ_in_normal_form_are_not_one_number(a: str, b: str) -> None:
    assert run([sheet(a), sheet(b)]) == []


def test_equal_copies_in_two_files_are_two_sheets_and_each_object_is_named() -> None:
    first = sheet("S-07", "Slab")
    copy = SheetCandidate(**{f: getattr(first, f) for f in first.__dataclass_fields__})
    assert copy == first
    assert copy is not first

    [conflict] = run([first, copy])

    assert same(conflict.candidates, [first, copy])


def test_one_number_in_two_groups_or_two_disciplines_is_two_sheets() -> None:
    assert run([sheet("S-101", group="building-1"), sheet("S-101", group="building-2")]) == []
    assert run([sheet("S-101"), sheet("S-101", discipline="architectural")]) == []


def test_a_sheet_with_no_discipline_or_no_number_sits_out() -> None:
    assert run([sheet("S-07", discipline=None), sheet("S-07", discipline=None)]) == []
    assert run([sheet(None, "Slab"), sheet(None, "Slab")]) == []
    assert run([sheet("\u200b"), sheet("\u00ad\ufeff")]) == []  # numbers of format characters only


# One title: a continuation, or a conflict --------------------------------------------------------------


@pytest.mark.parametrize(
    "numbers",
    [
        ["10", "09", "11"],  # given out of order; the continuation is in number order
        ["S-09", "S-10"],
        ["9", "10"],
        ["09", "010"],  # padding is no part of a running number
        ["S-101A", "S-101B"],
        ["S-101a", "S-101B"],
        ["S-09", "s 10"],  # prefixes compared by their letters and digits
        ["S-\u09e6\u09ef", "S-\u09e7\u09e6"],  # Bengali digits, read by 13 (here its stand-in)
    ],
)
def test_one_title_on_numbers_that_run_on_is_one_continuation_and_no_conflict(
    numbers: list[str],
) -> None:
    sheets = [sheet(n, "Column schedule") for n in numbers]

    found = run(sheets)

    [continuation] = found
    assert isinstance(continuation, Continuation)
    assert continuation.title == "Column schedule"
    ordered = sorted(sheets, key=lambda s: stand_in_sequence(s.number.value).running)  # type: ignore[union-attr]
    if numbers[0].startswith("S-101"):
        ordered = sheets
    assert same(continuation.sheets, ordered)


@pytest.mark.parametrize(
    ("numbers", "order"),
    [
        (["S-09", "S-11"], [0, 1]),  # a gap
        (["S-101", "S-101A"], [0, 1]),  # a suffix added is not a next number
        (["S-101A", "S-101C"], [0, 1]),
        (["S-09A", "S-10B"], [0, 1]),  # suffixes differ
        (["S-09", "A-10"], [0, 1]),  # prefixes differ; the Discipline's own sorts as none, first
        (["SK-B", "SK-A"], [0, 1]),  # no running number: last, in the order given
        (["S-9", "S-9A"], [0, 1]),
    ],
)
def test_one_title_on_numbers_that_do_not_run_on_is_one_conflict_naming_every_sheet(
    numbers: list[str], order: list[int]
) -> None:
    sheets = [sheet(n, "Column schedule") for n in numbers]

    [conflict] = run(sheets)

    assert conflict.kind == "same_title"
    assert same(conflict.candidates, [sheets[i] for i in order])
    assert conflict.evidence == {"title": "Column schedule", "sheets": 2}


def test_a_title_shared_by_a_run_and_a_sheet_apart_is_a_continuation_and_a_conflict() -> None:
    apart, first, second, third = (sheet(n, "Beam layout") for n in ("S-20", "S-09", "S-10", "S-11"))

    found = run([apart, first, second, third])

    [continuation] = continuations_of(found)
    assert same(continuation.sheets, [first, second, third])
    [conflict] = conflicts_of(found)
    assert conflict.kind == "same_title"
    assert same(conflict.candidates, [first, second, third, apart])
    assert conflict.evidence == {"title": "Beam layout", "sheets": 4}


def test_titles_are_compared_in_one_normal_form_and_one_of_format_characters_is_no_title() -> None:
    a, b = sheet("S-01", "COLUMN  SCHEDULE"), sheet("S-05", "column schedule\u200b")
    [conflict] = run([a, b])
    assert conflict.evidence == {"title": "COLUMN  SCHEDULE", "sheets": 2}

    assert run([sheet("S-01", "\uff23olumn schedule"), sheet("S-05", "Column schedule")]) != []
    assert run([sheet("S-01", "\u0421olumn schedule"), sheet("S-05", "Column schedule")]) == []
    assert run([sheet("S-01", "\u200b\u00ad"), sheet("S-05", "\ufeff")]) == []
    assert run([sheet("S-01", "Slab\u00ad"), sheet("S-05", "Slab")]) != []


def test_copies_of_one_number_under_one_title_are_only_a_number_conflict() -> None:
    rev_a, rev_b = sheet("S-07", "Typical floor slab"), sheet("S-07", "Typical floor slab")

    [conflict] = run([rev_a, rev_b])

    assert conflict.kind == "same_number"


def test_copies_of_one_number_in_a_run_are_one_place_in_it() -> None:
    a, b, c = sheet("S-07", "Slab"), sheet("S-07", "Slab"), sheet("S-08", "Slab")

    found = run([a, b, c])

    [continuation] = continuations_of(found)
    assert same(continuation.sheets, [a, b, c])
    assert [c.kind for c in conflicts_of(found)] == ["same_number"]


def test_titles_compare_within_a_group_and_a_discipline_and_need_a_number() -> None:
    assert run([sheet("S-01", "Notes"), sheet("S-05", "Notes", group="building-2")]) == []
    assert run([sheet("S-01", "Notes"), sheet("A-05", "Notes", discipline="architectural")]) == []
    assert run([sheet("S-01", "Notes"), sheet(None, "Notes")]) == []
    assert run([sheet("S-01", "Notes", discipline=None), sheet("S-05", "Notes", discipline=None)]) == []


def test_a_running_number_past_the_limit_or_unreadable_runs_on_with_none() -> None:
    long_run = "S-" + "9" * 5000  # int() refuses it; 13 bounds its reading first (its stand-in too)
    assert continuations_of(run([sheet(long_run, "Notes"), sheet("S-01", "Notes")])) == []

    def huge(number: str) -> StandInParts:
        return StandInParts("S-", 10**5000 if number.endswith("1") else 10**5000 + 1, "")

    found = run([sheet("S-1", "Notes"), sheet("S-2", "Notes")], readers=stand_ins(sequence=huge))
    assert [c.kind for c in conflicts_of(found)] == ["same_title"]  # never printed, never a crash

    def edge(number: str) -> StandInParts:
        return StandInParts("S-", RUNNING_LIMIT - 2 if number.endswith("1") else RUNNING_LIMIT - 1, "")

    pair = [sheet("S-1", "N"), sheet("S-2", "N")]
    assert continuations_of(run(pair, readers=stand_ins(sequence=edge)))

    def past(number: str) -> StandInParts:
        return StandInParts("S-", RUNNING_LIMIT - 1 if number.endswith("1") else RUNNING_LIMIT, "")

    assert not continuations_of(
        run([sheet("S-1", "N"), sheet("S-2", "N")], readers=stand_ins(sequence=past))
    )


@pytest.mark.parametrize(
    "parts",
    [
        StandInParts("S-", "7", ""),  # type: ignore[arg-type]
        StandInParts("S-", True, ""),
        StandInParts(None, 7, ""),  # type: ignore[arg-type]
        "S-7",
    ],
)
def test_a_reader_answering_outside_13s_contract_is_refused(parts: object) -> None:
    with pytest.raises(TypeError, match="13's sequence"):
        run([sheet("S-7", "N"), sheet("S-8", "N")], readers=stand_ins(sequence=lambda _: parts))


def test_a_one_megabyte_title_is_compared_whole() -> None:
    title = "Column schedule " * 65536
    a, b = sheet("S-01", title), sheet("S-05", title + "\u200b")

    [conflict] = run([a, b])

    assert conflict.evidence["title"] == title


# One storey drawn twice ------------------------------------------------------------------------------


def two_plans(
    first: ViewCandidate, second: ViewCandidate, **options: Any
) -> tuple[list[SheetCandidate], list[list[ViewCandidate]]]:
    a = sheet("S-14", "5th floor slab, bottom")
    b = sheet("S-31", "Slab reinforcement", discipline=options.get("second_discipline", "structural"))
    return [a, b], [[first], [second]]


def test_two_plans_of_one_storey_subject_and_layer_on_two_sheets_are_one_conflict() -> None:
    first = plan(["floor_4", "floor_5"], layer=Layer.BOTTOM)
    second = plan(["floor_5", "floor_6"], layer=Layer.BOTTOM)
    sheets, views = two_plans(first, second)

    [conflict] = run(sheets, views)

    assert conflict.kind == "same_storey"
    assert same(conflict.candidates, [first, second])
    assert conflict.evidence == {
        "first": "S-14",
        "first_named": "number",
        "second": "S-31",
        "second_named": "number",
        "plan": "",
        "other": "",
        "titled": "none",
        "layer": "bottom",
        "views": 2,
        "discipline": "structural",
        "subject": "slab",
        "storey": "floor_5",
    }
    assert codes.SAME_STOREY(**conflict.evidence)["code"] == "engine.conflicts.same_storey"


@pytest.mark.parametrize(
    ("first", "second"),
    [
        (plan(["floor_5"], "beam"), plan(["floor_5"], "slab")),  # a beam layout beside a slab sheet
        (plan(["floor_5"], layer=Layer.TOP), plan(["floor_5"], layer=Layer.BOTTOM)),
        (plan(["floor_5"], layer=None), plan(["floor_5"], layer=Layer.TOP)),
        (plan(["floor_5"], subject=None), plan(["floor_5"], subject=None)),  # unknown is no match
        (plan(["floor_5"]), plan(["floor_5"], kind=ViewKind.SECTION)),
        (plan(["floor_5"]), plan(["floor_6"])),
        (plan(["typical"]), plan(["typical"])),  # Step 3's to resolve
        (plan(["floor_2", "top"]), plan(["top"])),
        (plan([]), plan([])),
    ],
)
def test_plans_that_differ_in_subject_layer_kind_or_storey_are_normal_practice(
    first: ViewCandidate, second: ViewCandidate
) -> None:
    sheets, views = two_plans(first, second)
    assert run(sheets, views) == []


def test_no_layer_matches_no_layer_and_a_symbolic_storey_beside_a_real_one_still_counts() -> None:
    first, second = plan(["typical", "floor_3"], "beam"), plan(["floor_3"], "beam")
    sheets, views = two_plans(first, second)

    [conflict] = run(sheets, views)

    assert conflict.evidence["layer"] == "none"
    assert conflict.evidence["storey"] == "floor_3"


def test_plans_compare_within_a_group_and_a_discipline_and_never_within_one_sheet() -> None:
    a, b = plan(["floor_5"]), plan(["floor_5"])
    one = sheet("S-14", "Slab")
    assert run([one], [[a, b]]) == []
    sheets, views = two_plans(plan(["floor_5"]), plan(["floor_5"]), second_discipline="architectural")
    assert run(sheets, views) == []
    other_group = [sheet("S-14", "Slab"), sheet("S-31", "Slab plan", group="building-2")]
    assert run(other_group, [[plan(["floor_5"])], [plan(["floor_5"])]]) == []
    no_discipline = [sheet("S-14", "Slab", discipline=None), sheet("S-31", "Slab plan")]
    assert run(no_discipline, [[plan(["floor_5"])], [plan(["floor_5"])]]) == []


def test_plans_on_the_sheets_of_one_continuation_or_copies_of_one_number_are_not_a_conflict() -> None:
    left, right = sheet("S-14", "5th floor slab"), sheet("S-15", "5th floor slab")
    found = run([left, right], [[plan(["floor_5"])], [plan(["floor_5"])]])
    assert conflicts_of(found) == []
    assert len(continuations_of(found)) == 1

    rev_a, rev_b = sheet("S-07", "Slab A"), sheet("S-07", "Slab B")
    found = run([rev_a, rev_b], [[plan(["floor_5"])], [plan(["floor_5"])]])
    assert [c.kind for c in conflicts_of(found)] == ["same_number"]


def test_one_conflict_per_set_of_views() -> None:
    a, b = plan(["floor_1", "floor_2"]), plan(["floor_1", "floor_2"])
    c = plan(["floor_2", "floor_3"])
    sheets = [sheet("S-10", "One"), sheet("S-20", "Two"), sheet("S-30", "Three")]

    found = run(sheets, [[a], [b], [c]])

    assert [(c.evidence["storey"], [id(v) for v in c.candidates]) for c in conflicts_of(found)] == [
        ("floor_1", [id(a), id(b)]),
        ("floor_2", [id(a), id(b), id(c)]),
    ]


# The order, the refusals, the harness path -------------------------------------------------------------


def test_the_order_is_continuations_then_conflicts_by_kind_each_by_its_first_candidate() -> None:
    s = [
        sheet("S-40", "Stairs"),
        sheet("S-07", "Slab"),
        sheet("S-41", "Stairs"),
        sheet("S-07", "Slab"),
        sheet("S-01", "Notes"),
        sheet("S-03", "Notes"),
        sheet("S-02", "Beams"),
        sheet("S-09", "Beams"),
    ]
    views: list[list[ViewCandidate]] = [[] for _ in s]
    views[0] = [plan(["roof"])]
    views[4] = [plan(["roof"])]

    found = run(s, views)
    again = run(s, views)

    assert [(type(c).__name__, getattr(c, "kind", None)) for c in found] == [
        ("Continuation", None),
        ("Conflict", "same_number"),
        ("Conflict", "same_title"),
        ("Conflict", "same_title"),
        ("Conflict", "same_storey"),
    ]
    assert same(conflicts_of(found)[1].candidates, [s[4], s[5]])  # "Notes" before "Beams"
    assert all(same(named(x), named(y)) for x, y in zip(found, again, strict=True))


def test_nothing_given_is_nothing_found() -> None:
    assert compare([], [], conventions=None, recognisers=READERS) == []
    assert find([], [], None) == []


@pytest.mark.parametrize(
    ("make", "error", "match"),
    [
        (lambda s: ([s, s], [(), ()]), ValueError, "given twice"),
        (lambda s: ([s], []), ValueError, "one per sheet"),
        (lambda s: ([s], [(), ()]), ValueError, "one per sheet"),
        (lambda s: ([sheet("S-1", group=None)], [()]), ValueError, "no group"),
        (lambda s: (["S-1"], [()]), TypeError, "SheetCandidate"),
        (lambda s: ([s], [("plan",)]), TypeError, "ViewCandidate"),
    ],
)
def test_what_the_contract_does_not_allow_is_refused(
    make: Callable[[SheetCandidate], tuple[list[Any], list[Any]]], error: type[Exception], match: str
) -> None:
    sheets, views = make(sheet("S-1", "Notes"))
    with pytest.raises(error, match=match):
        compare(sheets, views, conventions=CONVENTIONS, recognisers=READERS)


def test_one_view_object_on_two_sheets_is_refused() -> None:
    view = plan(["floor_1"])
    with pytest.raises(ValueError, match="ViewCandidate object is given twice"):
        run([sheet("S-1"), sheet("S-2")], [[view], [view]])


def test_the_harness_path_reads_with_13s_readers_and_needs_the_conventions() -> None:
    """Part 2: `find` binds 13's `sheets.sequence` to the run's conventions."""
    conventions = SheetConventions(disciplines=(DisciplineConvention("structural", ("S",)),))
    one = [sheet("S-01", "Notes")]
    assert find([sheet(None, "Notes")], [()], conventions) == []  # no number to read
    assert find(one, [()], conventions) == []
    ruled = [sheet(n, "Notes") for n in ("S1-01", "S1-02", "S-01/1", "S-01/2")]
    found = find(ruled, [()] * 4, conventions)
    assert [len(c.sheets) for c in found if isinstance(c, Continuation)] == [2, 2]
    assert [c.kind for c in found if isinstance(c, Conflict)] == ["same_title"]
    [conflict] = conflicts_of(find([sheet("13"), sheet("S-13")], [(), ()], conventions))
    assert conflict.evidence == {"number": "13", "copies": 2}
    with pytest.raises(ValueError, match="conventions"):
        find(one, [()], None)


# The trust boundary: work, and no office's literal -----------------------------------------------------


def _lines(action: Callable[[], object]) -> int:
    """How many lines of engine/recognise/conflicts.py ran: work counted, never timed."""
    count = 0
    source = conflicts.__file__

    def tracer(frame: FrameType, event: str, arg: object) -> Any:
        nonlocal count
        if frame.f_code.co_filename != source:
            return None
        if event == "line":
            count += 1
        return tracer

    sys.settrace(tracer)
    try:
        action()
    finally:
        sys.settrace(None)
    return count


def _many(n: int) -> Iterator[SheetCandidate]:
    for k in range(n):
        yield sheet(f"S-{2 * k}", "Column schedule")  # one title, never running on: one conflict


def test_ten_thousand_sheets_of_one_title_are_one_group_not_fifty_million_pairs() -> None:
    sheets = list(_many(10_000))
    counted = Counted(stand_in_sequence)

    found = run(sheets, readers=stand_ins(sequence=counted))

    [conflict] = found
    assert conflict.evidence == {"title": "Column schedule", "sheets": 10_000}
    assert counted.calls == 10_000  # each number read once
    small, large = (_lines(partial(lambda k: run(list(_many(k))), n)) for n in (1_000, 2_000))
    assert large < 2.2 * small, (small, large)


def test_a_hundred_thousand_views_are_compared_in_linear_work() -> None:
    def views_of(n: int) -> tuple[list[SheetCandidate], list[list[ViewCandidate]]]:
        sheets = [sheet(f"S-{k}", f"Plan {k}") for k in range(n // 10)]
        views = [
            [plan([f"floor_{k % 7}", f"floor_{k % 7 + 1}"]) for _ in range(10)] for k in range(n // 10)
        ]
        return sheets, views

    sheets, views = views_of(100_000)
    found = run(sheets, views)
    # floor_0 and floor_7 are each drawn by one residue's sheets, floor_1 to floor_6 by two: 8 sets
    assert len(conflicts_of(found, "same_storey")) == len(found) == 8
    small, large = (_lines(partial(lambda k: run(*views_of(k)), n)) for n in (2_000, 4_000))
    assert large < 2.2 * small, (small, large)


def test_two_sets_drawn_differently_read_alike() -> None:
    """ADR 0039: no Discipline key, prefix, storey or subject word lives in the code."""

    def drawn(
        discipline: str, numbers: list[str], storeys: list[str], subject: str, typical: str
    ) -> list[str]:
        s = [
            sheet(numbers[0], "T1", discipline=discipline),
            sheet(numbers[1], "T1", discipline=discipline),
            sheet(numbers[2], "T2", discipline=discipline),
            sheet(numbers[2], "T3", discipline=discipline),
            sheet(numbers[3], "T1", discipline=discipline),
        ]
        views = [[plan([storeys[0], typical], subject)], [], [], [], [plan([storeys[0]], subject)]]
        found = run(s, views, stand_ins(symbolic=[typical]))
        return [type(c).__name__ + ":" + getattr(c, "kind", "") for c in found]

    one = drawn("structural", ["S-01", "S-02", "S-07", "S-09"], ["floor_1"], "slab", "typical")
    two = drawn("tragwerk", ["TW.0001", "TW.0002", "TW.0007", "TW.0009"], ["etage_a"], "decke", "regel")
    assert (
        one
        == two
        == [
            "Continuation:",
            "Conflict:same_number",
            "Conflict:same_title",
            "Conflict:same_storey",
        ]
    )


@pytest.mark.parametrize(
    ("a", "b", "one_number"),
    [
        ("S-\u00b2", "S-2", True),  # a superscript two is a two in normal form (NFKC)
        ("\u00bd", "1\u20442", True),  # a vulgar half is 1, a fraction slash, 2
        ("\u00bd", "1/2", False),  # the fraction slash is not a solidus
        ("S-\u09e6\u09ed", "S-07", True),  # Bengali digits read (by 13) as the same running number
    ],
)
def test_numbers_that_are_not_plain_digits_compare_in_normal_form(
    a: str, b: str, one_number: bool
) -> None:
    found = run([sheet(a), sheet(b)])
    assert [c.kind for c in found] == (["same_number"] if one_number else [])


# Round 1 of the refuter (each test failed before its fix) ----------------------------------------------


def test_a_format_character_inside_a_number_is_read_as_its_normal_form() -> None:
    zero_width = "S-1\u200b0"  # "S-10" with a zero-width space in its digits
    nine, ten = sheet("S-09", "T"), sheet(zero_width, "T")
    [continuation] = run([nine, ten])
    assert isinstance(continuation, Continuation)

    for order in ([sheet("S-10", "T"), sheet(zero_width, "T"), sheet("S-09", "T")],
                  [sheet(zero_width, "T"), sheet("S-10", "T"), sheet("S-09", "T")]):  # fmt: skip
        found = run(order)
        assert [type(c).__name__ + getattr(c, "kind", "") for c in found] == [
            "Continuation",
            "Conflictsame_number",
        ]


def test_one_number_printed_two_ways_is_one_number_as_the_register_check_reads_it() -> None:
    """Finding 6: "13" and "S-13" in one Discipline (S its prefix) were two numbers here and one in the
    register Check. Padding and a Discipline's own prefix are no part of a number."""
    padded, bare, ten = sheet("S-09", "T"), sheet("S-9", "T"), sheet("S-10", "T")
    [conflict] = run([padded, bare])
    assert (conflict.kind, conflict.evidence) == ("same_number", {"number": "S-09", "copies": 2})

    found = run([padded, bare, ten])
    assert [type(c).__name__ + getattr(c, "kind", "") for c in found] == [
        "Continuation",
        "Conflictsame_number",
    ]
    for pair in (["13", "S-13"], ["S-13", "13"], ["07", "S-7"]):
        [conflict] = run([sheet(pair[0]), sheet(pair[1])])
        assert conflict.evidence == {"number": pair[0], "copies": 2}
    assert run([sheet("13"), sheet("A-13")]) == []  # A is another Discipline's prefix
    assert run([sheet("13"), sheet("SD-13")]) == []  # a prefix no Discipline owns is kept
    other = [sheet("13", discipline="architectural"), sheet("S-13", discipline="architectural")]
    assert run(other) == []  # S is not the architectural Discipline's prefix


@pytest.mark.parametrize(
    "numbers",
    [
        ["S1-01", "S1-02"],  # a digit before the running number (the orchestrator's ruling)
        ["S-1.01", "S-1.02"],
        ["S-01/1", "S-01/2"],  # a part suffix after a "/"
        ["S-01/01", "S-01/02"],
    ],
)
def test_numbers_with_a_digit_before_or_a_part_after_the_running_number_run_on(
    numbers: list[str],
) -> None:
    sheets = [sheet(n, "Column schedule") for n in numbers]
    [continuation] = run(sheets)
    assert isinstance(continuation, Continuation)
    assert same(continuation.sheets, sheets)


def test_part_suffixes_that_do_not_run_on_are_a_title_conflict() -> None:
    [conflict] = run([sheet("S-01/1", "T"), sheet("S-01/3", "T")])
    assert conflict.kind == "same_title"
    [conflict] = run([sheet("S-01/1", "T"), sheet("S-01A", "T")])  # a part and a letter
    assert conflict.kind == "same_title"


def test_a_sheet_in_a_list_of_views_is_refused() -> None:
    for discipline in (None, "structural"):
        with pytest.raises(TypeError, match="ViewCandidate"):
            run([sheet("S-1", "A", discipline=discipline)], [[sheet("S-2", "B")]])  # type: ignore[list-item]


class _Counted(str):
    """A storey key that counts its comparisons: work done in C, which line counts cannot see."""

    compared = 0

    def __eq__(self, other: object) -> bool:
        _Counted.compared += 1
        return str.__eq__(self, other)

    __hash__ = str.__hash__


def test_the_storeys_shared_by_a_set_of_views_are_compared_in_linear_work() -> None:
    def work(n: int) -> int:
        keys = [_Counted(f"floor_{k}") for k in range(n)]
        many = plan(keys)
        singles = [plan([key]) for key in keys]
        sheets = [sheet("S-1", "A"), *(sheet(f"S-{k + 10}", f"P{k}") for k in range(n))]
        _Counted.compared = 0
        found = run(sheets, [[many], *([s] for s in singles)])
        assert len(found) == n
        two = run([sheet("S-1", "A"), sheet("S-5", "B")], [[plan(keys)], [plan(keys)]])
        assert len(two) == 1
        return _Counted.compared

    small, large = work(1_000), work(2_000)
    assert large <= 2.2 * small + 100, (small, large)


def test_a_same_storey_conflict_names_its_sheets_and_the_first_titled_plan() -> None:
    """The words gate's round 1: m0-screens §5's "S-14 and S-15 both draw the 5th floor slab, bottom
    layer" names the sheets and what is drawn."""
    untitled = plan(["floor_5"], layer=Layer.BOTTOM)
    titled = plan(["floor_5"], layer=Layer.BOTTOM, title="5TH FLOOR SLAB, BOTTOM REINFORCEMENT")
    twin = plan(["floor_5"], layer=Layer.BOTTOM, title="5th floor slab (bottom)")
    sheets = [sheet("S-14", "Slab"), sheet(None, "Slab plan"), sheet("S-40", "Slab again")]

    [conflict] = run(sheets, [[untitled, titled], [twin], [plan(["floor_5"], layer=Layer.BOTTOM)]])

    evidence = conflict.evidence
    assert (evidence["first"], evidence["second"], evidence["views"]) == ("S-14", "Slab plan", 4)
    assert (evidence["plan"], evidence["titled"]) == ("5TH FLOOR SLAB, BOTTOM REINFORCEMENT", "differ")
    assert (evidence["other"], evidence["second_named"]) == ("5th floor slab (bottom)", "title")


def test_a_plan_on_a_sheet_with_neither_number_nor_title_sits_out_of_same_storey() -> None:
    sheets = [sheet("S-14", "Slab"), sheet(None, None)]
    assert run(sheets, [[plan(["floor_5"])], [plan(["floor_5"])]]) == []
