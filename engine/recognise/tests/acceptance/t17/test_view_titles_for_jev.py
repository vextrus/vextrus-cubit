"""Ticket 17's acceptance: the views' titles reach 15's `sheet_type` node as its `view_titles` fact, the
text of a JSON array of the titles in reading order (rows top to bottom, left to right), `"[]"` when
none (docs/plans/M0.md, "Wave 3's engine shapes"; the session-06 rulings, "17").

Through the contract's seam, `engine.recognise.views.find(artefact, sheet, conventions:
ViewConventions) -> list[ViewCandidate]` (docs/plans/M0.md, "The contracts fixed here"), read with
17's default, `engine/recognise/conventions/view-default.json`, and 13's `sheets.judgement`.

    uv run pytest -m needs_toolchain engine/recognise/tests/acceptance/t17
"""

import json
from importlib import import_module
from pathlib import Path

import pytest

from engine.read import read
from engine.recognise import sheets
from engine.recognise.tests.acceptance.t17 import drawing
from engine.recognise.tests.drawing import DEFAULT
from engine.recognise.types import SheetCandidate, ViewCandidate, ViewConventions

pytestmark = pytest.mark.needs_toolchain

VIEW_DEFAULT = Path(sheets.__file__).parent / "conventions" / "view-default.json"


@pytest.fixture(scope="module")
def found(
    tmp_path_factory: pytest.TempPathFactory,
) -> dict[str, tuple[SheetCandidate, list[ViewCandidate]]]:
    views = import_module("engine.recognise.views")  # 17's: ModuleNotFoundError until it is built

    conventions = ViewConventions.from_json(json.loads(VIEW_DEFAULT.read_text(encoding="utf-8")))
    build = tmp_path_factory.mktemp("t17-titles-build")
    folder = drawing.build_set(tmp_path_factory.mktemp("t17-titles-set"), build)
    result = {}
    for name in ("S-layouts", "S-model"):
        artefact = read(folder / "structural" / f"{name}.dwg")
        for sheet in sheets.find(artefact, "structural", DEFAULT):
            assert sheet.number is not None
            result[sheet.number.value] = (sheet, list(views.find(artefact, sheet, conventions)))
    return result


def view_titles(sheet: SheetCandidate, found_views: list[ViewCandidate]) -> list[str]:
    titles = [v.title for v in found_views if v.title is not None]
    request = sheets.judgement(sheet, titles, conventions=DEFAULT)
    assert request is not None
    fact = request.facts["view_titles"]
    assert isinstance(fact, str)
    value = json.loads(fact)
    assert isinstance(value, list)
    return value


def test_the_view_default_conventions_file_loads() -> None:
    ViewConventions.from_json(json.loads(VIEW_DEFAULT.read_text(encoding="utf-8")))


def test_view_titles_are_a_json_array_in_reading_order(
    found: dict[str, tuple[SheetCandidate, list[ViewCandidate]]],
) -> None:
    """S-201's four views on a 2 x 2 grid: the plan, the section, then the schedule, the detail."""
    sheet, found_views = found["S-201"]
    ours = [title for title, _, _ in drawing.LAYOUT_SHEETS["S-201"][1]]
    titles = view_titles(sheet, found_views)
    assert [t for t in titles if t in ours] == ours


def test_view_titles_are_the_empty_array_text_when_no_view_has_a_title(
    found: dict[str, tuple[SheetCandidate, list[ViewCandidate]]],
) -> None:
    sheet, found_views = found["S-204"]
    titles = [v.title for v in found_views if v.title is not None]
    request = sheets.judgement(sheet, titles, conventions=DEFAULT)
    assert request is not None
    assert request.facts["view_titles"] == "[]"
