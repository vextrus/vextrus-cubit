"""Ticket T-W332's acceptance, the pure rule (the ticket's section 3 B; #332): a numbered Sheet whose
title block gives no title takes the title of its one drawing View, source "view_title", and the
storeys that title states; several differently titled Views, no guess: the Question stays (the owner's
rulings of 5 Oct 2026, session 13).

Through the seam the ticket fixes: `vextrus.takeoff.services.read_propose.sheets.named_by_view(
candidate, views, conventions) -> SheetCandidate`, the candidate unchanged or the same candidate with
its title (and storeys as stated) from the View. Views are built by hand; every title is invented.

    uv run pytest vextrus/takeoff/tests/acceptance/w332/test_named_by_view.py
"""

import copy
from collections.abc import Callable, Sequence

import pytest

from engine.recognise import sheets as finder
from engine.recognise.types import (
    Box,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from vextrus.takeoff.services.read_propose import sheets

CONVENTIONS = finder.default_conventions()
SEAM = "named_by_view"
"""The ticket's seam in `read_propose.sheets` (a name until the builder writes it)."""
Rule = Callable[[SheetCandidate, Sequence[ViewCandidate], SheetConventions], SheetCandidate]
FRAME = Box(0.0, 0.0, 42_000.0, 29_700.0)


def numbered(title: Sourced | None = None, *, number: str | None = "ST-14") -> SheetCandidate:
    return SheetCandidate(
        SheetLocation(box=FRAME),
        number=None if number is None else Sourced(number, ValueSource.TITLE_BLOCK_TEXT),
        title=title,
        discipline=Sourced("structural", ValueSource.FILE),
    )


def view(kind: ViewKind, title: str | None, at: int = 0) -> ViewCandidate:
    x0 = 1_000.0 + at * 10_000.0
    return ViewCandidate(box=Box(x0, 8_000.0, x0 + 9_000.0, 20_000.0), kind=kind, title=title)


TITLE_BLOCK = ViewCandidate(box=Box(34_000.0, 0.0, 42_000.0, 6_000.0), kind=ViewKind.TITLE_BLOCK)


def view_title() -> ValueSource:
    """The ticket's new source, "view_title"."""
    return ValueSource("view_title")


def named(candidate: SheetCandidate, views: list[ViewCandidate]) -> SheetCandidate:
    rule: Rule = getattr(sheets, SEAM)
    return rule(candidate, views, CONVENTIONS)


def test_one_titled_drawing_view_gives_an_untitled_numbered_sheet_its_title_and_storeys() -> None:
    candidate = numbered()

    found = named(candidate, [view(ViewKind.DETAIL, "7TH FLOOR CANOPY SLAB DETAIL"), TITLE_BLOCK])

    assert found.title == Sourced("7TH FLOOR CANOPY SLAB DETAIL", view_title())
    assert found.storeys_as_stated == Sourced("7TH FLOOR", view_title())
    assert found.number == candidate.number
    assert found.location == candidate.location
    assert found.discipline == candidate.discipline


def test_a_view_title_that_states_no_storey_gives_the_title_alone() -> None:
    found = named(numbered(), [view(ViewKind.PLAN, "RIBBED SLAB LAYOUT"), TITLE_BLOCK])

    assert found.title == Sourced("RIBBED SLAB LAYOUT", view_title())
    assert found.storeys_as_stated is None


def test_the_title_blocks_title_wins_over_a_views() -> None:
    candidate = numbered(Sourced("LIFT PIT DETAILS", ValueSource.TITLE_BLOCK_TEXT))

    found = named(candidate, [view(ViewKind.DETAIL, "WATER TANK SLAB DETAIL"), TITLE_BLOCK])

    assert found == candidate
    assert found.title == Sourced("LIFT PIT DETAILS", ValueSource.TITLE_BLOCK_TEXT)


def test_several_differently_titled_views_leave_the_sheet_untitled() -> None:
    candidate = numbered()
    views = [
        view(ViewKind.DETAIL, "CANOPY SLAB DETAIL"),
        view(ViewKind.SECTION, "SECTION B-B RETAINING WALL", at=1),
        TITLE_BLOCK,
    ]

    found = named(candidate, views)

    assert found == candidate
    assert found.title is None


def test_two_views_of_one_title_are_still_not_one_view() -> None:
    """The ticket takes one View only (section 1, "Not in this ticket": no title from several Views
    that agree)."""
    candidate = numbered()
    views = [
        view(ViewKind.DETAIL, "RAMP WALL DETAIL"),
        view(ViewKind.DETAIL, "RAMP WALL DETAIL", at=1),
        TITLE_BLOCK,
    ]

    assert named(candidate, views) == candidate


def test_a_sheet_with_no_number_is_not_titled_by_its_view() -> None:
    candidate = numbered(number=None)

    found = named(candidate, [view(ViewKind.DETAIL, "WATER TANK SLAB DETAIL"), TITLE_BLOCK])

    assert found == candidate
    assert found.title is None


@pytest.mark.parametrize("title", ["B-B", "4", "DT 7", "D-12", None])
def test_a_view_title_that_names_nothing_is_not_taken(title: str | None) -> None:
    """A mark or a figure: no word of three letters or more (an untitled View has None)."""
    candidate = numbered()

    assert named(candidate, [view(ViewKind.DETAIL, title), TITLE_BLOCK]) == candidate


def test_a_one_word_view_title_of_three_letters_or_more_is_taken() -> None:
    found = named(numbered(), [view(ViewKind.SCHEDULE, "LINTELS"), TITLE_BLOCK])

    assert found.title == Sourced("LINTELS", view_title())


@pytest.mark.parametrize("code", sheets.RAW_CODES)
def test_a_view_title_holding_a_raw_cad_code_is_not_taken(code: str) -> None:
    candidate = numbered()
    title = f"CANOPY {code}SLAB DETAIL"

    assert named(candidate, [view(ViewKind.DETAIL, title), TITLE_BLOCK]) == candidate


@pytest.mark.parametrize(
    "title",
    ["CANOPY SLAB " + "DETAIL " * 40, "CANOPY\x07SLAB DETAIL", "CANOPY SLAB\x1b DETAIL"],
    ids=["longer than 200", "a bell", "an escape"],
)
def test_an_overlong_or_controlled_view_title_is_not_taken(title: str) -> None:
    candidate = numbered()

    assert named(candidate, [view(ViewKind.DETAIL, title), TITLE_BLOCK]) == candidate


@pytest.mark.parametrize(
    "views", [[], [TITLE_BLOCK], [TITLE_BLOCK, TITLE_BLOCK]], ids=["none", "a title block", "two"]
)
def test_only_drawing_views_can_title_a_sheet(views: list[ViewCandidate]) -> None:
    candidate = numbered()

    assert named(candidate, views) == candidate


def test_a_title_block_view_with_a_title_never_titles_the_sheet() -> None:
    candidate = numbered()
    titled_block = ViewCandidate(
        box=TITLE_BLOCK.box, kind=ViewKind.TITLE_BLOCK, title="CANOPY SLAB DETAIL"
    )

    assert named(candidate, [titled_block]) == candidate


def test_the_candidate_passed_in_is_not_changed() -> None:
    candidate = numbered()
    before = copy.deepcopy(candidate)

    found = named(candidate, [view(ViewKind.DETAIL, "WATER TANK SLAB DETAIL"), TITLE_BLOCK])

    assert candidate == before
    assert candidate.title is None
    assert found is not candidate
    assert found.title == Sourced("WATER TANK SLAB DETAIL", view_title())
