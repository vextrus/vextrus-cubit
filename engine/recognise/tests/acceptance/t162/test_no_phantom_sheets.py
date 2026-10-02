"""Ticket 162 (#162, W6): no phantom sheets. "A fixture with an empty `Layout1`, a stale `Layout1`
template and a frameless notes cluster yields no sheets from them (or excluded, uncounted and
unquestioned)."

Each file holds three real framed sheets in model space and one would-be phantom (`drawing.py`). The
promise at the sheet finder's boundary (`sheets.find`): the file's live sheets (those proposed with no
exclusion) are exactly the three real ones, read as before; anything found from the phantom is either
absent or proposed out (an exclusion set). Built through the real writer and read by the real reader:

    uv run --no-sync pytest -m needs_toolchain engine/recognise/tests/acceptance/t162
"""

from pathlib import Path

import pytest

from engine.read import read
from engine.recognise import sheets
from engine.recognise.tests.acceptance.t162 import drawing
from engine.recognise.tests.drawing import DEFAULT
from engine.recognise.types import SheetCandidate

pytestmark = pytest.mark.needs_toolchain


@pytest.fixture(scope="module")
def files(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    build = tmp_path_factory.mktemp("t162-build")
    folder = tmp_path_factory.mktemp("structural")
    return drawing.build_all(folder, build)


def _found(path: Path) -> list[SheetCandidate]:
    return list(sheets.find(read(path), "structural", DEFAULT))


def _live(found: list[SheetCandidate]) -> list[SheetCandidate]:
    return [s for s in found if s.exclusion is None]


def _numbers(found: list[SheetCandidate]) -> list[str | None]:
    return [s.number.value if s.number else None for s in found]


def _describe(found: list[SheetCandidate]) -> list[tuple[str | None, str | None, str | None]]:
    return [
        (s.location.layout, s.number.value if s.number else None, s.title.value if s.title else None)
        for s in found
    ]


def _only_the_real_sheets_are_live(found: list[SheetCandidate]) -> None:
    live = _live(found)
    assert _numbers(live) == drawing.NUMBERS, _describe(live)


def test_an_empty_layout1_is_not_a_live_sheet(files: dict[str, Path]) -> None:
    found = _found(files["empty_layout1"])

    _only_the_real_sheets_are_live(found)
    assert all(s.exclusion is not None for s in found if s.location.layout == "Layout1")


def test_a_stale_layout1_template_with_annotation_is_not_a_live_sheet(
    files: dict[str, Path],
) -> None:
    found = _found(files["template_layout1"])

    _only_the_real_sheets_are_live(found)
    assert all(s.exclusion is not None for s in found if s.location.layout == "Layout1")


def test_a_stale_layout1_holding_only_an_empty_title_block_is_not_a_live_sheet(
    files: dict[str, Path],
) -> None:
    found = _found(files["template_layout1_bare"])

    _only_the_real_sheets_are_live(found)
    assert all(s.exclusion is not None for s in found if s.location.layout == "Layout1")


def test_a_frameless_notes_cluster_is_not_a_live_sheet(files: dict[str, Path]) -> None:
    found = _found(files["notes_loose"])

    _only_the_real_sheets_are_live(found)
    assert len(_live(found)) == len(drawing.SHEETS)


def test_a_boxed_notes_cluster_with_no_title_block_is_not_a_live_sheet(
    files: dict[str, Path],
) -> None:
    found = _found(files["notes_boxed"])

    _only_the_real_sheets_are_live(found)
    assert len(_live(found)) == len(drawing.SHEETS)


@pytest.mark.parametrize("phantom", drawing.PHANTOMS)
def test_the_real_sheets_beside_a_phantom_are_read_untouched(
    files: dict[str, Path], phantom: str
) -> None:
    real = [s for s in _found(files[phantom]) if s.number and s.number.value in drawing.NUMBERS]

    assert [
        (s.number.value if s.number else None, s.title.value if s.title else None) for s in real
    ] == [(number, " ".join(title)) for number, title, _ in drawing.SHEETS]
    assert all(s.exclusion is None and s.location.layout is None for s in real)
    assert all(s.discipline is not None and s.discipline.value == "structural" for s in real)
