"""T-W318's acceptance, part A: a plan View that states no storey takes its Sheet title's storeys
when it is the Sheet's only plan (the owner's ruling of 5 Oct 2026 on #318, "Show the title's
storeys"; m0-screens Ruling 2 as amended: "A Sheet with a plan View whose title states no storey takes
the Sheet title's storeys when that View is the Sheet's only plan, recorded as read from the Sheet's
title").

The seam: `engine.recognise.views.find(artefact, sheet)` on a hand-built ReadArtefact, the Sheet's
`storeys_as_stated` set by the test. The new names, fixed by the ticket:
`engine.recognise.types.StoreysSource` (a StrEnum, `SHEET_TITLE = "sheet_title"`) and
`ViewCandidate.storeys_source: StoreysSource | None = None` (None: the View's own title; set only
with storeys). They are reached by name at run time (`import_module`, `attrgetter`), so this file
type-checks before they exist and each test fails on its own until they do.

Every title and storey word here is invented. #409's bracket rule (case A11) is not pinned here: it was
not on main when these were written; the builder pins it in `engine/recognise/tests/test_views_w318.py`.

    uv run pytest engine/recognise/tests/acceptance/w318
"""

from dataclasses import fields
from importlib import import_module
from operator import attrgetter
from typing import Any

import pytest

from engine.recognise import storeys
from engine.recognise.tests.acceptance.w318.drawing import sheet_views
from engine.recognise.types import Box, StoreysMeaning, ViewCandidate, ViewKind

TYPES = import_module("engine.recognise.types")
source_of = attrgetter("storeys_source")


def sheet_title() -> Any:
    """`StoreysSource.SHEET_TITLE`: an AttributeError until the ticket adds it."""
    return TYPES.StoreysSource.SHEET_TITLE


def plans(found: list[ViewCandidate]) -> list[ViewCandidate]:
    return [v for v in found if v.kind is ViewKind.PLAN]


# The only plan inherits ------------------------------------------------------------------------------


def test_the_only_plan_stating_no_storey_takes_the_sheet_titles_storeys() -> None:
    """A1: a Sheet stating "3RD FLOOR" with one plan titled by its drawing alone."""
    _, found = sheet_views(["RIB LAYOUT PLAN"], title="RIB LAYOUT, 3RD FLOOR", stated="3RD FLOOR")

    (plan,) = plans(found)

    assert plan.storeys == ("floor_3",)
    assert plan.storeys_as_stated == "3RD FLOOR"
    assert source_of(plan) == sheet_title()
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_the_only_plan_with_no_title_at_all_takes_the_sheet_titles_storeys() -> None:
    """A2: the same Sheet, its plan drawn with no title text."""
    _, found = sheet_views([None], title="RIB LAYOUT, 3RD FLOOR", stated="3RD FLOOR")

    (plan,) = plans(found)

    assert plan.title is None
    assert plan.storeys == ("floor_3",)
    assert plan.storeys_as_stated == "3RD FLOOR"
    assert source_of(plan) == sheet_title()
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_the_string_value_of_the_sheet_title_source_is_sheet_title() -> None:
    """The ticket fixes the key the database and the API carry: `"sheet_title"`."""
    assert sheet_title() == "sheet_title"
    assert str(sheet_title()) == "sheet_title"


# Several plans: nothing is inherited ------------------------------------------------------------------


def test_two_plans_stating_none_inherit_nothing() -> None:
    """A3: "the Sheet's only plan" inherits; two plans that state none stay "not stated" (the Sheet's
    words still reach the API as `storeys_titled`, case C8)."""
    _, found = sheet_views(
        ["RIB LAYOUT PLAN", "WAFFLE SLAB LAYOUT PLAN"],
        title="RIB & WAFFLE LAYOUT, 2ND & 4TH FLOOR",
        stated="2ND & 4TH FLOOR",
    )

    both = plans(found)

    assert len(both) == 2
    assert [v.storeys for v in both] == [("not_stated",), ("not_stated",)]
    assert [source_of(v) for v in both] == [None, None]


def test_two_plans_one_stating_its_own_storey_inherit_nothing() -> None:
    """A4: one plan states the 2nd floor, one states none: neither takes the title's."""
    _, found = sheet_views(
        ["2ND FLOOR RIB LAYOUT PLAN", "WAFFLE SLAB LAYOUT PLAN"],
        title="RIB & WAFFLE LAYOUT, 2ND & 3RD FLOOR",
        stated="2ND & 3RD FLOOR",
    )

    first, second = plans(found)

    assert first.storeys == ("floor_2",)
    assert second.storeys == ("not_stated",)
    assert (source_of(first), source_of(second)) == (None, None)


def test_a_views_own_storeys_win_over_its_sheet_titles() -> None:
    """A5: the only plan states the 2nd floor on a Sheet stating the 5th: the plan's own stand (the
    Check, not the reader, raises the difference: case C1)."""
    _, found = sheet_views(
        ["2ND FLOOR RIB LAYOUT PLAN"], title="RIB LAYOUT, 5TH FLOOR", stated="5TH FLOOR"
    )

    (plan,) = plans(found)

    assert plan.storeys == ("floor_2",)
    assert plan.storeys_as_stated == "2ND FLOOR"
    assert source_of(plan) is None


@pytest.mark.parametrize("stated", [None, "LEVEL +7.40"], ids=["states-none", "reads-to-no-storey"])
def test_a_sheet_stating_no_storey_gives_its_plan_none(stated: str | None) -> None:
    """A6: no storey words on the Sheet, or words that read to no storey key."""
    _, found = sheet_views(["RIB LAYOUT PLAN"], title="RIB LAYOUT", stated=stated)

    (plan,) = plans(found)

    assert plan.storeys == ("not_stated",)
    assert source_of(plan) is None


# Only plan Views inherit -------------------------------------------------------------------------------


def test_only_the_plan_inherits_never_a_detail_beside_it() -> None:
    """A7: a plan and a detail on a Sheet stating the 3rd floor: the plan inherits, the detail not."""
    _, found = sheet_views(
        ["RIB LAYOUT PLAN", "TYPICAL RIB DETAIL"], title="RIB LAYOUT, 3RD FLOOR", stated="3RD FLOOR"
    )

    by_kind = {v.kind: v for v in found}

    assert set(by_kind) == {ViewKind.PLAN, ViewKind.DETAIL}
    assert by_kind[ViewKind.PLAN].storeys == ("floor_3",)
    assert source_of(by_kind[ViewKind.PLAN]) == sheet_title()
    assert by_kind[ViewKind.DETAIL].storeys == ()
    assert source_of(by_kind[ViewKind.DETAIL]) is None


def test_a_sheet_with_no_plan_view_gives_no_view_storeys() -> None:
    """A7: a section and a detail only: the Sheet keeps its words on the Sheet (case C8, web W1)."""
    sheet, found = sheet_views(
        ["SECTION K-K", "TYPICAL RIB DETAIL"], title="RIB SECTIONS, 3RD FLOOR", stated="3RD FLOOR"
    )

    assert {v.kind for v in found} == {ViewKind.SECTION, ViewKind.DETAIL}
    assert [v.storeys for v in found] == [(), ()]
    assert [source_of(v) for v in found] == [None, None]
    assert sheet.storeys_as_stated is not None
    assert sheet.storeys_as_stated.value == "3RD FLOOR"


# The symbolic ends and the meaning ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("stated", "keys"),
    [("TYPICAL FLOOR", ("typical",)), ("1ST TO TOP FLOOR", ("floor_1", "top"))],
)
def test_the_symbolic_ends_are_inherited_as_keys(stated: str, keys: tuple[str, ...]) -> None:
    """A8: "typical" and a range running to the top are carried as the reader keys them (its keys,
    then where the range runs to)."""
    _, found = sheet_views(["RIB LAYOUT PLAN"], title=f"RIB LAYOUT, {stated}", stated=stated)

    (plan,) = plans(found)

    assert plan.storeys == keys
    assert plan.storeys_as_stated == stated
    assert source_of(plan) == sheet_title()


@pytest.mark.parametrize(
    ("title", "meaning"),
    [
        ("COLUMN LAYOUT, 6TH FLOOR", StoreysMeaning.FLOOR_TO_FLOOR),
        ("SLAB LAYOUT, 6TH FLOOR", StoreysMeaning.AT_FLOOR_LEVEL),
    ],
)
def test_an_untitled_plans_meaning_is_its_sheet_titles_one_subject(
    title: str, meaning: StoreysMeaning
) -> None:
    """A9: an untitled plan has no subject of its own; the Sheet title's one subject decides: a column
    plan's storeys run floor to floor, a slab plan's are at floor level. The View's own subject is left
    as read (None), so no boundary-storey or same-storey Question is newly raised by it."""
    _, found = sheet_views([None], title=title, stated="6TH FLOOR")

    (plan,) = plans(found)

    assert plan.storeys == ("floor_6",)
    assert plan.storeys_meaning is meaning
    assert plan.subject is None
    assert source_of(plan) == sheet_title()


# Hostile input -----------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "stated",
    [
        "4TH FLOOR " * (storeys.MAX_TEXT // 10 + 1),
        f"{storeys.MAX_FLOOR + 1}TH FLOOR",
        "8",
    ],
    ids=["past-max-text", "past-max-floor", "a-figure-only"],
)
def test_hostile_stated_words_raise_nothing_and_give_nothing(stated: str) -> None:
    """A10: words longer than the reader reads, a floor past its bound, a bare figure: no exception,
    no inheritance."""
    _, found = sheet_views(["RIB LAYOUT PLAN"], title="RIB LAYOUT", stated=stated)

    (plan,) = plans(found)

    assert plan.storeys == ("not_stated",)
    assert source_of(plan) is None


# Valid candidates --------------------------------------------------------------------------------------


def test_every_view_found_is_a_valid_candidate() -> None:
    """A12: each View `find` returns passes its own checks again (storeys and meaning together, a
    source only with storeys)."""
    _, found = sheet_views(
        ["RIB LAYOUT PLAN", "TYPICAL RIB DETAIL"], title="RIB LAYOUT, 3RD FLOOR", stated="3RD FLOOR"
    )

    for view in found:
        again = ViewCandidate(**{f.name: getattr(view, f.name) for f in fields(view)})
        assert again == view
        assert source_of(again) is None or again.storeys


def test_a_source_without_storeys_is_refused() -> None:
    """A12: `ViewCandidate(storeys=(), storeys_source=SHEET_TITLE)` raises ValueError."""
    given: dict[str, Any] = {
        "box": Box(0.0, 0.0, 10.0, 10.0),
        "kind": ViewKind.PLAN,
        "storeys": (),
        "storeys_source": sheet_title(),
    }

    with pytest.raises(ValueError, match=r"(?i)storey"):
        ViewCandidate(**given)


def test_a_source_with_storeys_is_accepted() -> None:
    """A12: a source given with storeys and their meaning is a valid View."""
    given: dict[str, Any] = {
        "box": Box(0.0, 0.0, 10.0, 10.0),
        "kind": ViewKind.PLAN,
        "storeys": ("floor_3",),
        "storeys_meaning": StoreysMeaning.AT_FLOOR_LEVEL,
        "storeys_source": sheet_title(),
    }

    assert source_of(ViewCandidate(**given)) == sheet_title()
