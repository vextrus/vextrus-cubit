"""Ticket 24f, F1 (session 06's ruling): a key holds `storeys` as a list of as-stated words; the export's
sheet holds `storeys_as_stated` as a sourced text. "Normalise each item (case-fold, collapse whitespace,
strip punctuation around words, "&"/"and" and commas as separators), split the export's text by the same
rule into items, compare as lists (order kept); an empty list equals a missing/empty value. A string key
keeps working."

Invented keys and exports only (the refuter's cases).
"""

from pathlib import Path
from typing import Any

import pytest

from tools.scorer.tests.acceptance.t24s.runs import Place, export_sheet, key_sheet

LAYOUT = "Sheet A"


def one_sheet(place: Place, key_storeys: Any, export_storeys: str | None) -> None:
    """One sheet with no views, right in every field but perhaps its storeys."""
    place.write_keys(
        [key_sheet(LAYOUT, "QZ-901", "Invented first plan", "", []) | {"storeys": key_storeys}]
    )
    sheet = export_sheet(LAYOUT, "QZ-901", "Invented first plan", "", [])
    sheet["storeys_as_stated"] = (
        None if export_storeys is None else {"value": export_storeys, "source": "title_block_text"}
    )
    place.write_run([sheet])


def shown(capfd: pytest.CaptureFixture[str]) -> str:
    output = capfd.readouterr()
    return output.out + output.err


@pytest.mark.parametrize(
    ("key_storeys", "export_storeys"),
    [
        (["L1"], "L1"),
        (["Ground floor"], "GROUND FLOOR"),
        (["3rd", "5th", "7th floor"], "3RD, 5TH & 7TH FLOOR"),
        ([], None),
    ],
    ids=["one-item", "case-folded", "comma-and-ampersand", "empty-vs-missing"],
)
def test_a_list_of_storeys_passes_against_the_exports_stated_text(
    tmp_path: Path,
    capfd: pytest.CaptureFixture[str],
    key_storeys: list[str],
    export_storeys: str | None,
) -> None:
    place = Place(tmp_path)
    one_sheet(place, key_storeys, export_storeys)

    assert place.score() == 0
    text = shown(capfd)
    assert f"sheet 1 (layout {LAYOUT}): pass" in text, text
    assert "storeys wrong" not in text, text


def test_storeys_joined_by_and_pass_as_separate_items(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(place, ["3rd", "5th floor"], "3rd and 5th floor")

    assert place.score() == 0
    text = shown(capfd)
    assert f"sheet 1 (layout {LAYOUT}): pass" in text, text


@pytest.mark.parametrize(
    ("key_storeys", "export_storeys"),
    [
        (["3rd", "5th", "7th floor"], "3RD, 5TH & 8TH FLOOR"),
        (["5th", "3rd", "7th floor"], "3RD, 5TH & 7TH FLOOR"),
        (["3rd", "5th"], "3RD, 5TH & 7TH FLOOR"),
        (["Ground floor"], None),
        ([], "GROUND FLOOR"),
    ],
    ids=["another-storey", "order-changed", "an-item-short", "missing-in-export", "extra-in-export"],
)
def test_a_wrong_list_of_storeys_fails_as_storeys_wrong(
    tmp_path: Path,
    capfd: pytest.CaptureFixture[str],
    key_storeys: list[str],
    export_storeys: str | None,
) -> None:
    place = Place(tmp_path)
    one_sheet(place, key_storeys, export_storeys)

    assert place.score() == 0
    text = shown(capfd)
    assert "storeys wrong" in text, text


def test_a_string_key_of_storeys_keeps_working(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(place, "3rd, 5th & 7th floor", "3RD, 5TH & 7TH FLOOR")

    assert place.score() == 0
    text = shown(capfd)
    assert f"sheet 1 (layout {LAYOUT}): pass" in text, text
