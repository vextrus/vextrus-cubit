"""Ticket 17's acceptance: each sheet's views in the pipeline's export, as the blind scorer (24s) reads
them (the session-06 rulings, "24s <-> 17"): per sheet `views[]`, each `{box: [x0, y0, x1, y1] on paper
in mm, title, kind, subject, storeys}`, a model-space sheet's boxes converted to paper mm, and
`working_view` on the sheet (an index into `views`, or null).

A view is matched as the scorer matches it: IoU >= 0.8 with the same kind (docs/specs/M1.md, #8's
contract). Built at test time by the repo's writer (drawing.py), so the toolchain is needed:

    uv run pytest -m needs_toolchain engine/recognise/tests/acceptance/t17
"""

from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.export import load_schema, validate
from engine.recognise.tests.acceptance.t17 import drawing

pytestmark = pytest.mark.needs_toolchain

MATCH = 0.8
"""The scorer's view join: IoU at least this, with the same kind."""


@pytest.fixture(scope="module")
def export(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    build = tmp_path_factory.mktemp("t17-build")
    folder = drawing.build_set(tmp_path_factory.mktemp("t17-set"), build)
    out = tmp_path_factory.mktemp("t17-out") / "export.json"
    document: dict[str, Any] = harness.run(folder, out)
    return document


def sheets_by_number(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    found: dict[str, dict[str, Any]] = {}
    for reading in document["files"]:
        for sheet in reading["sheets"]:
            if sheet["number"] is not None:
                found[sheet["number"]["value"]] = sheet
    return found


def iou(a: list[float], b: tuple[float, float, float, float]) -> float:
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    area = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / area if area > 0 else 0.0


def view_at(
    sheet: dict[str, Any], region: tuple[float, float, float, float], kind: str
) -> dict[str, Any]:
    """The sheet's one view of `kind` whose box joins the region's expected box at IoU >= 0.8."""
    expected = drawing.expected_box(region)
    joined = [v for v in sheet["views"] if v["kind"] == kind and iou(v["box"], expected) >= MATCH]
    boxes = [(v["kind"], v["box"]) for v in sheet["views"]]
    assert len(joined) == 1, f"no single {kind} view at {expected} on paper mm; views: {boxes}"
    found: dict[str, Any] = joined[0]
    return found


def test_the_views_stage_runs_and_the_export_keeps_its_schema(export: dict[str, Any]) -> None:
    for reading in export["files"]:
        assert reading["stages"]["views"]["state"] == "ok", reading["stages"]["views"]
    assert validate(export, load_schema()) == []


@pytest.mark.parametrize("number", ["S-201", "S-202"])
def test_each_view_on_a_layout_sheet_has_its_box_on_paper_in_mm_its_title_and_its_kind(
    export: dict[str, Any], number: str
) -> None:
    sheet = sheets_by_number(export)[number]
    _, views = drawing.LAYOUT_SHEETS[number]
    for title, region, kind in views:
        assert view_at(sheet, region, kind)["title"] == title


def test_a_model_space_sheets_view_boxes_are_converted_to_paper_mm(export: dict[str, Any]) -> None:
    """S-203 is a frame in model space at 1:100: its views' boxes are on its paper, in mm, measured
    from the frame's lower-left corner, the same places as S-201's top row."""
    sheet = sheets_by_number(export)["S-203"]
    _, _, views = drawing.MODEL_SHEETS["S-203"]
    for title, region, kind in views:
        assert view_at(sheet, region, kind)["title"] == title


def test_a_view_drawn_without_a_title_has_a_null_title(export: dict[str, Any]) -> None:
    sheet = sheets_by_number(export)["S-204"]
    assert view_at(sheet, drawing.TOP_LEFT, "plan")["title"] is None


def test_each_plan_view_states_its_storeys_as_an_explicit_list(export: dict[str, Any]) -> None:
    sheets = sheets_by_number(export)
    assert view_at(sheets["S-201"], drawing.TOP_LEFT, "plan")["storeys"] == ["ground"]
    assert view_at(sheets["S-202"], drawing.TOP_RIGHT, "plan")["storeys"] == ["floor_1"]
    assert view_at(sheets["S-203"], drawing.TOP_LEFT, "plan")["storeys"] == ["floor_2"]


def test_typical_is_a_storey_in_a_plan_beside_a_floor_word(export: dict[str, Any]) -> None:
    """ "TYPICAL FLOOR BEAM LAYOUT PLAN": "typical" beside a floor word names the storey."""
    sheet = sheets_by_number(export)["S-202"]
    assert view_at(sheet, drawing.TOP_LEFT, "plan")["storeys"] == ["typical"]


def test_typical_on_a_section_or_detail_is_no_storey(export: dict[str, Any]) -> None:
    """ "TYPICAL BEAM SECTION" and "TYPICAL BEAM DETAIL": no floor or plan word beside "typical"."""
    sheets = sheets_by_number(export)
    assert view_at(sheets["S-202"], drawing.BOTTOM_LEFT, "section")["storeys"] == []
    assert view_at(sheets["S-201"], drawing.BOTTOM_RIGHT, "detail")["storeys"] == []


def test_beam_plans_share_a_subject_and_a_slab_plan_has_another(export: dict[str, Any]) -> None:
    """Each plan's subject (what it draws) is read from its title words: three beam layouts on three
    sheets share one subject; a slab layout's is a different one. The subject keys are the
    conventions' (view-default.json), not pinned here."""
    sheets = sheets_by_number(export)
    beams = [
        view_at(sheets["S-201"], drawing.TOP_LEFT, "plan")["subject"],
        view_at(sheets["S-202"], drawing.TOP_LEFT, "plan")["subject"],
        view_at(sheets["S-203"], drawing.TOP_LEFT, "plan")["subject"],
    ]
    slab = view_at(sheets["S-202"], drawing.TOP_RIGHT, "plan")["subject"]
    assert beams[0] is not None
    assert beams == [beams[0]] * 3
    assert slab is not None
    assert slab != beams[0]


@pytest.mark.parametrize("number", ["S-201", "S-203"])
def test_the_working_view_is_the_index_of_the_sheets_plan(export: dict[str, Any], number: str) -> None:
    """16 and 22 open a sheet fitted to its working view: on a sheet of one plan beside a section
    (and a schedule and a detail), the plan."""
    sheet = sheets_by_number(export)[number]
    assert "working_view" in sheet
    index = sheet["working_view"]
    assert isinstance(index, int)
    assert not isinstance(index, bool)
    assert 0 <= index < len(sheet["views"])
    assert sheet["views"][index] is view_at(sheet, drawing.TOP_LEFT, "plan")


def test_every_sheet_carries_a_working_view_index_or_null(export: dict[str, Any]) -> None:
    for sheet in sheets_by_number(export).values():
        index = sheet["working_view"]
        assert index is None or (
            isinstance(index, int) and not isinstance(index, bool) and 0 <= index < len(sheet["views"])
        )


def test_a_sheet_without_views_has_no_working_view(tmp_path: Path) -> None:
    """A sheet whose views were not read (the views stage not built) points at none."""
    folder = drawing.build_set(tmp_path / "set", _mkdir(tmp_path / "build"))
    unbuilt = harness.Stage("views", "engine.recognise.t17_no_such_module:find", "17")
    stages = [unbuilt if s.name == "views" else s for s in harness.STAGES]
    document: Any = harness.run(folder, tmp_path / "out" / "export.json", stages=stages)
    sheets = sheets_by_number(document)
    assert sheets
    assert all(s["views"] == [] and s["working_view"] is None for s in sheets.values())


def _mkdir(path: Path) -> Path:
    path.mkdir(parents=True)
    return path
