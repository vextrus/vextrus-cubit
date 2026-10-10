"""Ticket S19-B4 (Train B, false conflict Questions), E4: "a subject key `septic_tank` (septic tank, soak
pit, soak well) apart from `tank`: a reservoir sheet and a septic-tank sheet sharing a title are
same_title (a true Question), not a continuation; routing `septic_tank` -> tanks".

Read through 17's public readers (`views.subjects`, `views.kind_steps`, the subject words of
`engine/recognise/conventions/view-default.json`) and 19b's `compare`. Every title and number is
invented.
"""

import json
from pathlib import Path

from engine.recognise import conflicts, views
from engine.recognise.types import SheetCandidate, ViewCandidate

from ..w334.test_series_and_ranges import (
    compare,
    conflicts_of,
    continuations,
    no_series,
    same_titles,
    sheet,
)
from .views import plan, section

CONVENTIONS = Path(conflicts.__file__).parent / "conventions" / "view-default.json"
SEPTIC_TANK_WORDS = ["septic tank", "septic tanks", "soak pit", "soak pits", "soak well", "soak wells"]


def test_the_view_conventions_name_septic_tank_a_subject_of_its_own_words() -> None:
    words = json.loads(CONVENTIONS.read_text(encoding="utf-8"))["subject_words"]

    assert sorted(words["septic_tank"]) == sorted(SEPTIC_TANK_WORDS)
    assert not set(SEPTIC_TANK_WORDS) & set(words["tank"])


def test_a_septic_tank_a_soak_pit_and_a_soak_well_are_read_as_septic_tank_not_tank() -> None:
    for title in (
        "SEPTIC TANK (EAST) LAYOUT",
        "TWIN SEPTIC TANKS ELEVATION",
        "SOAK PIT, ENLARGED",
        "SECTION B: SOAK WELL",
    ):
        assert views.subjects(title) == {"septic_tank"}, title


def test_a_reservoir_is_still_read_as_tank() -> None:
    """Green on main (the tripwire)."""
    for title in ("WATER RESERVOIR ON ROOF", "SECTION AT OHWT", "OVERHEAD TANK, ENLARGED"):
        assert views.subjects(title) == {"tank"}, title


def test_a_title_naming_the_reservoir_and_the_septic_tank_names_both() -> None:
    assert views.subjects("RESERVOIR AND SEPTIC TANK, DETAILS") == {"tank", "septic_tank"}


def test_a_septic_tank_is_proposed_for_the_tanks_step() -> None:
    """Green on main (the tripwire): routing gives `septic_tank` the Step `tank` has."""
    assert views.kind_steps("septic_tank_details", "structural") == ("tanks",)


def _sheets(
    title: str, first: tuple[ViewCandidate, ...], second: tuple[ViewCandidate, ...]
) -> tuple[list[SheetCandidate], list[tuple[ViewCandidate, ...]]]:
    return [sheet("S-15", title), sheet("S-16", title)], [first, second]


def test_a_reservoir_sheet_and_a_septic_tank_sheet_sharing_a_title_are_same_title() -> None:
    """S-16 carries S-15's reservoir title but draws the septic tank: a stale title block on the next
    sheet, a true Question, not a continuation."""
    title = "RESERVOIR (UNDERGROUND) BAR DETAILS"
    sheets, drawn = _sheets(
        title,
        (plan("RESERVOIR, PLAN VIEW", "tank"), section(None)),
        (plan("PLAN", None), plan("SEPTIC TANK (EAST) LAYOUT", "septic_tank"), section("CUT C-C")),
    )

    found = compare(sheets, drawn)

    assert continuations(found) == []
    assert same_titles(found) == [["S-15", "S-16"]]
    assert no_series(found)


def test_septic_tank_sheets_of_one_title_run_on() -> None:
    """Green on main (the tripwire)."""
    sheets, drawn = _sheets(
        "DETAILS: SEPTIC TANK UNIT",
        (plan("SEPTIC TANK (EAST) LAYOUT", "septic_tank"),),
        (section("SEPTIC TANK UNIT, CUT B-B"),),
    )

    found = compare(sheets, drawn)

    assert continuations(found) == [["S-15", "S-16"]]
    assert conflicts_of(found) == []


def test_a_title_naming_both_tanks_runs_on_over_sheets_that_draw_either() -> None:
    """Green on main (the tripwire): a title naming the reservoir and the septic tank is not
    contradicted by a sheet drawing only the septic tank."""
    sheets, drawn = _sheets(
        "RESERVOIR AND SEPTIC TANK, DETAILS",
        (plan("RESERVOIR, PLAN VIEW", "tank"), plan("SEPTIC TANK (EAST) LAYOUT", "septic_tank")),
        (section("SEPTIC TANK UNIT, CUT B-B"),),
    )

    found = compare(sheets, drawn)

    assert continuations(found) == [["S-15", "S-16"]]
    assert conflicts_of(found) == []
