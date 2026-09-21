"""A paper layout's windows onto model space are inventoried, and the paper's own viewport is not
(L-CAD-05).

A VIEWPORT is not content — no source key, no place in a space's extents — but what it frames is
what a sheet shows, so each paper layout's inventory carries its windows as the drawing states
them. The layout's own viewport (the paper seen at 1:1) is left out by the handle its LAYOUT
names, and, where a converter dropped that reference, by its shape: LibreDWG's `dwg2dxf` flattens
every viewport's id to 1, so an id tells the windows of a converted drawing apart from nothing.
"""

from __future__ import annotations

import ezdxf
import pytest

from corpus import drawing_path
from vextrus_cad import ingest_dxf, parse_entity_graph
from vextrus_cad.ingest import ingest_document
from vextrus_cad.model import EntityGraphError


def _paper(document: ezdxf.document.Drawing, name: str, *, titled: bool = True):
    """A paper layout with its own viewport kept and, unless asked otherwise, one title on it —
    a sheet with nothing drawn is dropped as inventory, windows or no windows."""
    layout = document.layouts.new(name)
    layout.page_setup(size=(841, 594), margins=(0, 0, 0, 0), units="mm")
    if titled:
        layout.add_text(name, dxfattribs={"height": 5}).set_placement((20, 20))
    return layout


def _layouts(artifact: dict) -> dict[str, dict]:
    return {layout["name"]: layout for layout in artifact["layouts"]}


def test_the_committed_fixture_inventories_its_windows_and_not_the_papers_own_viewport() -> None:
    artifact = ingest_dxf(drawing_path("viewports"))
    parse_entity_graph(artifact)
    layouts = _layouts(artifact)
    assert layouts["model"]["viewports"] == []
    windows = layouts["SHEET"]["viewports"]
    assert [(w["on"], w["twist"], w["size"], w["view_height"]) for w in windows] == [
        (True, 0.0, [400.0, 200.0], 10000.0),
        (False, 0.0, [200.0, 100.0], 5000.0),
        (True, 30.0, [200.0, 100.0], 10000.0),
    ]
    assert windows[0]["centre"] == [250.0, 350.0] and windows[0]["view_centre"] == [10000.0, 5000.0]
    assert all(w["clipped"] is False for w in windows)
    assert all(w["handle"] == w["handle"].upper() for w in windows)
    assert "VIEWPORT" not in {entity["type"] for entity in artifact["entities"]}, "a window is not content"


def test_the_papers_own_viewport_is_known_by_its_shape_where_the_layout_names_none() -> None:
    """What a converter leaves behind: the reference dropped, every id flattened to 1."""
    document = ezdxf.new("R2004", setup=True)
    document.modelspace().add_line((0, 0), (1000, 0))
    sheet = _paper(document, "SHEET")
    window = sheet.add_viewport(
        center=(200, 150), size=(300, 200), view_center_point=(500, 0), view_height=2000
    )
    window.dxf.status = 2
    sheet.dxf_layout.dxf.discard("viewport_handle")
    for viewport in sheet.query("VIEWPORT"):
        viewport.dxf.id = 1
        viewport.dxf.status = 1
    windows = _layouts(ingest_document(document))["SHEET"]["viewports"]
    assert [w["handle"] for w in windows] == [str(window.dxf.handle).upper()]
    assert windows[0]["on"] is True


def test_a_window_of_no_height_frames_nothing() -> None:
    document = ezdxf.new("R2004", setup=True)
    document.modelspace().add_line((0, 0), (1000, 0))
    sheet = _paper(document, "SHEET")
    sheet.add_viewport(center=(200, 150), size=(300, 200), view_center_point=(500, 0), view_height=0)
    assert _layouts(ingest_document(document))["SHEET"]["viewports"] == []


def test_a_layout_with_no_paper_content_is_still_dropped_whatever_it_frames() -> None:
    """Inventory is not content: a sheet of windows and nothing drawn is still an empty sheet."""
    document = ezdxf.new("R2004", setup=True)
    document.modelspace().add_line((0, 0), (1000, 0))
    sheet = _paper(document, "EMPTY", titled=False)
    sheet.add_viewport(center=(200, 150), size=(300, 200), view_center_point=(500, 0), view_height=2000)
    artifact = ingest_document(document)
    assert "EMPTY" in artifact["dropped_layouts"]


def _with_windows(artifact: dict, change: dict) -> dict:
    """The artifact with every window's record changed the same way."""
    layouts = [
        {**layout, "viewports": [{**window, **change} for window in layout["viewports"]]}
        for layout in artifact["layouts"]
    ]
    return {**artifact, "layouts": layouts}


def test_the_mirror_admits_an_artifact_without_the_key_and_refuses_a_malformed_window() -> None:
    artifact = ingest_dxf(drawing_path("viewports"))
    older = [{k: v for k, v in layout.items() if k != "viewports"} for layout in artifact["layouts"]]
    parse_entity_graph({**artifact, "layouts": older})

    with pytest.raises(EntityGraphError, match="view_height"):
        parse_entity_graph(_with_windows(artifact, {"view_height": 0}))

    with pytest.raises(EntityGraphError, match="scale"):
        parse_entity_graph(_with_windows(artifact, {"scale": 0.02}))
