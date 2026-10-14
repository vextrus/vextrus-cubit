"""S27-G3's builder tests (#336), beyond its acceptance: the structure rule read in any word order, the
lintel's word kept out of it, and the sheet's title read for an Architectural view whose own title
names nothing, never for a Structural one. Every title is invented, made of convention words.

    uv run pytest engine/recognise/tests/test_views_s27g3.py
"""

import pytest

from engine.recognise import views
from engine.recognise.tests.test_views_w318 import _found, _plan
from engine.recognise.types import ExclusionReason, ViewKind
from engine.recognise.views import routing as routing_part
from engine.recognise.views import titles as titles_part

READING = titles_part._reading(views.default_conventions())


@pytest.mark.parametrize(
    ("title", "draws"),
    [
        ("SLAB PLAN WITH BEAMS", True),
        ("TANK SLAB PLAN WITH BEAMS", True),  # a tank before the slab
        ("SLAB AND COLUMNS PLAN", True),
        ("SLAB AND COLUMN LAYOUT", True),
        ("FRAMING LAYOUT", True),
        ("SLAB AND LINTEL LAYOUT", False),  # only a lintel's word
        ("SLAB, LINTEL AND WINDOW PLAN", False),
        ("TANK SLAB PLAN", False),  # no structure subject
        ("SLAB LAYOUT PLAN", False),
        ("STAIR AND COLUMN PLAN", False),  # no slab: its subject is the stair, as before
        ("LINTEL AND BEAM LAYOUT PLAN", False),  # no slab: its subject is the lintel's
    ],
)
def test_a_title_draws_the_structure_by_its_words_in_any_order(title: str, draws: bool) -> None:
    assert routing_part._draws_structure(title, READING) is draws


@pytest.mark.parametrize(
    ("title", "draws"),
    [
        ("LINTEL BEAM AND SUNSHADE PLAN", False),
        ("LINTEL-BEAM & CHAJJA PLAN", False),
        ("SLAB AND LINTEL BEAMS PLAN", False),
        ("LINTEL & BEAM AND SLAB PLAN", False),
        ("SLAB PLAN WITH BEAMS", True),
        ("LINTEL BEAM, SLAB AND COLUMN PLAN", True),  # the column is the structure's
    ],
)
def test_a_lintel_beams_beam_is_the_lintels_beside_a_slab(title: str, draws: bool) -> None:
    """Fix round 1 (#844's review): "beam" in a lintel beam's phrase is a lintel's word, so a lintel
    beam named with a slab, sunshade or chajja stays the architect's."""
    assert routing_part._draws_structure(title, READING) is draws


@pytest.mark.parametrize(
    ("sheet_title", "exclusion"),
    [
        ("LINTEL BEAM AND SUNSHADE PLAN", None),
        ("SLAB AND LINTEL-BEAM PLAN", None),
        ("SLAB PLAN WITH BEAMS", ExclusionReason.DUPLICATE),
    ],
)
def test_a_lintel_beam_and_slab_plan_stays_in_walls_and_rooms(
    sheet_title: str, exclusion: ExclusionReason | None
) -> None:
    _, found = _found([sheet_title], title=sheet_title, stated=None, discipline="architectural")

    plan = _plan(found)

    assert (plan.exclusion.reason if plan.exclusion else None) == exclusion
    assert plan.steps == (() if exclusion else ("walls", "rooms"))


@pytest.mark.parametrize(
    ("sheet_title", "exclusion"),
    [
        ("SLAB PLAN WITH BEAMS", ExclusionReason.DUPLICATE),
        ("TANK SLAB PLAN WITH COLUMNS", ExclusionReason.DUPLICATE),
        ("FRAMING LAYOUT", ExclusionReason.DUPLICATE),
        ("SLAB, LINTEL AND WINDOW PLAN", None),
        ("FLOOR PLAN", None),
    ],
)
def test_an_architectural_plan_naming_nothing_is_routed_by_its_sheets_title(
    sheet_title: str, exclusion: ExclusionReason | None
) -> None:
    _, found = _found(["3RD FLOOR PLAN"], title=sheet_title, stated=None, discipline="architectural")

    plan = _plan(found)

    assert (plan.exclusion.reason if plan.exclusion else None) == exclusion
    assert plan.steps == (() if exclusion else ("walls", "rooms"))
    assert plan.subject is None  # its own subject stays as its title says


def test_an_architectural_plan_naming_its_own_subject_is_not_routed_by_the_sheet() -> None:
    _, found = _found(
        ["STAIR LAYOUT PLAN"], title="BEAM LAYOUT PLAN", stated=None, discipline="architectural"
    )

    plan = _plan(found)

    assert plan.exclusion is None
    assert plan.steps == ("walls", "rooms")


def test_a_plan_beside_the_structure_plan_its_sheet_names_stays_in_walls_and_rooms() -> None:
    """The sheet's title names the column layout beside it, not the floor plan (review_self f1)."""
    _, found = _found(
        ["GROUND FLOOR PLAN", "COLUMN LAYOUT"],
        title="GROUND FLOOR PLAN AND COLUMN LAYOUT",
        stated=None,
        discipline="architectural",
    )

    routes = {v.title: (v.steps, v.exclusion.reason if v.exclusion else None) for v in found}

    assert routes == {
        "GROUND FLOOR PLAN": (("walls", "rooms"), None),
        "COLUMN LAYOUT": ((), ExclusionReason.DUPLICATE),
    }


def test_a_view_naming_nothing_on_a_toilet_sheet_goes_to_the_plumbing_part() -> None:
    _, found = _found(
        ["TYPICAL SECTION OF BASIN", None],
        title="TOILET DETAILS",
        stated=None,
        discipline="architectural",
    )

    assert [(v.part, v.steps, v.exclusion) for v in found] == [
        ("plumbing", ("walls", "rooms"), None)
    ] * len(found)
    assert len(found) == 2


def test_a_structural_view_naming_nothing_keeps_every_step_its_sheet_names() -> None:
    """The sheet fallback is the Architectural route's: a Structural view still takes the Steps of
    every subject its sheet's title names, never only the first."""
    _, found = _found(["3RD FLOOR PLAN"], title="SLAB AND BEAM LAYOUT", stated=None)

    plan = _plan(found)

    assert plan.kind is ViewKind.PLAN
    assert plan.steps == ("slabs", "beams")
    assert plan.exclusion is None


@pytest.mark.parametrize(
    ("title", "draws"),
    [
        ("FALSE CEILING FRAMING PLAN", False),
        ("PARTITION FRAMING LAYOUT", False),
        ("ALUMINIUM FRAMING PLAN", False),
        ("GLAZING FRAMING LAYOUT", False),
        ("FRAMING PLAN OF WINDOWS", False),
        ("FRAMING LAYOUT", True),  # the acceptance's A-15
        ("ROOF FRAMING PLAN", True),
        ("SLAB AND FRAMING PLAN", True),
        ("BEAM AND CEILING FRAMING PLAN", True),  # its beam is the structure's
    ],
)
def test_framing_is_the_structures_only_when_nothing_the_architect_frames_is_named(
    title: str, draws: bool
) -> None:
    """Fix round 2 (#844's review): "framing" beside a ceiling, a partition, aluminium, glazing or an
    opening is the architect's own framing view, not the structural set's."""
    assert routing_part._draws_structure(title, READING) is draws


def test_the_architects_framing_plan_beside_a_floor_plan_stays_in_walls_and_rooms() -> None:
    _, found = _found(
        ["GROUND FLOOR PLAN", "FALSE CEILING FRAMING PLAN"],
        title="GROUND FLOOR PLAN AND FALSE CEILING FRAMING",
        stated=None,
        discipline="architectural",
    )

    routes = {v.title: (v.steps, v.exclusion) for v in found}

    assert routes == {
        "GROUND FLOOR PLAN": (("walls", "rooms"), None),
        "FALSE CEILING FRAMING PLAN": (("walls", "rooms"), None),
    }
