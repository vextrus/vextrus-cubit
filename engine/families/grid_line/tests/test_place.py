"""Where a view is in model space (place.py): the cases that need no drawing file."""

from types import SimpleNamespace
from typing import Any

import pytest

from engine.families.grid_line.place import Unplaced, model_box
from engine.read.anchor import DwgAnchor
from engine.recognise.types import Box, ViewCandidate, ViewKind

SHA = "0" * 64


def artefact() -> Any:
    summary = SimpleNamespace(source_sha256=SHA, reader="libredwg", reader_version="0.14")
    return SimpleNamespace(summary=summary, entities={}, blocks={})


def holder(view: ViewCandidate | None) -> Any:
    return SimpleNamespace(view=view)


def test_a_whole_drawing_has_no_box() -> None:
    assert model_box(artefact(), holder(None)) is None


def test_a_view_with_no_sheet_anchor_is_in_drawing_units_already() -> None:
    view = ViewCandidate(box=Box(1.0, 2.0, 3.0, 4.0), kind=ViewKind.PLAN)

    assert model_box(artefact(), holder(view)) == (1.0, 2.0, 3.0, 4.0)


@pytest.mark.parametrize("sheet", ["model/1A2B", "a layout the file does not hold"])
def test_a_view_whose_sheet_cannot_be_found_is_unplaced(sheet: str) -> None:
    anchor = DwgAnchor(SHA, "libredwg", "0.14", sheet, (), "3C")
    view = ViewCandidate(box=Box(1.0, 2.0, 3.0, 4.0), kind=ViewKind.PLAN, anchors=(anchor,))

    with pytest.raises(Unplaced):
        model_box(artefact(), holder(view))
