"""The paint an original carries, and the originals that carry it (L-CAD-03).

A block reference paints its block and a dimension paints its rendered geometry — its measurement
text among it. Both stay originals in `entities`; what they paint lands in `derived`, naming them.
The drawings here are built rather than committed: the fixture corpus is the roster the artifact
contract names, and these are questions about types that corpus does not happen to hold.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import ezdxf
import pytest

from vextrus_cad import ingest as ingest_module
from vextrus_cad.ingest import ingest_dxf
from vextrus_cad.parameters import EXPLODE_DEPTH_CAP


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


def _nested_block_tree(branch: int, depth: int) -> Any:
    """A drawing whose model space holds one instance of a `depth`-level, `branch`-way block tree."""
    doc = ezdxf.new("R2000")
    leaf = doc.blocks.new("L0")
    leaf.add_line((0, 0), (1, 0))
    leaf.add_attdef("TAG", (0, 0), text="")
    for level in range(1, depth + 1):
        block = doc.blocks.new(f"L{level}")
        # Every level defines the attribute its own instances fill in, so each instance the walk
        # enters — and each one it refuses — carries one.
        block.add_attdef("TAG", (0, 0), text="")
        for index in range(branch):
            reference = block.add_blockref(f"L{level - 1}", (index * 2, 0))
            reference.add_auto_attribs({"TAG": f"L{level}-{index}"})
    doc.modelspace().add_blockref(f"L{depth}", (0, 0)).add_auto_attribs({"TAG": "root"})
    return doc


def test_an_instance_past_the_depth_cap_contributes_neither_paint_nor_attributes(
    tmp_path: Path,
) -> None:
    # L-CAD-03 keeps attributes separate, and a cap that trips has to say what it lost consistently:
    # an instance the extractor never enters cannot have its ATTRIBs turn up in the artifact while
    # the counters record its geometry as lost.
    artifact = _ingested(_nested_block_tree(1, EXPLODE_DEPTH_CAP + 2), tmp_path)

    counters = artifact["counters"][0]
    assert counters["explode_truncated"] is True
    assert counters["explode_losses"] == {"INSERT": 1}
    # One instance per level the cap admits — the original plus every nested one entered — and none
    # for the level the cap refused or anything below it.
    assert len(artifact["block_attributes"]) == EXPLODE_DEPTH_CAP
    assert [attribute["src"] for attribute in artifact["block_attributes"]] == [
        artifact["entities"][0]["key"]
    ] * EXPLODE_DEPTH_CAP


def test_the_derived_budget_bounds_the_walk_not_merely_the_mint(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The depth cap alone leaves a few kilobytes of lawful drawing costing branch^cap expansions,
    # because everything below the cap is counted as a loss rather than minted. The budget is what
    # stops the extractor *working*, so it is charged per expansion, not per derived entity — and a
    # walk that stops still says it was truncated (L-CAD-03, R-TO-001).
    budget = 64
    monkeypatch.setattr(ingest_module, "DERIVED_ENTITY_BUDGET", budget)
    artifact = _ingested(_nested_block_tree(4, EXPLODE_DEPTH_CAP + 2), tmp_path)

    counters = artifact["counters"][0]
    assert counters["explode_truncated"] is True
    assert len(artifact["derived"]) <= budget
    # The whole tree is 4^8 instances; a walk held to the budget touches a small fraction of it.
    expansions = len(artifact["derived"]) + sum(counters["explode_losses"].values())
    assert expansions < 4**EXPLODE_DEPTH_CAP


def test_a_spent_budget_counts_lost_paint_and_not_structural_records(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Once the budget is spent every skipped virtual is counted as paint the artifact does not
    # carry — but a SEQEND or a VERTEX would never have become a derived entity in the first place
    # (L-CAD-03), so counting them would inflate the fidelity counters with structure.
    monkeypatch.setattr(ingest_module, "DERIVED_ENTITY_BUDGET", 0)
    space = ingest_module._Space(name="model", kind="model")
    extractor = ingest_module._Extractor(ezdxf.new("R2000"))
    extractor.explode(
        _StructuralPaint(("LINE", "SEQEND", "VERTEX", "ATTRIB", "VIEWPORT", "INSERT")),
        "DXF_HANDLE:1",
        space,
        (0, 0, 0),
        1,
    )

    assert space.counters.explode_truncated is True
    assert space.counters.explode_losses == {"INSERT": 1, "LINE": 1}
    assert space.derived == []
    assert space.attributes == []


@dataclass(frozen=True)
class _StructuralPaint:
    """An instance whose explosion yields the structural records ezdxf's own drawings rarely do.

    The budget's skip branch is the one place the extractor judges a virtual entity by type without
    building a record for it, so the types it must not count are staged here directly.
    """

    types: tuple[str, ...]

    def virtual_entities(self) -> Any:
        return (_TypeOnly(dxftype) for dxftype in self.types)


@dataclass(frozen=True)
class _TypeOnly:
    """A virtual entity a spent budget never looks past the type of."""

    type_name: str

    def dxftype(self) -> str:
        return self.type_name


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
