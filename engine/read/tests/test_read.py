"""`engine.read.read(path) -> ReadArtefact`: the stage the harness calls, on synthetic DWGs.

The fixtures (engine/fixtures/dwg/) prove mechanics only, never a reading; the reader is measured on
real drawings by the real-drawing check (ADR 0030). The DWG tests need LibreDWG, the .NET SDK (the
fixture writer) and bubblewrap, or `VEXTRUS_SANDBOX=off` on a machine without it:
    uv run --no-sync pytest -m "needs_toolchain or needs_bwrap" engine/read
"""

import hashlib
import json
import math
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from ezdxf.filemanagement import readfile

from engine.read import ReadError, read
from engine.read.anchor import DwgAnchor, anchor_from_json
from engine.read.artefact import Entity, Insert, ReadArtefact, Text
from engine.read.libredwg import prefix

ROOT = Path(__file__).resolve().parents[3]
Fixture = Callable[[str], Path]


# -- everywhere -------------------------------------------------------------------------------------


def test_a_pdf_is_not_read_here(tmp_path: Path) -> None:
    pdf = tmp_path / "plot.pdf"
    pdf.write_bytes(b"%PDF-1.7\n%...")

    with pytest.raises(ReadError) as raised:
        read(pdf)

    assert raised.value.message == {
        "code": "engine.read.unsupported_format",
        "params": {"format": "pdf"},
    }


def test_a_file_that_is_no_drawing_is_refused(tmp_path: Path) -> None:
    other = tmp_path / "notes.txt"
    other.write_bytes(b"not a drawing")

    with pytest.raises(ReadError) as raised:
        read(other)

    assert raised.value.message["params"] == {"format": "unknown"}


# -- on synthetic DWGs: needs the toolchain ---------------------------------------------------------


def texts(artefact: ReadArtefact) -> dict[str, Text]:
    return {e.text: e for e in artefact.entities.values() if isinstance(e, Text) and e.text}


def of_type(artefact: ReadArtefact, kind: str) -> list[Entity]:
    return [e for e in artefact.entities.values() if isinstance(e, Entity) and e.type == kind]


@pytest.mark.needs_toolchain
def test_the_summary_names_the_file_the_reader_and_the_format(dwg_fixture: Fixture) -> None:
    path = dwg_fixture("sheet_layout")

    summary = read(path, source_name="S-01 R0.dwg").summary

    assert summary.source_sha256 == hashlib.sha256(path.read_bytes()).hexdigest()
    assert summary.source_name == "S-01 R0.dwg"
    assert (summary.format.kind, summary.format.version) == ("dwg", "AC1032")
    pinned = (ROOT / "toolchain" / "libredwg.version").read_text().strip()
    assert (summary.reader, summary.reader_version) == ("libredwg", pinned)
    assert summary.insunits == 4
    assert summary.layouts == ("Model", "Layout1", "Sheet A")


@pytest.mark.needs_toolchain
def test_the_counts_are_what_the_generator_drew(dwg_fixture: Fixture) -> None:
    summary = read(dwg_fixture("sheet_layout")).summary

    assert summary.entity_counts == {
        "ARC": 1, "CIRCLE": 1, "HATCH": 1, "LINE": 4, "LWPOLYLINE": 1, "SPLINE": 1,
    }  # fmt: skip
    assert summary.layer_counts == {"COLUMN": 2, "GRID": 4, "HATCH": 1, "WALL": 2}
    assert summary.notes == ()


@pytest.mark.needs_toolchain
def test_geometry_comes_from_the_dxf_by_handle(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("sheet_layout"))

    lines = of_type(artefact, "LINE")
    walls = sorted((e.values["start"], e.values["end"]) for e in lines if e.layer == "WALL")
    assert walls == [([0.0, 0.0, 0.0], [0.0, 4000.0, 0.0]), ([0.0, 0.0, 0.0], [6000.0, 0.0, 0.0])]
    (column,) = of_type(artefact, "LWPOLYLINE")
    assert column.values["points"] == [
        [0.0, 0.0, 0.0, 0.0, 0.0],
        [300.0, 0.0, 0.0, 0.0, 0.5],
        [300.0, 300.0, 0.0, 0.0, 0.0],
    ]
    (hatch,) = of_type(artefact, "HATCH")
    paths: Any = hatch.values["paths"]
    assert [path["type"] for path in paths] == ["polyline", "edges"]
    assert [edge["type"] for edge in paths[1]["edges"]] == ["line", "arc", "line"]
    (spline,) = of_type(artefact, "SPLINE")
    fit_points: Any = spline.values["fit_points"]
    assert len(fit_points) == 4


@pytest.mark.needs_toolchain
def test_every_entity_lies_in_its_block_record_and_a_layout_names_its_own(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("sheet_layout"))

    layouts = {block.layout: block for block in artefact.blocks.values() if block.layout}
    assert set(layouts) == {"Model", "Layout1", "Sheet A"}
    sheet = layouts["Sheet A"]
    assert [artefact.entities[h].layer for h in sheet.entities] == ["GRID", "GRID"]
    for block in artefact.blocks.values():
        assert all(artefact.entities[h].owner == block.handle for h in block.entities)
    assert sum(len(block.entities) for block in artefact.blocks.values()) == len(artefact.entities)


@pytest.mark.needs_toolchain
def test_an_attribs_null_style_is_taken_from_its_attdef(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("title_block"))

    attribs = [e for e in artefact.entities.values() if isinstance(e, Text) and e.type == "ATTRIB"]
    assert len(attribs) == 6
    assert {(a.style, a.style_source, a.font) for a in attribs} == {("TITLE", "attdef", "romans.shx")}
    assert {
        "code": "engine.read.attrib_style_from_attdef",
        "params": {"count": 6},
    } in artefact.summary.notes
    attdefs = [e for e in artefact.entities.values() if isinstance(e, Text) and e.type == "ATTDEF"]
    assert {(a.tag, a.style_source) for a in attdefs} == {("SHEET_NO", "own"), ("SHEET_TITLE", "own")}


@pytest.mark.needs_toolchain
def test_inserts_keep_their_placement_unresolved(dwg_fixture: Fixture) -> None:
    by_number = inserts_by_sheet_number(read(dwg_fixture("title_block")))

    rotated, mirrored = by_number["A-02"], by_number["A-03"]
    assert rotated.scale == (2.0, -2.0, 1.0)
    assert rotated.rotation_radians == pytest.approx(math.pi / 6)
    assert mirrored.extrusion == (0.0, 0.0, -1.0)
    assert mirrored.point == (2000.0, 0.0, 0.0)  # as stored: no transform applied


def inserts_by_sheet_number(artefact: ReadArtefact) -> dict[str, Insert]:
    found = {}
    for insert in artefact.entities.values():
        if isinstance(insert, Insert):
            for handle in insert.attribs:
                attrib = artefact.entities[handle]
                if isinstance(attrib, Text) and attrib.tag == "SHEET_NO":
                    found[attrib.text] = insert
    return found


@pytest.mark.needs_toolchain
def test_the_insert_chain_to_a_nested_text_makes_an_anchor(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("title_block"))
    model = next(block for block in artefact.blocks.values() if block.layout == "Model")

    chain: list[str] = []
    found = None
    for handle in model.entities:
        outer = artefact.entities[handle]
        if isinstance(outer, Insert) and outer.name == "FRAME":
            chain.append(outer.handle)
            inner = next(
                artefact.entities[h] for h in artefact.blocks[outer.block].entities
                if isinstance(artefact.entities[h], Insert)
            )  # fmt: skip
            assert isinstance(inner, Insert)
            chain.append(inner.handle)
            found = next(
                artefact.entities[h] for h in artefact.blocks[inner.block].entities
                if isinstance(artefact.entities[h], Text)
            )  # fmt: skip
    assert isinstance(found, Text)
    assert found.text == "X-01"

    summary = artefact.summary
    anchor = DwgAnchor(
        summary.source_sha256,
        summary.reader,
        summary.reader_version,
        "Model",
        tuple(chain),
        found.handle,
    )
    assert anchor_from_json(json.loads(json.dumps(anchor.to_json()))) == anchor
    assert len(anchor.inserts) == 2


@pytest.mark.needs_toolchain
def test_aligned_text_is_drawn_from_its_start_point(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("text_kinds"))
    found = texts(artefact)

    assert (found["CENTRED"].halign, found["CENTRED"].valign) == (1, 2)
    assert found["CENTRED"].position == (100.0, 0.0, 0.0)
    assert (found["RIGHT"].halign, found["RIGHT"].position) == (2, (200.0, 0.0, 0.0))
    assert {
        "code": "engine.read.aligned_text_from_start",
        "params": {"count": 2},
    } in artefact.summary.notes


@pytest.mark.needs_toolchain
def test_mtext_keeps_its_direction_vector_and_a_missing_height(dwg_fixture: Fixture) -> None:
    found = texts(read(dwg_fixture("text_kinds")))

    assert found["B1 (250 x 500)"].direction == (0.0, 1.0, 0.0)
    assert found["B1 (250 x 500)"].height == 3.0
    assert found["NO HEIGHT"].height is None


@pytest.mark.needs_toolchain
def test_text_with_a_raw_line_break_is_read_from_json_not_the_dxf(
    dwg_fixture: Fixture, tmp_path: Path
) -> None:
    path = dwg_fixture("text_kinds")

    found = texts(read(path))

    assert "FIRST LINE\nSECOND LINE" in found
    # What dwg2dxf would have given: not the text as stored (LibreDWG 0.14; lessons.md).
    dwg2dxf = [str(prefix() / "bin" / "dwg2dxf"), "-y", "-o", str(tmp_path / "f.dxf"), str(path)]
    subprocess.run(dwg2dxf, check=True, capture_output=True)
    dxf_texts = [e.dxf.text for e in readfile(tmp_path / "f.dxf").modelspace() if e.dxftype() == "MTEXT"]
    assert "FIRST LINE\nSECOND LINE" not in dxf_texts


@pytest.mark.needs_toolchain
def test_an_artefact_from_a_real_read_survives_its_json(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("title_block"))

    assert ReadArtefact.from_json(json.loads(json.dumps(artefact.to_json()))) == artefact


@pytest.mark.needs_toolchain
def test_a_damaged_dwg_is_a_reader_failure_with_its_finding(tmp_path: Path) -> None:
    damaged = tmp_path / "damaged.dwg"
    damaged.write_bytes(b"AC1032" + bytes(range(256)) * 8)

    with pytest.raises(ReadError) as raised:
        read(damaged)

    assert raised.value.message["code"] in {"engine.read.reader_failed", "engine.read.output_unreadable"}
    assert raised.value.message["params"]["program"] == "dwgread"


@pytest.mark.needs_toolchain
def test_a_file_dwgread_half_decodes_is_refused_not_read_in_part(
    dwg_fixture: Fixture, tmp_path: Path
) -> None:
    # 64 bytes flipped in the middle: dwgread exits 0 and says SUCCESS, having lost the objects the
    # block records list (found by the reader's refuter, 28 Sep 2026).
    data = bytearray(dwg_fixture("title_block").read_bytes())
    middle = len(data) // 2
    data[middle : middle + 64] = bytes(b ^ 0xFF for b in data[middle : middle + 64])
    damaged = tmp_path / "damaged.dwg"
    damaged.write_bytes(bytes(data))

    with pytest.raises(ReadError) as raised:
        read(damaged)

    assert raised.value.message["code"] == "engine.read.objects_missing"


@pytest.mark.needs_toolchain
def test_an_attdef_carries_its_default_text(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("title_block"))

    attdefs = {
        e.tag: e.text for e in artefact.entities.values() if isinstance(e, Text) and e.type == "ATTDEF"
    }
    assert attdefs == {"SHEET_NO": "X-00", "SHEET_TITLE": ""}
