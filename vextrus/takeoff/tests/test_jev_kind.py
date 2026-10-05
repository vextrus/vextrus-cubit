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
        ("STAIR SECTION & DETAILS", ["stair_details", "section"], []),
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
