"""Ticket S19-B4 (Train B, false conflict Questions), E6, on 19b's `engine.recognise.conflicts.compare`:
"same_storey never pairs plan views whose titles name member marks with none in common".

The shape (synthetic): two pile-cap details sheets, each drawing three caps' plans, each plan titled
by its cap's mark, the two sheets' marks different and not ranges; every plan shares the subject and
the storey `pile_cap`. One cap's plan is not another's. Marks are written as pile caps' are, letters
with dots then a hyphen before the number (`P.C-1`), and as a word of letters then digits (`PC1`).
Every title, number and mark is invented.
"""

from collections.abc import Sequence

from engine.recognise.types import SheetCandidate, ViewCandidate

from ..w334.test_same_storey_classes import same_storeys, sheets_named
from ..w334.test_series_and_ranges import compare, sheet
from .views import plan


def caps(*marks: str) -> tuple[ViewCandidate, ...]:
    return tuple(plan(f"CAP {m}, PLAN", "pile_cap", "pile_cap") for m in marks)


def two_sheets(
    first: Sequence[str], second: Sequence[str]
) -> tuple[list[SheetCandidate], list[tuple[ViewCandidate, ...]]]:
    """Two details sheets, titled by their caps' marks (so not one title), drawing those caps."""
    return (
        [
            sheet("S-06", f"DETAIL SHEET, PILE CAPS ({', '.join(first)})"),
            sheet("S-07", f"DETAIL SHEET, PILE CAPS ({', '.join(second)})"),
        ],
        [caps(*first), caps(*second)],
    )


def test_plans_of_different_pile_caps_by_dotted_mark_are_not_one_storey_drawn_twice() -> None:
    sheets, views = two_sheets(("P.C-1", "P.C-5", "P.C-6"), ("P.C-2", "P.C-3", "P.C-4"))

    assert same_storeys(compare(sheets, views)) == []


def test_plans_of_different_pile_caps_by_word_mark_are_not_one_storey_drawn_twice() -> None:
    sheets, views = two_sheets(("PC1", "PC5"), ("PC2", "PC3"))

    assert same_storeys(compare(sheets, views)) == []


def test_plans_of_one_pile_cap_on_two_sheets_are_still_one_storey_drawn_twice() -> None:
    """Green on main (the tripwire): `P.C-2` is drawn on both sheets."""
    sheets, views = two_sheets(("P.C-1", "P.C-2"), ("P.C-2", "P.C-3"))

    found = same_storeys(compare(sheets, views))

    assert ["S-06", "S-07"] in [sheets_named(c, sheets, views) for c in found]


def test_a_plan_naming_a_mark_and_one_naming_none_are_still_compared() -> None:
    """Green on main (the tripwire): only two plans that both name marks, none shared, are apart."""
    sheets = [sheet("S-06", "DETAIL SHEET, PILE CAPS (P.C-1)"), sheet("S-07", "SECTIONS THRU PILE CAPS")]
    views = [caps("P.C-1"), (plan("PLAN, CAPS ON PILES", "pile_cap", "pile_cap"),)]

    [conflict] = same_storeys(compare(sheets, views))

    assert sheets_named(conflict, sheets, views) == ["S-06", "S-07"]


def test_two_layout_plans_of_one_floor_and_subject_still_raise_same_storey() -> None:
    """Green on main (the tripwire): two layout sheets' beam plans of level 5, no marks."""
    sheets = [sheet("S-33", "BEAM PLAN, LEVEL 5"), sheet("S-34", "BEAM PLAN, LEVELS 5 TO 8")]
    views = [
        (plan("BEAM PLAN, LEVEL 5", "beam", "floor_5"),),
        (plan("BEAM PLAN, LEVELS 5 TO 8", "beam", "floor_5", "floor_6", "floor_7", "floor_8"),),
    ]

    [conflict] = same_storeys(compare(sheets, views))

    assert sheets_named(conflict, sheets, views) == ["S-33", "S-34"]
