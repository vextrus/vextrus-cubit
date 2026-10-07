"""The column reader's rules beyond the acceptance plan (engine/families/column/recognise.py).

One synthetic millimetre plan, drawn with ezdxf and written to DWG by the repo's writer in the test's
temporary folder; every layer name is invented and names nothing.
"""

import subprocess
from decimal import Decimal
from pathlib import Path
from typing import Any, cast

import pytest
from ezdxf.document import Drawing

from engine.families.column.recognise import recognise
from engine.families.types import (
    ConfirmedFacts,
    ElementCandidate,
    ElementFacts,
    ProfileParts,
    ProjectSetup,
    Recognised,
    ViewArtefact,
)
from engine.fixtures import dwg
from engine.read import read
from engine.read.artefact import ReadArtefact

pytestmark = pytest.mark.needs_toolchain

LINES, TEXTS, OTHER = "QZ-1", "QZ-2", "QZ-3"


def _rect(doc: Drawing, centre: tuple[float, float], b: float, d: float, layer: str) -> None:
    x, y = centre
    corners = [
        (x - b / 2, y - d / 2),
        (x + b / 2, y - d / 2),
        (x + b / 2, y + d / 2),
        (x - b / 2, y + d / 2),
    ]
    doc.modelspace().add_lwpolyline(corners, close=True, dxfattribs={"layer": layer})


def _text(doc: Drawing, at: tuple[float, float], text: str) -> None:
    doc.modelspace().add_text(text, dxfattribs={"layer": TEXTS, "height": 100}).set_placement(at)


def _plan() -> Drawing:
    doc = dwg.new_drawing()
    doc.header["$INSUNITS"] = 4
    for name in (LINES, TEXTS, OTHER):
        doc.layers.add(name)
    _rect(doc, (0, 0), 300, 600, LINES)  # A/1, one text holding mark and size
    _text(doc, (300, 200), "C4 300x600")
    _rect(doc, (6000, 0), 300, 300, OTHER)  # B/1, on another layer
    _text(doc, (6300, 100), "C5")
    _text(doc, (6300, -100), "12x12")  # bare: 12 mm misses a 300 outline, 12 inches fits it
    _rect(doc, (6000, 5000), 400, 400, LINES)  # B/2, no label at all: a drawn rectangle
    _rect(doc, (3000, 2500), 7000, 6000, LINES)  # bigger than a bay: a frame, not a column
    _text(doc, (6700, 5800), "F9")  # beside the frame's corner, far from every column
    block = doc.blocks.new("QZ-B")
    block.add_lwpolyline(
        [(-150, -150), (150, -150), (150, 150), (-150, 150)], close=True, dxfattribs={"layer": LINES}
    )
    for at, mark in (((0, 5000), "C6"), ((12000, 5000), "C7")):  # A/2 and past B/2
        doc.modelspace().add_blockref("QZ-B", at, dxfattribs={"layer": LINES})
        _text(doc, (at[0] + 250, at[1] + 100), mark)
        _text(doc, (at[0] + 250, at[1] - 100), "300x300")
    return doc


@pytest.fixture(scope="module")
def artefact(tmp_path_factory: pytest.TempPathFactory) -> ReadArtefact:
    folder = tmp_path_factory.mktemp("column-rules")
    writer = dwg.build_writer(folder)
    dxf, drawn = folder / "plan.dxf", folder / "plan.dwg"
    _plan().saveas(dxf)
    subprocess.run(
        [str(dwg.dotnet()), str(writer), str(dxf), str(drawn), "AC1032"], check=True, timeout=120
    )
    return read(Path(drawn))


def _grid() -> ConfirmedFacts:
    def line(mark: str, axis: str, offset: str) -> ElementFacts:
        return ElementFacts(
            family="grid_line",
            element_id=mark,
            mark=mark,
            storey="",
            values={"axis": axis, "offset": Decimal(offset)},
        )

    return ConfirmedFacts(
        facts=(line("A", "y", "0"), line("B", "y", "6000"), line("1", "x", "0"), line("2", "x", "5000"))
    )


def _run(
    artefact: ReadArtefact, profile: object = None, storey: str | None = "floor_1", view: Any = None
) -> Recognised:
    views = [ViewArtefact(view_id="V1", sheet_id="S1", artefact=artefact, view=view, storey=storey)]
    return recognise(views, _grid(), ProjectSetup(), cast(ProfileParts | None, profile))


def _marks(found: Recognised) -> list[str]:
    return sorted(c.mark for c in found.candidates)


def _by_mark(found: Recognised, mark: str) -> ElementCandidate:
    [candidate] = [c for c in found.candidates if c.mark == mark]
    return candidate


def test_only_labelled_outlines_smaller_than_a_bay_are_columns(artefact: ReadArtefact) -> None:
    assert _marks(_run(artefact)) == ["C4", "C5", "C6", "C7"]


def test_one_text_may_hold_the_mark_and_the_size(artefact: ReadArtefact) -> None:
    c4 = _by_mark(_run(artefact), "C4")

    assert (c4.values["section_b"].value, c4.values["section_d"].value) == (Decimal(300), Decimal(600))
    assert c4.at[0] == "A/1"


def test_a_bare_label_far_from_its_outline_in_mm_is_read_in_inches(artefact: ReadArtefact) -> None:
    c5 = _by_mark(_run(artefact), "C5")

    assert c5.values["section_b"].value == Decimal("304.8")
    assert c5.values["section_b"].text == "12x12"


def test_the_profiles_layers_limit_the_outlines(artefact: ReadArtefact) -> None:
    profile = {"families": {"column": {"layers": [LINES]}}}

    assert _marks(_run(artefact, profile)) == ["C4", "C6", "C7"]


def test_the_profiles_label_patterns_name_the_mark(artefact: ReadArtefact) -> None:
    profile = {"families": {"column": {"label_patterns": [r"(?P<mark>C\d+)"]}}}

    assert _marks(_run(artefact, profile)) == ["C4", "C5", "C6", "C7"]


def test_a_view_of_several_storeys_gives_one_candidate_per_storey_with_its_band(
    artefact: ReadArtefact,
) -> None:
    class View:
        box = None
        storeys = ("floor_1", "floor_2", "floor_3")

    found = _run(artefact, storey=None, view=View())

    c4s = [c for c in found.candidates if c.mark == "C4"]
    assert sorted(c.storey for c in c4s) == ["floor_1", "floor_2", "floor_3"]
    assert {c.band for c in c4s} == {("floor_1", "floor_3")}
    assert len({c.candidate_key for c in c4s}) == 3


def test_a_view_window_keeps_what_lies_inside_it(artefact: ReadArtefact) -> None:
    class Box:
        x0, y0, x1, y1 = -1000.0, -1000.0, 1000.0, 1000.0

    class View:
        box = Box()
        storeys = ()

    assert _marks(_run(artefact, view=View())) == ["C4"]


def test_a_rerun_gives_the_same_candidate_keys(artefact: ReadArtefact) -> None:
    first = {c.candidate_key for c in _run(artefact).candidates}

    assert first == {c.candidate_key for c in _run(artefact).candidates}


def test_without_a_grid_a_column_has_no_grid_ref(artefact: ReadArtefact) -> None:
    views = [ViewArtefact(view_id="V1", sheet_id="S1", artefact=artefact, storey="floor_1")]

    found = recognise(views, ConfirmedFacts(facts=()), ProjectSetup(), None)

    assert {c.at[0] for c in found.candidates} == {""}


def test_a_column_block_inserted_twice_is_two_columns_with_their_own_labels(
    artefact: ReadArtefact,
) -> None:
    found = _run(artefact)
    c6, c7 = _by_mark(found, "C6"), _by_mark(found, "C7")

    assert (c6.at[0], c7.at[0]) == ("A/2", "B/2")
    assert c7.at[1] == Decimal(6000)
    assert c6.anchors["outline"][0].inserts != c7.anchors["outline"][0].inserts
    assert c6.values["section_b"].value == Decimal(300)


@pytest.fixture(scope="module")
def shifted(tmp_path_factory: pytest.TempPathFactory) -> ReadArtefact:
    """Three columns on A/1, B/1 and B/2, the plan drawn 40000 right and 3000 up in model space."""
    doc = dwg.new_drawing()
    doc.header["$INSUNITS"] = 4
    for name in (LINES, TEXTS):
        doc.layers.add(name)
    ox, oy = 40000.0, 3000.0
    for (x, y), mark in (((0, 0), "C1"), ((6000, 0), "C2"), ((6100, 4950), "C3")):
        _rect(doc, (ox + x, oy + y), 300, 300, LINES)
        _text(doc, (ox + x + 250, oy + y + 100), mark)
        _text(doc, (ox + x + 250, oy + y - 100), "300x300")
    folder = tmp_path_factory.mktemp("column-shifted")
    writer = dwg.build_writer(folder)
    dxf, drawn = folder / "plan.dxf", folder / "plan.dwg"
    doc.saveas(dxf)
    subprocess.run(
        [str(dwg.dotnet()), str(writer), str(dxf), str(drawn), "AC1032"], check=True, timeout=120
    )
    return read(Path(drawn))


def test_a_plan_drawn_away_from_the_grids_frame_still_takes_its_grid_refs(
    shifted: ReadArtefact,
) -> None:
    found = _run(shifted)

    refs = {c.mark: (c.at[0], c.at[1], c.at[2]) for c in found.candidates}
    assert refs["C1"] == ("A/1", Decimal(0), Decimal(0))
    assert refs["C2"] == ("B/1", Decimal(0), Decimal(0))
    assert refs["C3"] == ("B/2", Decimal(100), Decimal(-50))
