"""When Jev's kind for a sheet is asked rather than proposed (#228): `proposals.unsure` and the
title rule it reads, `proposals.kinds_named`."""

from decimal import Decimal
from typing import Any

import pytest

from vextrus.platform.services import jev
from vextrus.takeoff.services.read_propose.proposals import kinds_named, unsure


def answer(*ranked: tuple[str, str]) -> jev.Judgement:
    """Jev's answer: each kind with its probability, the first its choice."""
    first, p_first = ranked[0]
    return jev.Judgement(
        node=jev.SHEET_TYPE.key,
        model=jev.SHEET_TYPE.model,
        choice=first,
        confidence=Decimal(p_first),
        probabilities=tuple((k, Decimal(p)) for k, p in ranked),
    )


@pytest.mark.parametrize(
    ("title", "kinds", "named"),
    [
        ("COLUMN SCHEDULE", ["beam_layout", "column_schedule"], ["column_schedule"]),
        ("Typical column-schedule (R1)", ["column_schedule"], ["column_schedule"]),
        ("TYPICAL FLOOR BEAM DETAILS", ["details", "beam_details"], ["beam_details"]),
        ("TYPICAL DETAILS", ["details", "beam_details"], []),
        ("MISC. OTHER DETAILS", ["other", "details"], []),
        ("SLAB OUTLINE LAYOUT", ["slab_layout", "slab_outline_layout"], ["slab_outline_layout"]),
        ("PILE CAP LAYOUT", ["pile_layout", "pile_cap_layout"], ["pile_cap_layout"]),
        ("FIRST FLOOR SLAB REINFORCEMENT", ["slab_layout", "slab_details"], []),
        ("DOOR&WINDOW SCHEDULE", ["door_window_schedule"], ["door_window_schedule"]),
        ("BEAMLAYOUT", ["beam_layout"], []),
        ("TYPICAL COLUMN SCHEDULES", ["column_schedule"], ["column_schedule"]),
        # one-word kinds sit inside other kinds' titles (the refuter's finding B, score 55)
        ("STAIR SECTION & DETAILS", ["stair_details", "section"], ["stair_details"]),
        ("TOILET PLAN, ELEVATION & SECTION", ["toilet_details", "elevation", "section"], []),
        ("KITCHEN PLAN AND ELEVATION", ["kitchen_details", "elevation"], []),
        ("BOUNDARY WALL & GATE ELEVATION", ["boundary_wall_gate_details", "elevation"], []),
        ("GROUND FLOOR LIGHT POINT LAYOUT & LEGEND", ["point_wiring_layout", "legend"], []),
        ("", ["beam_layout"], []),
    ],
)
def test_a_title_names_a_kind_only_by_its_whole_words_together_never_a_generic_kind(
    title: str, kinds: list[str], named: list[str]
) -> None:
    assert kinds_named(title, kinds) == named


def test_a_sure_answer_is_proposed_whatever_its_second_or_the_title_says() -> None:
    sure = answer(("beam_layout", "0.92"), ("column_schedule", "0.08"))
    assert not unsure(sure, "COLUMN SCHEDULE")


@pytest.mark.parametrize(("second", "asks"), [("0.46", True), ("0.45", False), ("0.10", False)])
def test_below_sure_the_top_two_are_close_when_the_lead_is_under_close_by(
    settings: Any, second: str, asks: bool
) -> None:
    settings.VEXTRUS_JEV_SHEET_TYPE_CLOSE_BY = Decimal("0.15")
    assert unsure(answer(("beam_layout", "0.60"), ("beam_details", second)), "") is asks


def test_below_sure_a_title_naming_only_another_offered_kind_asks() -> None:
    clear = answer(("beam_layout", "0.60"), ("column_schedule", "0.10"), ("details", "0.30"))
    assert unsure(clear, "COLUMN SCHEDULE")
    assert not unsure(clear, "BEAM LAYOUT AND COLUMN SCHEDULE")  # it names Jev's first too
    assert not unsure(clear, "TYPICAL DETAILS")  # the generic word contradicts nothing
    assert not unsure(clear, "COLUMN DETAILS")  # no offered kind's words


@pytest.mark.parametrize(
    ("first", "title"),
    [
        ("stair_details", "STAIR SECTION & DETAILS"),
        ("toilet_details", "TOILET PLAN, ELEVATION & SECTION"),
        ("kitchen_details", "KITCHEN PLAN AND ELEVATION"),
        ("boundary_wall_gate_details", "BOUNDARY WALL & GATE ELEVATION"),
        ("point_wiring_layout", "GROUND FLOOR LIGHT POINT LAYOUT & LEGEND"),
    ],
)
def test_a_one_word_kind_in_the_title_never_contradicts_jevs_clear_first(first: str, title: str) -> None:
    """The refuter's finding B (score 55): each of these asked, Jev right and well ahead."""
    clear = answer((first, "0.85"), ("section", "0.05"), ("elevation", "0.05"), ("legend", "0.05"))
    assert not unsure(clear, title)


def test_a_single_kind_offered_is_never_close() -> None:
    assert not unsure(answer(("beam_layout", "0.60")), "")


@pytest.mark.parametrize(
    ("first", "named", "title"),
    [
        ("slab_details", "slab_layout", "ROOF SLAB LAYOUT & DETAILS"),
        ("pile_cap_details", "pile_cap_layout", "PILE CAP LAYOUT & DETAILS"),
        ("foundation_details", "foundation_layout", "FOUNDATION LAYOUT AND DETAILS"),
        ("beam_details", "beam_layout", "BEAM LAYOUT & DETAILS"),
        ("column_schedule", "column_layout", "COLUMN LAYOUT & SCHEDULE"),
    ],
)
def test_a_named_kind_of_jevs_firsts_subject_never_contradicts_it(
    first: str, named: str, title: str
) -> None:
    """Review 1's finding 2 (score 50): each of these asked, Jev right and well ahead."""
    clear = answer((first, "0.60"), (named, "0.10"), ("details", "0.10"))
    assert not unsure(clear, title)


def test_a_named_kind_of_another_subject_still_contradicts() -> None:
    clear = answer(("beam_details", "0.60"), ("column_layout", "0.10"), ("pile_details", "0.10"))
    assert unsure(clear, "COLUMN LAYOUT & DETAILS")
    assert unsure(answer(("pile_details", "0.60"), ("pile_cap_layout", "0.10")), "PILE CAP LAYOUT")


@pytest.mark.parametrize(
    ("first", "named", "title"),
    [
        ("slab_details", "slab_layout", "LEVEL 7 SLAB LAYOUT, BLOCK Q"),
        ("beam_details", "beam_layout", "BEAM LAYOUT, BLOCK Q"),
        ("pile_details", "pile_layout", "PILE LAYOUT, ZONE Q"),
        ("column_schedule", "column_layout", "COLUMN LAYOUT, LEVELS 2-9 (BLOCK Q)"),
        ("door_window_details", "door_window_schedule", "DOOR & WINDOW SCHEDULE, BLOCK Q"),
        ("roof_details", "roof_plan", "UPPER ROOF PLAN, BLOCK Q"),
    ],
)
def test_a_named_kind_of_jevs_firsts_subject_contradicts_it_without_its_last_word(
    first: str, named: str, title: str
) -> None:
    """Review 2's finding 2 (score 50): fix round 1 proposed each of these; the title names only
    the other kind of the subject, so it asks."""
    clear = answer((first, "0.60"), (named, "0.10"), ("details", "0.10"))
    assert unsure(clear, title)


@pytest.mark.parametrize(
    ("title", "kinds", "named"),
    [
        ("BEAM LAYOUT & DETAILS", ["beam_layout", "beam_details"], ["beam_layout", "beam_details"]),
        (
            "COLUMN LAYOUTS AND SCHEDULE",
            ["column_schedule", "column_layout"],
            ["column_schedule", "column_layout"],
        ),
        (
            "COLUMN LAYOUT & BEAM DETAILS",
            ["beam_layout", "column_layout", "beam_details"],
            ["column_layout", "beam_details"],
        ),
        ("COLUMN & BEAM LAYOUT", ["beam_layout", "column_layout"], ["beam_layout", "column_layout"]),
        (
            "PILE, PILE CAP / COLUMN LAYOUT",
            ["pile_layout", "pile_cap_layout", "column_layout"],
            ["pile_layout", "pile_cap_layout", "column_layout"],
        ),
        (
            "TIE BEAM LAYOUT, SECTIONS & DETAILS",
            ["beam_layout", "beam_details", "beam_section", "details"],
            ["beam_layout", "beam_details", "beam_section"],
        ),
        ("DETAILS & BEAM LAYOUT", ["beam_details", "beam_layout"], ["beam_layout"]),
        ("SLAB LAYOUT & MISC. DETAILS", ["slab_details", "slab_layout"], ["slab_layout"]),
        (
            "ISLAND & STAIR DETAILS",
            ["island_details", "stair_details"],
            ["island_details", "stair_details"],
        ),
    ],
)
def test_a_segment_of_only_a_kinds_last_word_takes_the_subject_beside_it(
    title: str, kinds: list[str], named: list[str]
) -> None:
    """An elided subject expanded (review 3): a last word alone takes the subject words of the
    segment before it; a subject alone takes the last word of the segment after it."""
    assert kinds_named(title, kinds) == named


@pytest.mark.parametrize(
    ("first", "others", "title"),
    [
        ("beam_layout", ("column_layout", "beam_details"), "COLUMN LAYOUT & BEAM DETAILS"),
        ("pile_details", ("pile_layout", "pile_cap_details"), "PILE LAYOUT & PILE CAP DETAILS"),
        ("slab_details", ("slab_layout", "details"), "ROOF SLAB LAYOUT & MISC. DETAILS"),
        ("slab_details", ("slab_layout", "details"), "SLAB LAYOUT, TYPICAL DETAILS"),
        ("column_schedule", ("column_layout", "beam_details"), "COLUMN LAYOUT & BEAM SCHEDULE"),
    ],
)
def test_a_kinds_last_word_borrowed_from_another_subject_never_clears_a_contradiction(
    first: str, others: tuple[str, str], title: str
) -> None:
    """Review 3's finding (score 50): fix round 2 proposed each of these, Jev's first's last word
    being somewhere in the title; the title names other kinds and not Jev's first, so it asks."""
    clear = answer((first, "0.60"), (others[0], "0.10"), (others[1], "0.10"))
    assert unsure(clear, title)


def test_a_title_naming_jevs_first_by_an_elided_subject_does_not_contradict_it() -> None:
    """A subject sharing the last word of the segment after it: either kind, as Jev's first, is
    proposed."""
    for first, other in (("beam_layout", "column_layout"), ("column_layout", "beam_layout")):
        assert not unsure(answer((first, "0.60"), (other, "0.10")), "COLUMN & BEAM LAYOUT")
