"""S22-FL5's acceptance, defect 2's guard in 19b (`engine.recognise.conflicts`, same storey): the column
storey rule (a floor-to-floor range's top storey is where the next range of columns starts, so it is
not compared) belongs to column and shear-wall plans, not to every plan read floor to floor. Two
architectural plans whose ranges meet, now read floor to floor, both claim the storey they meet at (one
storey drawn twice); two structural column plans whose ranges meet still drop the first's top storey.

The seam: `engine.recognise.conflicts.find` on sheets read by `views.find` (`drawing.compare`). Every
number, title and storey word here is invented.

    uv run pytest engine/recognise/tests/acceptance/ts22fl5 -rf
"""

from engine.recognise.types import StoreysMeaning

from .drawing import Sheet, compare, plans, same_storeys

FIRST = Sheet(
    "A-11", "DOOR AND WINDOW PLAN, 2ND TO 4TH FLOOR", None, "2ND TO 4TH FLOOR DOOR & WINDOW PLAN"
)
THEN = Sheet(
    "A-12", "DOOR AND WINDOW PLAN, 4TH TO 6TH FLOOR", None, "4TH TO 6TH FLOOR DOOR & WINDOW PLAN"
)

COLUMNS = [
    Sheet(
        "S-13",
        "COLUMN LAYOUT PLAN, GROUND TO 3RD FLOOR",
        None,
        "GROUND TO 3RD FLOOR COLUMN LAYOUT PLAN",
        "structural",
    ),
    Sheet(
        "S-14",
        "COLUMN LAYOUT PLAN, 3RD TO 6TH FLOOR",
        None,
        "3RD TO 6TH FLOOR COLUMN LAYOUT PLAN",
        "structural",
    ),
]


def test_two_architectural_plans_whose_ranges_meet_both_claim_the_storey_they_meet_at() -> None:
    meanings = [p.storeys_meaning for s in (FIRST, THEN) for p in plans(s)]
    assert meanings == [StoreysMeaning.FLOOR_TO_FLOOR] * 2, (
        "engine.recognise.views.storeys read an architectural plan at floor level"
    )

    assert same_storeys(compare([FIRST, THEN])) == [("A-11", "A-12", "floor_4")], (
        "the column storey rule dropped an architectural plan's top storey"
    )


def test_two_structural_column_plans_whose_ranges_meet_still_drop_the_first_ones_top_storey() -> None:
    meanings = [p.storeys_meaning for s in COLUMNS for p in plans(s)]
    assert meanings == [StoreysMeaning.FLOOR_TO_FLOOR] * 2

    assert same_storeys(compare(COLUMNS)) == []
