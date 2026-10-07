"""When Jev's kind for a sheet is asked rather than proposed (#228): `proposals.unsure` and the
title rule it reads, `proposals.kinds_named`."""

from decimal import Decimal
from typing import Any

import pytest

from engine.recognise.sheets import default_conventions
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


def offered(discipline: str) -> list[str]:
    """The kinds a Discipline's sheet is offered, as the conventions hold them (never invented)."""
    return list(default_conventions().kinds(discipline))


def clear_over(discipline: str, first: str, second: str) -> jev.Judgement:
    """Jev's answer over every kind the Discipline offers: its first at 0.60, well ahead of its
    second at 0.10, the rest sharing what is left."""
    kinds = offered(discipline)
    assert first in kinds, first
    assert second in kinds, second
    rest = (Decimal("0.30") / (len(kinds) - 2)).quantize(Decimal("0.000001"))
    return answer(
        (first, "0.60"), (second, "0.10"), *((k, str(rest)) for k in kinds if k not in (first, second))
    )


@pytest.mark.parametrize(
    ("discipline", "title", "named"),
    [
        ("structural", "BEAM LAYOUT & DETAILS", ["beam_layout", "beam_details"]),
        ("structural", "COLUMN LAYOUTS AND SCHEDULE", ["column_layout", "column_schedule"]),
        ("structural", "COLUMN LAYOUT & BEAM DETAILS", ["column_layout", "beam_details"]),
        ("structural", "COLUMN & BEAM LAYOUT", ["column_layout", "beam_layout"]),
        ("structural", "COLUMN & LANDING SLAB LAYOUT", ["column_layout", "slab_layout"]),
        ("structural", "DETAILS & BEAM LAYOUT", ["beam_layout"]),
        ("structural", "SLAB LAYOUT & MISC. DETAILS", ["slab_layout"]),
        ("structural", "LEVEL 4 SLAB LAYOUT + DETAILS (TYP.)", ["slab_layout", "slab_details"]),
        # a run of subjects reads together (review 3); a view kind's word ends it (review 1)
        (
            "structural",
            "PILE, PILE CAP & COLUMN LAYOUT",
            ["pile_layout", "pile_cap_layout", "column_layout"],
        ),
        ("structural", "PILE & GRADE BEAM SECTION, COLUMN LAYOUT", ["column_layout"]),
        ("structural", "TIE BEAM LAYOUT, SECTIONS & DETAILS", ["beam_layout"]),
        ("architectural", "DOOR & WINDOW SCHEDULE & DETAILS", ["door_window_schedule"]),
    ],
)
def test_a_one_word_segment_takes_its_elided_part_from_the_segment_beside_it_only(
    discipline: str, title: str, named: list[str]
) -> None:
    """An elided subject expanded over the Discipline's real kinds (review 3; #426 review 1): a
    segment of only a kind's last word takes the subject of the segment just before it, a segment of
    one subject word the last word of the segment just after it; nothing more."""
    assert kinds_named(title, offered(discipline)) == named


@pytest.mark.parametrize(
    ("discipline", "first", "second", "title"),
    [
        # review 3: a last word borrowed from another subject's kind
        ("structural", "beam_layout", "column_layout", "COLUMN LAYOUT & BEAM DETAILS"),
        ("structural", "pile_details", "pile_layout", "PILE LAYOUT & PILE CAP DETAILS"),
        ("structural", "slab_details", "slab_layout", "ROOF SLAB LAYOUT & MISC. DETAILS"),
        ("structural", "slab_details", "slab_layout", "SLAB LAYOUT, TYPICAL DETAILS"),
        ("structural", "column_schedule", "column_layout", "COLUMN LAYOUT & BEAM SCHEDULE"),
        # #426 review 1, finding 1: borrowed past a segment that names its own subject
        ("structural", "pile_layout", "column_layout", "PILE & GRADE BEAM SECTION, COLUMN LAYOUT"),
        ("structural", "slab_layout", "beam_layout", "SLAB & SHEAR WALL ELEVATION, BEAM LAYOUT"),
        ("structural", "pile_cap_layout", "slab_layout", "PILE CAP & STAIR SECTION, SLAB LAYOUTS"),
        # #426 review 1, finding 2: a details segment after a section is not expanded
        ("structural", "beam_details", "beam_layout", "TIE BEAM LAYOUT, SECTIONS & DETAILS"),
        ("structural", "slab_details", "slab_layout", "ROOF SLAB LAYOUT, SECTION & DETAILS"),
        # a joined subject is never reached past the adjacent segment
        (
            "architectural",
            "door_window_details",
            "door_window_schedule",
            "DOOR & WINDOW SCHEDULE & DETAILS",
        ),
        (
            "architectural",
            "door_window_schedule",
            "door_window_details",
            "DOOR/WINDOW DETAILS, SCHEDULE",
        ),
    ],
)
def test_a_title_naming_other_kinds_and_not_jevs_first_asks(
    discipline: str, first: str, second: str, title: str
) -> None:
    """Each was proposed by an earlier draft; the title names other offered kinds and not Jev's
    first, so it asks."""
    assert unsure(clear_over(discipline, first, second), title)


@pytest.mark.parametrize(
    ("discipline", "first", "second", "title"),
    [
        ("structural", "beam_layout", "column_layout", "COLUMN & BEAM LAYOUT"),
        ("structural", "column_layout", "beam_layout", "COLUMN & BEAM LAYOUT"),
        ("structural", "beam_details", "beam_layout", "BEAM LAYOUT & DETAILS (LEVELS 2-6)"),
        ("structural", "beam_details", "beam_layout", "BEAM LAYOUT & DETAILS-2"),
        ("structural", "beam_details", "beam_layout", "BEAM LAYOUT WITH DETAILS"),
        ("structural", "slab_details", "slab_layout", "LEVEL 4 SLAB LAYOUT + DETAILS"),
        ("structural", "column_schedule", "column_layout", "TYPICAL COLUMN LAYOUT & SCHEDULES"),
        ("structural", "pile_cap_details", "pile_cap_layout", "PILE CAP LAYOUT AND DETAILS"),
        (
            "architectural",
            "door_window_details",
            "door_window_schedule",
            "DOOR-WINDOW SCHEDULE & DETAILS",
        ),
    ],
)
def test_a_title_naming_jevs_first_by_an_elided_subject_proposes_it(
    discipline: str, first: str, second: str, title: str
) -> None:
    """Review 1's shape and the fix round 3 refuter's (scores 60 and 55): the title names Jev's
    first once its one-word segment is expanded, so it is proposed."""
    assert not unsure(clear_over(discipline, first, second), title)


@pytest.mark.parametrize("joiner", [" AND ", " & ", " and "])
@pytest.mark.parametrize(
    ("discipline", "kind", "first", "title"),
    [
        (
            "architectural",
            "door_window_schedule",
            "door_window_details",
            "TYPICAL DOOR{}WINDOW SCHEDULE",
        ),
        ("architectural", "door_window_details", "door_window_schedule", "DOOR{}WINDOW DETAILS (TYP.)"),
        ("architectural", "door_window_layout", "door_window_details", "LEVEL 3 DOOR{}WINDOW LAYOUT"),
        ("architectural", "boundary_wall_gate_details", "details", "BOUNDARY WALL{}GATE DETAILS"),
        (
            "electrical",
            "substation_generator_layout",
            "single_line_diagram",
            "SUBSTATION{}GENERATOR LAYOUT",
        ),
        (
            "fire",
            "extinguisher_signage_layout",
            "fire_alarm_layout",
            "PODIUM EXTINGUISHER{}SIGNAGE LAYOUT",
        ),
        ("plumbing", "pit_chamber_details", "septic_tank_details", "SITE PIT{}CHAMBER DETAILS"),
    ],
)
def test_a_kind_titled_by_its_english_name_with_and_names_it_as_with_an_ampersand(
    discipline: str, kind: str, first: str, title: str, joiner: str
) -> None:
    """#426 review 2 (score 75): a run of subject words joined by AND reads together, as by "&":
    the title names its kind, so Jev's other first asks, and Jev's first of that kind is proposed."""
    worded = title.format(joiner)
    assert kind in kinds_named(worded, offered(discipline))
    assert unsure(clear_over(discipline, first, kind), worded)
    assert not unsure(clear_over(discipline, kind, first), worded)


@pytest.mark.parametrize(
    ("discipline", "kind", "first", "title"),
    [
        (
            "architectural",
            "lintel_layout",
            "ceiling_layout",
            "LINTEL, SUNSHADE & FALSE SLAB LAYOUT (BLOCK B)",
        ),
        (
            "structural",
            "tank_details",
            "retaining_wall_details",
            "UNDERGROUND RESERVOIR, TANK AND PIT DETAILS",
        ),
        (
            "plumbing",
            "septic_tank_details",
            "pit_chamber_details",
            "SEPTIC TANK & SOAK WELL DETAILS (TYP.)",
        ),
        (
            "architectural",
            "slab_outline_layout",
            "lintel_layout",
            "LEVEL 2 SLAB OUTLINE AND BEAM LAYOUT",
        ),
        (
            "architectural",
            "door_window_schedule",
            "door_window_details",
            "DOOR, WINDOW & VENTILATOR SCHEDULE",
        ),
        ("plumbing", "pit_chamber_details", "septic_tank_details", "INSPECTION PIT AND CHAMBER DETAILS"),
        ("architectural", "stair_details", "toilet_details", "STAIR AND RAMP DETAILS"),
        ("architectural", "finish_schedule", "door_window_schedule", "WALL & FACADE FINISH SCHEDULE"),
    ],
)
def test_a_run_of_subjects_names_each_kind_whose_subject_it_holds(
    discipline: str, kind: str, first: str, title: str
) -> None:
    """#426 review 3 (score 50): a title worded as a kind's catalogue name, three or more subjects
    or more than the kind's own, names it; so Jev's other first asks, and Jev's first of that kind
    is proposed."""
    assert kind in kinds_named(title, offered(discipline))
    assert unsure(clear_over(discipline, first, kind), title)
    assert not unsure(clear_over(discipline, kind, first), title)
