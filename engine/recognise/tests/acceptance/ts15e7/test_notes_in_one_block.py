"""S15-E7 (#538, superseding #195): "A notes Sheet of one block insert is kept". A titled layout with
no viewport but AutoCAD's main one, whose notes are drawn inside a single block insert, is a Sheet:
its notes are what it draws, never "title-block-only". A tab holding only its title block (a
template's, even one whose frame block draws a detailed logo) stays no live Sheet (#162).

Each file is one layout (`drawing.py`), built through the real writer and read by the real reader, at
the sheet finder's boundary (`sheets.find`, the harness's `sheets` stage):

    uv run --no-sync pytest -m needs_toolchain engine/recognise/tests/acceptance/ts15e7
"""

import json
from pathlib import Path

import pytest

from engine.read import read
from engine.recognise import sheets
from engine.recognise.tests.acceptance.ts15e7 import drawing
from engine.recognise.types import SheetCandidate, SheetConventions

pytestmark = pytest.mark.needs_toolchain

CONVENTIONS = SheetConventions.from_json(
    json.loads(
        (Path(sheets.__file__).parent / "conventions" / "sheet-default.json").read_text(encoding="utf-8")
    )
)


@pytest.fixture(scope="module")
def files(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    build = tmp_path_factory.mktemp("ts15e7-build")
    folder = tmp_path_factory.mktemp("structural")
    return drawing.build_all(folder, build)


def _found(path: Path) -> list[SheetCandidate]:
    return list(sheets.find(read(path), "structural", CONVENTIONS))


def _on_the_layout(found: list[SheetCandidate]) -> list[SheetCandidate]:
    return [s for s in found if s.location.layout == drawing.LAYOUT]


def _describe(found: list[SheetCandidate]) -> list[tuple[object, ...]]:
    return [
        (
            s.location.layout,
            s.number.value if s.number else None,
            s.exclusion.reason if s.exclusion else None,
        )
        for s in found
    ]


def test_a_notes_sheet_whose_notes_are_one_block_insert_is_kept(files: dict[str, Path]) -> None:
    found = _found(files["notes_text_block"])

    assert len(_on_the_layout(found)) == 1, f"the notes Sheet is not kept: {_describe(found)}"


def test_a_notes_sheet_of_one_block_insert_is_a_live_sheet_with_its_number(
    files: dict[str, Path],
) -> None:
    found = _on_the_layout(_found(files["notes_text_block"]))

    assert [(s.number.value if s.number else None, s.exclusion) for s in found] == [
        (drawing.NUMBER, None)
    ], f"the notes Sheet is not a live Sheet with its number: {_describe(found)}"


def test_a_notes_sheet_whose_one_block_holds_a_paragraph_of_notes_is_a_live_sheet(
    files: dict[str, Path],
) -> None:
    found = _on_the_layout(_found(files["notes_mtext_block"]))

    assert [(s.number.value if s.number else None, s.exclusion) for s in found] == [
        (drawing.NUMBER, None)
    ], f"the notes Sheet is not a live Sheet with its number: {_describe(found)}"


def test_a_template_tab_whose_frame_draws_a_detailed_logo_is_not_a_live_sheet(
    files: dict[str, Path],
) -> None:
    found = _on_the_layout(_found(files["template"]))

    assert all(s.exclusion is not None for s in found), (
        f"a template tab is a live Sheet: {_describe(found)}"
    )
