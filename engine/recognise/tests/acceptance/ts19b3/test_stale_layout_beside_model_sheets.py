"""Ticket S19-B3 (Train B): no phantom Sheet from a stale layout beside model-space Sheets.

The rule: a layout is not a Sheet, dropped and counted in the file's `sheet_report` as
`layout_stale_beside_model_sheets` (so the QS is told), only when all hold: it has a title block; it
has at least one viewport besides AutoCAD's main one; every such viewport is read and shows fewer than
`MIN_SHOWN` things; it plots no model-space frame; its tab is not named as a sheet number; and the
file's model space holds a titled frame. Otherwise nothing changes.

Each file holds two real framed sheets in model space and one layout (`drawing.py`). The first two
tests are the ticket's promise (red today: the stale layout is proposed out `blank`, a Sheet the walk
counts); the rest guard what must not change (green today). Built through the real writer and read by
the real reader:

    uv run --no-sync pytest -m needs_toolchain engine/recognise/tests/acceptance/ts19b3
"""

from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.read import read
from engine.recognise import sheets
from engine.recognise.sheets import FoundSheets
from engine.recognise.tests.acceptance.ts19b3 import drawing
from engine.recognise.tests.drawing import DEFAULT
from engine.recognise.types import ExclusionReason

pytestmark = pytest.mark.needs_toolchain

COUNT = "layout_stale_beside_model_sheets"
"""The `sheet_report` count of stale layouts dropped beside model-space Sheets."""


@pytest.fixture(scope="module")
def files(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    build = tmp_path_factory.mktemp("ts19b3-build")
    folder = tmp_path_factory.mktemp("structural")
    return drawing.build_all(folder, build)


def _found(path: Path) -> FoundSheets:
    return sheets.find(read(path), "structural", DEFAULT)


def _describe(found: FoundSheets) -> list[tuple[str | None, str | None, str | None]]:
    return [
        (
            s.location.layout,
            s.number.value if s.number else None,
            s.exclusion.reason.value if s.exclusion else None,
        )
        for s in found
    ]


def _on(found: FoundSheets, tab: str) -> list[Any]:
    return [s for s in found if s.location.layout == tab]


def _dropped(found: FoundSheets) -> int:
    return found.budget.report().get(COUNT, 0)


def _only_the_model_sheets(found: FoundSheets) -> None:
    assert not _on(found, drawing.STALE_TAB), f"the stale layout is found as a Sheet: {_describe(found)}"
    assert [s.number.value if s.number else None for s in found] == drawing.NUMBERS, _describe(found)
    assert all(s.exclusion is None for s in found), _describe(found)
    assert _dropped(found) == 1, found.budget.report()


# The promise ------------------------------------------------------------------------------------------


def test_a_stale_layout_drawing_notes_beside_model_sheets_is_dropped_and_counted(
    files: dict[str, Path],
) -> None:
    _only_the_model_sheets(_found(files["stale_noted"]))


def test_a_stale_layout_drawing_little_beside_model_sheets_is_dropped_and_counted(
    files: dict[str, Path],
) -> None:
    _only_the_model_sheets(_found(files["stale_bare"]))


def test_the_export_lists_only_the_model_sheets_and_reports_the_drop(
    files: dict[str, Path], tmp_path: Path
) -> None:
    out = tmp_path / "out" / "export.json"

    document: Any = harness.run(files["stale_noted"].parent, out)

    (reading,) = document["files"]
    assert reading["stages"]["sheets"]["state"] == "ok", reading["stages"]["sheets"]
    assert len(reading["sheets"]) == len(drawing.NUMBERS), (
        f"the stale layout is found as a Sheet: {len(reading['sheets'])} sheets"
    )
    assert reading["sheet_report"].get(COUNT) == 1, reading["sheet_report"]


# The guards (green today, and after) ------------------------------------------------------------------


def test_a_stale_layout_in_a_file_of_lines_only_is_still_proposed_out_blank(
    files: dict[str, Path],
) -> None:
    found = _found(files["lines_only"])

    stale = _on(found, drawing.STALE_TAB)
    assert len(stale) == 1, _describe(found)
    assert stale[0].exclusion is not None
    assert stale[0].exclusion.reason == ExclusionReason.BLANK
    assert _dropped(found) == 0


def test_a_stale_layout_whose_tab_is_named_as_a_sheet_number_is_kept(
    files: dict[str, Path],
) -> None:
    found = _found(files["named_tab"])

    assert len(_on(found, drawing.NAMED_TAB)) == 1, _describe(found)
    assert _dropped(found) == 0


def test_a_layout_with_a_viewport_onto_a_model_frame_is_not_dropped(
    files: dict[str, Path],
) -> None:
    found = _found(files["views_a_frame"])

    assert len(_on(found, drawing.STALE_TAB)) == 1, _describe(found)
    assert _dropped(found) == 0


def test_a_layout_with_a_viewport_that_cannot_be_read_is_not_dropped(
    files: dict[str, Path],
) -> None:
    found = _found(files["unreadable_view"])

    assert len(_on(found, drawing.STALE_TAB)) == 1, _describe(found)
    assert _dropped(found) == 0


def test_a_notes_layout_with_only_the_main_viewport_beside_model_sheets_stays_a_live_sheet(
    files: dict[str, Path],
) -> None:
    found = _found(files["notes_main_only"])

    notes = _on(found, drawing.STALE_TAB)
    assert len(notes) == 1, _describe(found)
    assert notes[0].exclusion is None, _describe(found)
    assert notes[0].number is not None
    assert notes[0].number.value == drawing.NOTES_NUMBER
    assert _dropped(found) == 0
