"""The paint an original carries, and the originals that carry it (L-CAD-03).

A block reference paints its block and a dimension paints its rendered geometry — its measurement
text among it. Both stay originals in `entities`; what they paint lands in `derived`, naming them.
The drawings here are built rather than committed: the fixture corpus is the roster the artifact
contract names, and these are questions about types that corpus does not happen to hold.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import ezdxf

from vextrus_cad.ingest import ingest_dxf


def _ingested(doc: Any, tmp_path: Path) -> dict[str, Any]:
    drawing = tmp_path / "drawing.dxf"
    doc.saveas(drawing)
    return ingest_dxf(drawing)


def test_a_dimensions_measurement_text_is_a_derived_text_entity(tmp_path: Path) -> None:
    doc = ezdxf.new("R2000", setup=True)
    doc.modelspace().add_linear_dim(base=(0, 5), p1=(0, 0), p2=(10, 0)).render()

    artifact = _ingested(doc, tmp_path)

    originals = artifact["entities"]
    assert [original["type"] for original in originals] == ["DIMENSION"]
    key = originals[0]["key"]

    texts = [paint for paint in artifact["derived"] if paint["type"] in {"TEXT", "MTEXT"}]
    assert len(texts) == 1
    assert texts[0]["src"] == key
    assert texts[0]["text"] != ""
    assert texts[0]["height"] > 0

    # The dimension's own geometry is paint too, and none of it is an original (L-CAD-03).
    assert len(artifact["derived"]) > len(texts)
    for paint in artifact["derived"]:
        assert paint["src"] == key
        assert "key" not in paint


def test_an_entity_whose_type_has_no_insertion_point_is_read_without_refusal(
    tmp_path: Path,
) -> None:
    # `insert` and `location` are different types' names for the same idea, and asking a type for
    # the name it does not have raises rather than answering nothing.
    doc = ezdxf.new("R2000")
    modelspace = doc.modelspace()
    modelspace.add_point((1, 1))
    modelspace.add_ray((0, 0), (1, 1))
    modelspace.add_xline((0, 0), (0, 1))

    artifact = _ingested(doc, tmp_path)

    assert [original["type"] for original in artifact["entities"]] == ["POINT", "RAY", "XLINE"]
    assert artifact["layouts"][0]["bbox"] == {"max": [1.0, 1.0], "min": [1.0, 1.0]}


def test_an_elliptical_arc_is_open_and_a_whole_ellipse_closes(tmp_path: Path) -> None:
    doc = ezdxf.new("R2000")
    modelspace = doc.modelspace()
    modelspace.add_ellipse((0, 0), major_axis=(2, 0), ratio=0.5)
    modelspace.add_ellipse((10, 0), major_axis=(2, 0), ratio=0.5, start_param=0.0, end_param=1.0)

    whole, arc = _ingested(doc, tmp_path)["entities"]

    assert whole["closed"] is True
    assert whole["area"] > 0
    assert arc["closed"] is False
    assert "area" not in arc
