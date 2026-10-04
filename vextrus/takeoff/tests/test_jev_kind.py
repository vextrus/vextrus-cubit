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


def test_a_single_kind_offered_is_never_close() -> None:
    assert not unsure(answer(("beam_layout", "0.60")), "")
