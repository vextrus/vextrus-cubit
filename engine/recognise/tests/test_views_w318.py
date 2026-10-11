"""T-W318's builder tests: the sheet's only plan taking its title's storeys, beyond the acceptance
cases (the meaning's edges, the words kept, a sheet's other Disciplines), and D9's "never propose a
sheet's only plan as a duplicate" pinned for plans that do not draw the structure (#233; the rule
itself is `views._proposal`'s, T-W316's to change). Every title and storey word is invented.

#409's bracket rule (case A11) is not pinned here: #409 was not on main when this was built.

    uv run pytest engine/recognise/tests/test_views_w318.py
"""

from dataclasses import replace

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import (
    ExclusionReason,
    SheetCandidate,
    Sourced,
    StoreysMeaning,
    StoreysSource,
    ValueSource,
    ViewCandidate,
    ViewKind,
)

SCALE = 50.0
PLACES = ((40.0, 300.0, 340.0, 560.0), (400.0, 300.0, 640.0, 560.0))


def _found(
    titles: list[str | None], *, title: str, stated: str | None, discipline: str = "structural"
) -> tuple[SheetCandidate, list[ViewCandidate]]:
    """One invented frame at 1:50 with a grid view per entry of `titles`, read by `views.find` on a
    sheet of `discipline` titled `title` and stating `stated`; its title block left out."""
    d = Sheets()
    block = frame_block(d)
    insert = d.insert(block, (10_000.0, 0.0, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: title, 2: "K-12"}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)
    for view_title, (x0, y0, x1, y1) in zip(titles, PLACES, strict=False):
        box = (10_000.0 + x0 * SCALE, y0 * SCALE, 10_000.0 + x1 * SCALE, y1 * SCALE)
        for i in range(5):
            x = box[0] + (box[2] - box[0]) * i / 4
            y = box[1] + (box[3] - box[1]) * i / 4
            d.line((x, box[1]), (x, box[3]))
            d.line((box[0], y), (box[2], y))
        if view_title is not None:
            d.text(view_title, (box[0], (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
    (found,) = sheets.find(d.artefact(), "structural", DEFAULT)
    sheet = replace(
        found,
        title=Sourced(title, ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced(discipline, ValueSource.FILE),
        storeys_as_stated=None if stated is None else Sourced(stated, ValueSource.TITLE_BLOCK_TEXT),
    )
    read = views.find(d.artefact(), sheet, views.default_conventions())
    return sheet, [v for v in read if v.kind is not ViewKind.TITLE_BLOCK]


def _plan(found: list[ViewCandidate]) -> ViewCandidate:
    (plan,) = [v for v in found if v.kind is ViewKind.PLAN]
    return plan


def test_the_plans_own_subject_decides_the_meaning_over_the_sheet_titles() -> None:
    """A column plan on a sheet titled for slabs: its own subject runs floor to floor."""
    _, found = _found(["COLUMN LAYOUT PLAN"], title="SLAB LAYOUT, 4TH FLOOR", stated="4TH FLOOR")

    plan = _plan(found)

    assert plan.subject == "column"
    assert plan.storeys == ("floor_4",)
    assert plan.storeys_meaning is StoreysMeaning.FLOOR_TO_FLOOR


def test_a_sheet_title_naming_two_subjects_decides_no_meaning_of_its_own() -> None:
    """An untitled plan on a sheet naming columns and beams: no one subject, so at floor level."""
    _, found = _found([None], title="COLUMN & BEAM LAYOUT, 4TH FLOOR", stated="4TH FLOOR")

    plan = _plan(found)

    assert plan.storeys == ("floor_4",)
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL
    assert plan.subject is None


def test_the_sheets_words_are_kept_as_stated_with_their_spaces_closed() -> None:
    _, found = _found([None], title="RIB LAYOUT", stated="2ND  &  4TH   FLOOR")

    plan = _plan(found)

    assert plan.storeys == ("floor_2", "floor_4")
    assert plan.storeys_as_stated == "2ND & 4TH FLOOR"
    assert plan.storeys_source is StoreysSource.SHEET_TITLE


def test_a_below_ground_title_is_inherited_as_its_keys() -> None:
    _, found = _found([None], title="RIB LAYOUT", stated="UNDERGROUND FLOOR")

    assert _plan(found).storeys == ("foundation", "ground")


def test_an_architectural_sheets_only_plan_inherits_and_keeps_its_steps() -> None:
    """The inheritance changes the storeys only: the plan's proposal is as it was."""
    _, found = _found(
        ["FURNITURE LAYOUT PLAN"],
        title="FURNITURE LAYOUT, 7TH FLOOR",
        stated="7TH FLOOR",
        discipline="architectural",
    )

    plan = _plan(found)

    assert plan.storeys == ("floor_7",)
    assert plan.storeys_source is StoreysSource.SHEET_TITLE
    assert plan.exclusion is None
    assert plan.steps


# D9: a sheet's only plan is never proposed as a duplicate unless it draws the structure ------------


@pytest.mark.parametrize(
    "plan_title",
    ["LINTEL LAYOUT PLAN", "STAIR LAYOUT PLAN", "FLAT TYPE-C LAYOUT PLAN", None],
    ids=["lintel", "stair", "room", "untitled"],
)
def test_an_architectural_sheets_only_plan_that_draws_no_structure_is_not_a_duplicate(
    plan_title: str | None,
) -> None:
    _, found = _found(
        [plan_title], title="FLOOR PLAN, 3RD FLOOR", stated="3RD FLOOR", discipline="architectural"
    )

    plan = _plan(found)

    assert plan.exclusion is None or plan.exclusion.reason is not ExclusionReason.DUPLICATE
    assert plan.steps


def test_only_a_plan_drawing_the_structure_is_an_architectural_duplicate() -> None:
    """The rule D9 leaves standing: a column plan in the architectural set is the structural set's."""
    _, found = _found(
        ["COLUMN LAYOUT PLAN"],
        title="FLOOR PLAN, 3RD FLOOR",
        stated="3RD FLOOR",
        discipline="architectural",
    )

    plan = _plan(found)

    assert plan.exclusion is not None
    assert plan.exclusion.reason is ExclusionReason.DUPLICATE
