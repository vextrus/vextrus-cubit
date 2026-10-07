"""Sheet kinds carry words and code narrows them before Jev (S15-Q1): `SheetConventions.sheet_kind_words`
and `sheets.narrowed`."""

import pytest

from engine.recognise import sheets
from engine.recognise.types import SheetConventions

DEFAULT = sheets.default_conventions()
STRUCTURAL = DEFAULT.kinds("structural")


def kinds_of(**words: list[str]) -> SheetConventions:
    return SheetConventions(
        sheet_kinds={"structural": ("beam_layout", "beam_details", "column_layout", "details")},
        common_sheet_kinds=("other",),
        sheet_kind_words={k: tuple(v) for k, v in words.items()},
    )


def test_a_title_naming_a_subject_keeps_its_kinds_and_the_kinds_of_no_words_in_order() -> None:
    held = kinds_of(beam_layout=["beam"], beam_details=["beam"], column_layout=["column"])

    assert sheets.narrowed("FIRST FLOOR BEAMS", held.kinds("structural"), held) == (
        "beam_layout",
        "beam_details",
        "details",
        "other",
    )


def test_a_title_naming_no_kinds_words_is_offered_every_kind() -> None:
    held = kinds_of(beam_layout=["beam"], column_layout=["column"])

    assert sheets.narrowed("SHEET 7", held.kinds("structural"), held) == held.kinds("structural")
    assert sheets.narrowed("", held.kinds("structural"), held) == held.kinds("structural")


def test_a_title_naming_two_subjects_keeps_both() -> None:
    held = kinds_of(beam_layout=["beam"], beam_details=["beam"], column_layout=["column"])

    assert set(sheets.narrowed("COLUMN & BEAM LAYOUT", held.kinds("structural"), held)) == set(
        held.kinds("structural")
    )


@pytest.mark.parametrize(
    ("title", "kept"),
    [
        ("BEAMLAYOUT", None),  # no whole word: nothing named, every kind kept
        ("Beam-Layout (R2)", "beam_layout"),
        ("COLUMNS", "column_layout"),
        ("PILE CAP LAYOUT", "pile_cap_layout"),
        ("U.G.W.R DETAILS", "tank_details"),  # a run of single letters is one word
        ("O.H.W.T. REINF.", "tank_details"),
    ],
)
def test_words_are_matched_whole_case_punctuation_and_a_plural_aside(
    title: str, kept: str | None
) -> None:
    offered = sheets.narrowed(title, STRUCTURAL, DEFAULT)

    if kept is None:
        assert offered == STRUCTURAL
    else:
        assert kept in offered
        assert offered != STRUCTURAL


def test_a_phrase_names_a_kind_only_with_its_words_together() -> None:
    held = kinds_of(beam_layout=["grade beam"], column_layout=["column"])

    assert "beam_layout" not in sheets.narrowed("BEAM GRADE C / COLUMN", held.kinds("structural"), held)
    assert "beam_layout" in sheets.narrowed("GRADE BEAM / COLUMN", held.kinds("structural"), held)


@pytest.mark.parametrize(
    ("title", "drawn"),
    [
        # How offices title the kinds (generic, invented): the drawn kind stays among the options.
        ("FOUNDATION LAYOUT", "pile_layout"),
        ("PILE CAP LAYOUT", "foundation_layout"),
        ("GROUND FLOOR BEAM LAYOUT", "beam_layout"),
        ("ROOF BEAM LAYOUT", "beam_layout"),
        ("COLUMN LAYOUT, PILE CAP TO 2ND FLOOR", "column_layout"),
        ("OVERHEAD TANK AND LIFT MACHINE ROOM", "tank_details"),
        ("TYPICAL FLOOR SLAB LAYOUT", "slab_layout"),
        ("STAIR DETAILS", "stair_details"),
        ("GENERAL NOTES", "general_notes"),
        ("LIFT CORE WALL DETAILS", "shear_wall_details"),
    ],
)
def test_the_default_words_keep_the_kind_a_structural_title_is_drawn_as(title: str, drawn: str) -> None:
    assert drawn in sheets.narrowed(title, STRUCTURAL, DEFAULT)


def test_the_default_conventions_give_words_only_to_kinds_they_have() -> None:
    known = {k for kinds in DEFAULT.sheet_kinds.values() for k in kinds} | set(
        DEFAULT.common_sheet_kinds
    )

    assert set(DEFAULT.sheet_kind_words) <= known
    assert "details" not in DEFAULT.sheet_kind_words
    assert "other" not in DEFAULT.sheet_kind_words


def test_the_kind_words_round_trip_and_a_kind_of_none_is_refused() -> None:
    assert SheetConventions.from_json(DEFAULT.to_json()) == DEFAULT
    with pytest.raises(ValueError, match="no sheet kind"):
        kinds_of(tie_layout=["tie"])
    with pytest.raises(ValueError, match="empty"):
        kinds_of(beam_layout=[" "])
