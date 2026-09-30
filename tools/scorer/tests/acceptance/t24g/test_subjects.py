"""Ticket 24g, R1 "Subjects": "the scorer holds the engine's 14 subject words as a fixed table (a
committed test fails if it differs from `engine/recognise/conventions/view-default.json`); maps a key
phrase to the first of those words appearing in it (longest first, `_` folded to a space); a joined
view's subject is right when the mapped word equals the export's; a key phrase mapping to no word is
left out of the count and reported as "subjects outside the vocabulary: n"."

The keys hold a free phrase ("column layout", "pile cap"); the export holds one of the engine's words
or null. Invented keys and exports only.
"""

import re
from pathlib import Path

import pytest

from tools.scorer.tests.acceptance.t24s.runs import Place, export_view, key_view

from .sets import one_sheet, shown, total, unsubjected_view

A_BOX = [10.0, 10.0, 110.0, 110.0]
B_BOX = [200.0, 10.0, 300.0, 110.0]
OUTSIDE = "furniture arrangement"  # contains none of the engine's subject words


def outside_the_vocabulary(output: str, n: int) -> bool:
    return re.search(rf"subjects outside the vocabulary: {n}\b", output) is not None


def test_column_layout_maps_to_column_and_is_right(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(A_BOX, "View A", subject="column layout")],
        [export_view(A_BOX, "View A", subject="column")],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 1, 1), output
    assert "subject wrong" not in output
    assert total(output, "sheets", 1, 1), output


def test_pile_cap_maps_to_pile_cap_not_pile_and_is_right(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(A_BOX, "View A", subject="pile cap")],
        [export_view(A_BOX, "View A", subject="pile_cap")],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 1, 1), output
    assert "subject wrong" not in output


def test_pile_cap_is_wrong_against_an_export_subject_of_pile(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(A_BOX, "View A", subject="pile cap")],
        [export_view(A_BOX, "View A", subject="pile")],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 0, 1), output
    assert "a view's subject wrong" in output


def test_a_mapped_phrase_is_wrong_against_another_export_word(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(A_BOX, "View A", subject="column layout")],
        [export_view(A_BOX, "View A", subject="beam")],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 0, 1), output
    assert "a view's subject wrong" in output


def test_a_null_export_subject_is_wrong_against_a_mappable_key_phrase(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(A_BOX, "View A", subject="column layout")],
        [unsubjected_view(A_BOX, "View A")],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 0, 1), output
    assert "a view's subject wrong" in output


def test_a_phrase_with_no_engine_word_is_left_out_of_the_count_and_reported(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [
            key_view(A_BOX, "View A", subject="column layout"),
            key_view(B_BOX, "View B", subject=OUTSIDE),
        ],
        [
            export_view(A_BOX, "View A", subject="column"),
            export_view(B_BOX, "View B", subject="slab"),
        ],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 1, 1), output
    assert outside_the_vocabulary(output, 1), output
    assert "subject wrong" not in output
    assert total(output, "sheets", 1, 1), output
    assert OUTSIDE not in output


def test_a_phrase_with_no_engine_word_is_left_out_even_when_the_export_subject_is_null(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(A_BOX, "View A", subject=OUTSIDE)],
        [unsubjected_view(A_BOX, "View A")],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 0, 0), output
    assert outside_the_vocabulary(output, 1), output
    assert "subject wrong" not in output


def test_an_underscored_key_phrase_is_folded_before_mapping(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(A_BOX, "View A", subject="shear_wall layout")],
        [export_view(A_BOX, "View A", subject="shear_wall")],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", 1, 1), output
