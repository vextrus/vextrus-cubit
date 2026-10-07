"""A view's box is on paper (mm from its sheet's lower-left corner), not in model space: the reader
places it on its model-space sheet's frame (engine/families/column/place.py), asks when it cannot, and
proposes no column without a mark. Synthetic, invented labels."""

import subprocess
from decimal import Decimal
from pathlib import Path

import pytest
from ezdxf.document import Drawing

from engine.families.column.recognise import recognise
from engine.families.types import ConfirmedFacts, ElementFacts, ProjectSetup, Recognised, ViewArtefact
from engine.fixtures import dwg
from engine.read import read
from engine.read.artefact import ReadArtefact
from engine.recognise.types import Box, ViewCandidate, ViewKind

pytestmark = pytest.mark.needs_toolchain

SCALE = 100.0
FRAME_AT = (100000.0, 0.0)


def _rect(doc: Drawing, x0: float, y0: float, x1: float, y1: float) -> None:
    doc.modelspace().add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True)


def _column(doc: Drawing, x: float, y: float, labels: tuple[str, ...]) -> None:
    _rect(doc, x - 150, y - 150, x + 150, y + 150)
    for row, text in enumerate(labels):
        doc.modelspace().add_text(text, dxfattribs={"height": 100}).set_placement(
            (x + 250, y + 100 - 150 * row)
        )


def _drawing() -> Drawing:
    doc = dwg.new_drawing()
    doc.header["$INSUNITS"] = 4
    ox, oy, s = FRAME_AT[0], FRAME_AT[1], SCALE
    _rect(doc, ox, oy, ox + 841 * s, oy + 594 * s)  # an A1 frame drawn at 1:100
    _rect(doc, ox + 600 * s, oy + 10 * s, ox + 831 * s, oy + 80 * s)
    for i, text in enumerate(("SHEET NO", "Q-101", "TITLE", "QX PLAN")):
        doc.modelspace().add_text(text, dxfattribs={"height": 3 * s}).set_placement(
            (ox + 610 * s, oy + (70 - 12 * i) * s)
        )
    # the view on paper (150, 150)-(450, 450) mm: model (115000, 15000)-(145000, 45000)
    _column(doc, 120000, 20000, ("C1", "300x300"))  # A/1
    _column(doc, 126000, 25000, ("C2", "300x300"))  # B/2
    _column(doc, 123000, 22500, ("Q.Z-3", "300x900"))  # a sized outline with no column mark
    _column(doc, 20000, 20000, ("C9", "300x300"))  # outside the frame: no view's
    return doc


@pytest.fixture(scope="module")
def artefact(tmp_path_factory: pytest.TempPathFactory) -> ReadArtefact:
    folder = tmp_path_factory.mktemp("column-place")
    writer = dwg.build_writer(folder)
    dxf, drawn = folder / "sheet.dxf", folder / "sheet.dwg"
    _drawing().saveas(dxf)
    subprocess.run(
        [str(dwg.dotnet()), str(writer), str(dxf), str(drawn), "AC1032"], check=True, timeout=120
    )
    return read(Path(drawn))


GRID = ConfirmedFacts(
    facts=tuple(
        ElementFacts(
            family="grid_line", element_id=m, mark=m, storey="", values={"axis": a, "offset": Decimal(o)}
        )
        for m, a, o in (("A", "y", "0"), ("B", "y", "6000"), ("1", "x", "0"), ("2", "x", "5000"))
    )
)


def _run(artefact: ReadArtefact, box: Box) -> Recognised:
    view = ViewCandidate(box=box, kind=ViewKind.PLAN)
    placed = ViewArtefact(view_id="V1", sheet_id="S1", artefact=artefact, view=view, storey="floor_1")
    return recognise([placed], GRID, ProjectSetup(), None)


def test_a_paper_box_on_a_model_space_sheet_reads_the_columns_it_holds(artefact: ReadArtefact) -> None:
    found = _run(artefact, Box(150.0, 150.0, 450.0, 450.0))

    assert sorted((c.mark, c.at[0]) for c in found.candidates) == [("C1", "A/1"), ("C2", "B/2")]


def test_a_sized_outline_without_a_column_mark_is_asked_not_proposed(artefact: ReadArtefact) -> None:
    found = _run(artefact, Box(150.0, 150.0, 450.0, 450.0))

    assert all(c.mark for c in found.candidates)
    assert [q.code for q in found.questions] == ["engine.column.mark_not_read"]


def test_a_view_no_sheet_places_is_asked(tmp_path: Path) -> None:
    doc = dwg.new_drawing()
    _column(doc, 0, 0, ("C1", "300x300"))
    writer = dwg.build_writer(tmp_path)
    doc.saveas(tmp_path / "bare.dxf")
    dxf, drawn = tmp_path / "bare.dxf", tmp_path / "bare.dwg"
    subprocess.run(
        [str(dwg.dotnet()), str(writer), str(dxf), str(drawn), "AC1032"], check=True, timeout=120
    )

    found = _run(read(tmp_path / "bare.dwg"), Box(150.0, 150.0, 450.0, 450.0))

    assert found.candidates == ()
    assert [q.code for q in found.questions] == ["engine.column.view_not_placed"]
