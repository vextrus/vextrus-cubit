"""A dimension the conversion carries with no picture is drawn from its definition, never lost
(L-CAD-03, L-CAD-04, L-CAD-09).

LibreDWG 0.13's `dxf2dwg` writes a DIMENSION's definition and leaves its picture reference empty, so
`dwg2dxf` hands the lane dimensions naming no picture, and the extractor's recover-mode audit removed
every one of them — F-RCC6-BNBC's DWG reached the artifact with none of its 125 dimensions and a
fresh upload of it proposed no scale on any view (session 8's walk-0). The pure tests pin the pass
on documents built in memory; the breaker mints a DWG with the real toolchain and proves the
dimensions reach the artifact with their measurement text and definition points. Nothing here
writes inside the checkout.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import ezdxf
import pytest
from ezdxf.entities.dimstyleoverride import DimStyleOverride

from vextrus_cad import report
from vextrus_cad.cli import main
from vextrus_cad.dwg import (
    SHORTFALL,
    DrawnDimensions,
    carries_picture,
    convert_dwg,
    draw_missing_pictures,
    geometry_tally,
    reconcile,
)

#: The layer AutoCAD reserves for a dimension's definition points, as the renderer draws them.
DEFPOINTS = "DEFPOINTS"

#: What the draughtsman typed over two of the dimensions below, as a Dhaka plan prints a bay.
TYPED = "15'-0\""


def _dimensioned(*, pictures: bool = True) -> Any:
    """A document holding three dimensions with their pictures, as a CAD program writes them — or,
    with `pictures=False`, the same three definitions naming no picture at all.

    One states its own measurement (`<>`), one carries a text the draughtsman typed, and one is
    vertical — the three shapes a plan's dimensions come in. The vertical one reads horizontally
    (`dimtih`), as F-RCC6-BNBC's do: LibreDWG's importer refuses a rotated MTEXT inside a picture
    ("Invalid DXF code 50 for MTEXT"), and the breaker below mints through it.
    """
    document = ezdxf.new("R2000", setup=True)
    space = document.modelspace()
    space.add_line((0, 0), (4572, 0))
    discard = not pictures
    space.add_linear_dim(base=(0, -600), p1=(0, 0), p2=(4572, 0)).render(discard=discard)
    space.add_linear_dim(base=(0, -1200), p1=(0, 0), p2=(4572, 0), text=TYPED).render(discard=discard)
    space.add_linear_dim(base=(-600, 0), p1=(0, 0), p2=(0, 3048), angle=90, override={"dimtih": 1}).render(
        discard=discard
    )
    return document


def _stripped(document: Any) -> Any:
    """The same document as LibreDWG's writer leaves it: every dimension naming no picture."""
    for dimension in document.modelspace().query("DIMENSION"):
        picture = dimension.dxf.geometry
        dimension.dxf.discard("geometry")
        document.blocks.delete_block(picture, safe=False)
    return document


def _texts(document: Any, dimension: Any) -> list[str]:
    block = document.blocks.get(dimension.dxf.geometry)
    return [entity.text for entity in block if entity.dxftype() == "MTEXT"]


def _definition_points(document: Any, dimension: Any) -> int:
    block = document.blocks.get(dimension.dxf.geometry)
    return sum(1 for entity in block if entity.dxftype() == "POINT" and entity.dxf.layer.upper() == DEFPOINTS)


# --- pure: what the pass does to a document -------------------------------------------------------


def test_a_dimension_with_no_picture_has_its_picture_drawn_from_its_own_definition() -> None:
    written = _dimensioned()
    said = [_texts(written, dimension) for dimension in written.modelspace().query("DIMENSION")]

    document = _stripped(_dimensioned())
    dimensions = list(document.modelspace().query("DIMENSION"))
    assert not any(carries_picture(dimension, document) for dimension in dimensions)

    drawn = draw_missing_pictures(document)
    assert (drawn.drawn, drawn.undrawn) == (3, 0)
    assert all(carries_picture(dimension, document) for dimension in dimensions)
    assert [_texts(document, dimension) for dimension in dimensions] == said, (
        "a picture drawn from the definition says what the picture the CAD program drew said"
    )
    assert [_texts(document, dimension) for dimension in dimensions][1] == [TYPED], (
        "a typed text renders as typed"
    )
    assert all(_definition_points(document, dimension) >= 2 for dimension in dimensions), (
        "the definition points travel in the picture — they are what rank 3 measures between (I-295b)"
    )


def test_a_document_whose_dimensions_carry_pictures_is_not_touched() -> None:
    document = _dimensioned()
    blocks = [block.name for block in document.blocks]
    assert draw_missing_pictures(document) == DrawnDimensions(drawn=0, undrawn=0)
    assert [block.name for block in document.blocks] == blocks, "nothing was drawn, so no block was added"


def test_a_dimension_the_renderer_cannot_draw_is_left_as_it_came(monkeypatch: pytest.MonkeyPatch) -> None:
    document = _stripped(_dimensioned())
    blocks = [block.name for block in document.blocks]

    def _half_drawn(self: DimStyleOverride, *_: Any, **__: Any) -> None:
        # The renderer names the new picture on the dimension before it draws into it; this one
        # fails right after, which is the worst place a render can fail.
        block = self.doc.blocks.new_anonymous_block(type_char="D")
        self.dimension.dxf.geometry = block.name
        raise ValueError("a definition this renderer cannot draw")

    monkeypatch.setattr(DimStyleOverride, "render", _half_drawn)
    drawn = draw_missing_pictures(document)
    assert (drawn.drawn, drawn.undrawn) == (0, 3)
    for dimension in document.modelspace().query("DIMENSION"):
        assert not carries_picture(dimension, document), "no half picture is left for the audit to keep"
        assert dimension.dxf.get("geometry", None) is None
    assert [block.name for block in document.blocks] == blocks, "the half-drawn pictures were taken away"


def test_the_tally_counts_a_dimension_with_no_picture_as_not_carried(tmp_path: Path) -> None:
    """The recover-mode open removes such a dimension, so counting it as carried was the silent loss."""
    whole = tmp_path / "whole.dxf"
    _dimensioned().saveas(str(whole))
    stripped = tmp_path / "stripped.dxf"
    _stripped(_dimensioned()).saveas(str(stripped))

    assert geometry_tally(whole)["model"]["DIMENSION"] == 3
    assert "DIMENSION" not in geometry_tally(stripped)["model"]
    census = {"model": {"DIMENSION": 3, "LINE": 1}}
    (refused,) = reconcile(census, geometry_tally(stripped))
    assert (refused.space, refused.dxftype, refused.reason, refused.lost) == (
        "model",
        "DIMENSION",
        SHORTFALL,
        3,
    ), "a dimension the lane could not give a picture is a named shortfall, never a clean run"


# --- breaker: the real toolchain, a minted drawing ----------------------------------------------


def _minted(tmp_path: Path) -> Path:
    """A DWG whose dimensions name no picture, minted with LibreDWG's own dxf2dwg.

    Minted from definitions that carry none, rather than from pictures its writer then unlinks: handed
    pictures, 0.13's `dwg2dxf` writes each one twice — once in BLOCKS and again inline after its
    dimension in ENTITIES — and the extractor refuses that conversion by name for its repeated
    handles (HANDLES_NOT_UNIQUE) before and after this pass alike, which is a different fault from
    the one proven here.
    """
    if shutil.which("dxf2dwg") is None:
        pytest.skip("dxf2dwg is not on PATH; checkup's libredwg probe owns that")
    dxf = tmp_path / "dimensioned.dxf"
    _dimensioned(pictures=False).saveas(str(dxf))
    dwg = tmp_path / "dimensioned.dwg"
    subprocess.run(["dxf2dwg", "-y", "-o", str(dwg), str(dxf)], check=False, capture_output=True)
    assert dwg.is_file() and dwg.read_bytes()[:4] == b"AC10", "dxf2dwg minted no DWG"
    return dwg


def test_the_minted_dimensions_reach_the_artifact_with_their_text_and_points(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    dwg = _minted(tmp_path)
    conversion = convert_dwg(dwg, tmp_path / "out")
    assert conversion.drawn_dimensions == 3, (
        "this toolchain wrote the dimensions' pictures; the breaker no longer breaks"
    )
    assert conversion.refused == (), [entry.message() for entry in conversion.refused]

    out = tmp_path / "dimensioned.entitygraph.json"
    assert main(["ingest", str(dwg), "--out", str(out)]) == 0
    graph = json.loads(out.read_text(encoding="utf-8"))
    dimensions = [entity["key"] for entity in graph["entities"] if entity["type"] == "DIMENSION"]
    assert len(dimensions) == 3, "every dimension of the drawing is an original of the artifact"
    for key in dimensions:
        paint = [record for record in graph["derived"] if record["src"] == key]
        texts = [record["text"] for record in paint if isinstance(record.get("text"), str)]
        points = [
            record for record in paint if record["type"] == "POINT" and record["layer"].upper() == DEFPOINTS
        ]
        assert len(texts) == 1, f"{key} carries its one measurement text: {texts}"
        assert len(points) >= 2, f"{key} carries the definition points it measures between"
    # The typed text renders as typed. The measured ones render what the DWG defines: dxf2dwg files a
    # vertical dimension's rotation (group 50) as its oblique angle, so the minted drawing itself
    # states that one measures along x — the lane draws the definition it was given, and invents none.
    assert TYPED in {record.get("text") for record in graph["derived"]}

    said = capsys.readouterr().err
    assert (
        f"{report.NOTE_PREFIX}{report.DREW_DIMENSION_PICTURES}: 3 dimensions carried no picture, and each"
        " was drawn from its own definition" in said
    ), "a drawn picture is a named repair (L-CAD-09)"
