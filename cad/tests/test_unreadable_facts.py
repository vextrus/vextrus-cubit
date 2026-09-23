"""A fact v3 only restates never refuses a drawing v2 took (I-415, L-CAD-04).

v3 carries how a text is written — its rotation and its alignment — as the entity states them, and
applies none of it. A drawing can state those facts unreadably: an alignment code outside the closed
range DXF gives it (ezdxf's recover audit leaves every one of them as it found it), a group 50 of
1e400, a text_direction of no length, an extrusion that is no direction. v2 ingested each of those
drawings. v3 reads each such statement as DXF's default — the value ezdxf's own attribute validator
restores — and names the reading in the report, so the loss is said and the sheet is not refused.

Where a statement is APPLIED the rule is the other one: a block reference's placement drives its
explode, and a reference placed nowhere is refused under a name that says so, never as "a non-finite
coordinate" it never had (L-QTY-04: a refusal's name states what is true).

Each drawing is authored here and asks one question (L-CAD-09). The malformed values are written
past ezdxf's validating setters, which would repair them on the way in, and every test first reads
the raw tag back out of the bytes it ingests: the question is about a file that states it.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import ezdxf
import pytest
from ezdxf.enums import TextEntityAlignment
from ezdxf.math import Vec3

from vextrus_cad import cli, ingest_dxf, parse_entity_graph, report
from vextrus_cad import ingest as ingest_module
from vextrus_cad.ingest import IngestError, ingest_document

#: A rotation a test writes and then respells in the file as a literal no float can hold.
_SENTINEL = "12.3456789"


def _stated(entity: Any, **values: Any) -> Any:
    """Set DXF attributes as the file is to state them, past ezdxf's validating setters."""
    for name, value in values.items():
        entity.dxf.__dict__[name] = value
    return entity


def _written(doc: Any, tmp_path: Path, respelled: dict[str, str] | None = None) -> Path:
    """The drawing as a DXF file, each placeholder value line respelled as the literal given."""
    path = tmp_path / "drawing.dxf"
    doc.saveas(path)
    text = path.read_text(encoding="utf-8")
    for placeholder, literal in (respelled or {}).items():
        line = f"\n{placeholder}\n"
        assert text.count(line) == 1, f"{placeholder} must stand once in the file to be respelled"
        text = text.replace(line, f"\n{literal}\n")
    path.write_text(text, encoding="utf-8")
    return path


def _tags(path: Path) -> list[tuple[str, str]]:
    """The file's tag stream as (group code, value) pairs, both as the file spells them."""
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    return list(zip(lines[0::2], lines[1::2], strict=False))


def _texts(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {record["text"]: record for record in records if "text" in record}


def _notes(notes: report.Report, code: str) -> list[dict[str, object]]:
    return [note.as_dict() for note in notes.sorted_notes() if note.code == code]


def _out_of_range_drawing(tmp_path: Path) -> Path:
    """The review's drawing: every text fact v3 restates, stated where no reader can take it."""
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    msp.add_line((0, 0), (100, 100))
    _stated(msp.add_text("SEVEN", dxfattribs={"height": 1, "insert": (0, 0)}), halign=7)
    _stated(msp.add_mtext("NOUGHT", dxfattribs={"char_height": 1, "insert": (10, 0)}), attachment_point=0)
    _stated(msp.add_text("BOUNDLESS", dxfattribs={"height": 1, "insert": (20, 0)}), rotation=float(_SENTINEL))

    symbol = doc.blocks.new("SYM")
    symbol.add_circle((0, 0), 1)
    _stated(symbol.add_text("NINE", dxfattribs={"height": 1, "insert": (0, 0)}), halign=9)
    msp.add_blockref("SYM", (100, 100))

    tag = doc.blocks.new("TAG")
    tag.add_circle((0, 0), 1)
    tag.add_attdef("MARK", (0, 0), dxfattribs={"height": 0.5})
    reference = msp.add_blockref("TAG", (50, 50))
    _stated(reference.add_attrib("MARK", "C4", (50, 50), dxfattribs={"height": 0.5}), halign=8, valign=6)

    path = _written(doc, tmp_path, {_SENTINEL: "1e400"})
    tags = _tags(path)
    for stated in (("72", "7"), ("71", "0"), ("50", "1e400"), ("72", "9"), ("72", "8"), ("74", "6")):
        assert stated in tags, f"the file states group {stated[0]} = {stated[1]}"
    return path


# ------------------------------------------------------------------------ restated, never refused


def test_text_facts_stated_out_of_range_are_read_as_the_default_and_each_reading_is_named(
    tmp_path: Path,
) -> None:
    """v2 ingested this drawing; v3 refused it (`entities[0].halign: 7 is outside 0-5`, or
    `non-finite coordinate nan` for the group 50) before the fix. Now it ingests, every restated
    fact is DXF's default, and the report says which tag was read so and how many times."""
    notes = report.Report()
    artifact = ingest_dxf(_out_of_range_drawing(tmp_path), notes)
    parse_entity_graph(artifact)

    texts = _texts(artifact["entities"])
    assert (texts["SEVEN"]["halign"], texts["SEVEN"]["valign"]) == (0, 0)
    assert "align_point" not in texts["SEVEN"], "read as left on its baseline, it is placed by its insert"
    assert texts["NOUGHT"]["attachment"] == 1, "an attachment outside 1-9 is read as top left"
    assert texts["BOUNDLESS"]["rotation"] == 0.0, "a group 50 of 1e400 is read as no turn"
    assert texts["BOUNDLESS"]["points"] == [[20.0, 0.0]], "and the text still stands where it stood"
    (painted,) = [record for record in artifact["derived"] if record.get("text") == "NINE"]
    assert (painted["halign"], painted["valign"]) == (0, 0)
    (attribute,) = artifact["block_attributes"]
    assert (attribute["halign"], attribute["valign"]) == (0, 0)

    assert _notes(notes, report.TEXT_ALIGNMENT_UNREADABLE) == [
        {
            "code": report.TEXT_ALIGNMENT_UNREADABLE,
            "count": 6,
            "detail": "; ".join(
                (
                    "ATTRIB group 72 outside 0-5, read as 0: 1",
                    "ATTRIB group 74 outside 0-3, read as 0: 1",
                    "MTEXT group 71 outside 1-9, read as 1: 1",
                    # SEVEN, and NINE as its reference paints it; then NINE read for SYM's digest.
                    "TEXT group 72 outside 0-5, read as 0: 2",
                    "TEXT group 72 outside 0-5, read as 0, in a block definition: 1",
                )
            ),
        }
    ]
    assert _notes(notes, report.TEXT_ROTATION_UNREADABLE) == [
        {
            "code": report.TEXT_ROTATION_UNREADABLE,
            "count": 1,
            "detail": "TEXT group 50 names no direction on the drawing plane, read as 0: 1",
        }
    ]


def test_the_cli_writes_that_drawing_and_says_each_reading_on_stderr(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The seam as the ingest door invokes it: exit 0 and an artifact, not `cannot ingest`."""
    out = tmp_path / "artifact.json"

    assert cli.main(["ingest", str(_out_of_range_drawing(tmp_path)), "--out", str(out)]) == 0

    parse_entity_graph(json.loads(out.read_text(encoding="utf-8")))
    said = capsys.readouterr().err.splitlines()
    rotation = "TEXT group 50 names no direction on the drawing plane, read as 0: 1"
    assert f"{report.NOTE_PREFIX}{report.TEXT_ROTATION_UNREADABLE}: {rotation}" in said
    alignment = f"{report.NOTE_PREFIX}{report.TEXT_ALIGNMENT_UNREADABLE}: "
    assert any(line.startswith(alignment) for line in said)
    assert not any("cannot ingest" in line for line in said)


def test_a_direction_that_names_none_on_the_drawing_plane_is_read_as_no_turn_and_named() -> None:
    """No length, no finite component, or edge-on to the plane: atan2 of any of them is an angle of
    nothing (0 for a zero vector, noise for an edge-on one), and was once read so in silence."""
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    for name, x, stated in (
        ("NO LENGTH", 0, {"text_direction": Vec3(0, 0, 0)}),
        ("UPRIGHT", 10, {"text_direction": Vec3(0, 0, 1)}),
        ("BOUNDLESS", 20, {"rotation": float("inf")}),
    ):
        _stated(msp.add_mtext(name, dxfattribs={"char_height": 1, "insert": (x, 0)}), **stated)
    # Group 50 = 90 in a frame whose y axis is the world's z: the baseline stands straight up.
    _stated(msp.add_text("EDGE-ON", dxfattribs={"height": 1, "rotation": 90}), extrusion=Vec3(1, 0, 0))
    msp.add_mtext("TURNED", dxfattribs={"char_height": 1, "insert": (30, 0), "text_direction": (0, 1, 0)})
    notes = report.Report()

    artifact = ingest_document(doc, notes)
    parse_entity_graph(artifact)

    texts = _texts(artifact["entities"])
    for name in ("NO LENGTH", "UPRIGHT", "BOUNDLESS", "EDGE-ON"):
        assert texts[name]["rotation"] == 0.0, name
    assert texts["TURNED"]["rotation"] == 90.0, "a direction that names one is read as it always was"
    assert _notes(notes, report.TEXT_ROTATION_UNREADABLE) == [
        {
            "code": report.TEXT_ROTATION_UNREADABLE,
            "count": 4,
            "detail": "; ".join(
                (
                    "MTEXT group 50 names no direction on the drawing plane, read as 0: 1",
                    "MTEXT text_direction names no direction on the drawing plane, read as 0: 2",
                    "TEXT group 50 names no direction on the drawing plane, read as 0: 1",
                )
            ),
        }
    ]


def test_an_extrusion_that_is_no_direction_reads_the_text_in_the_worlds_frame_as_v2_did() -> None:
    """Its OCS would be built of NaN, so the rotation, the alignment point and the anchor would all
    be `non-finite coordinate nan`. The world's frame is DXF's default and the one v2 read in."""
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    boundless = msp.add_text("BOUNDLESS", dxfattribs={"height": 1, "rotation": 90})
    boundless.set_placement((5, 5), align=TextEntityAlignment.MIDDLE_CENTER)
    boundless.dxf.insert = (4, 3)
    _stated(boundless, extrusion=Vec3(float("inf"), 0, 1))
    _stated(msp.add_text("NULL", dxfattribs={"height": 1, "insert": (20, 0)}), extrusion=Vec3(0, 0, 0))
    notes = report.Report()

    artifact = ingest_document(doc, notes)
    parse_entity_graph(artifact)

    texts = _texts(artifact["entities"])
    assert texts["BOUNDLESS"]["rotation"] == 90.0, "group 50 read in the world's frame"
    assert texts["BOUNDLESS"]["align_point"] == [5.0, 5.0]
    assert texts["BOUNDLESS"]["points"] == [[4.0, 3.0]], "the anchor is the raw insert v2 read"
    assert texts["NULL"]["points"] == [[20.0, 0.0]]
    assert _notes(notes, report.TEXT_EXTRUSION_UNREADABLE) == [
        {
            "code": report.TEXT_EXTRUSION_UNREADABLE,
            "count": 2,
            "detail": "TEXT extrusion is no direction, read as +Z: 2",
        }
    ]


def test_an_alignment_point_that_is_not_finite_is_read_as_the_insert_and_named(tmp_path: Path) -> None:
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    centred = msp.add_text("CENTRED", dxfattribs={"height": 1})
    centred.set_placement((7, 7), align=TextEntityAlignment.MIDDLE_CENTER)
    _stated(centred, insert=Vec3(6, 6, 0), align_point=Vec3(7.654321, 7, 0))
    stretched = msp.add_text("STRETCHED", dxfattribs={"height": 1, "rotation": 30})
    stretched.set_placement((0, 0), (10, 0), align=TextEntityAlignment.ALIGNED)
    _stated(stretched, align_point=Vec3(8.765432, 0, 0))
    notes = report.Report()
    path = _written(doc, tmp_path, {"7.654321": "1e400", "8.765432": "-1e400"})

    artifact = ingest_dxf(path, notes)
    parse_entity_graph(artifact)

    texts = _texts(artifact["entities"])
    assert texts["CENTRED"]["align_point"] == [6.0, 6.0], "read as its insert, ezdxf's own reading"
    assert texts["STRETCHED"]["align_point"] == [0.0, 0.0]
    assert texts["STRETCHED"]["rotation"] == 30.0, "with no baseline to run along, group 50 turns it"
    assert _notes(notes, report.TEXT_ALIGNMENT_UNREADABLE) == [
        {
            "code": report.TEXT_ALIGNMENT_UNREADABLE,
            "count": 2,
            "detail": "TEXT alignment point not finite, read as its insert: 2",
        }
    ]


def test_a_layer_the_table_names_empty_is_restated_as_named() -> None:
    """A drawn record's `layer` has been admitted empty since v2; the table row stating its
    visibility is the same name, so both mirrors admit it rather than refuse the drawing."""
    doc = ezdxf.new("R2018")
    _stated(doc.layers.add("NAMELESS"), name="")
    artifact = ingest_document(doc)

    parse_entity_graph(artifact)
    assert {"name": "", "on": True, "frozen": False, "plot": True} in artifact["layers"]


# --------------------------------------------------------------------------- applied, so refused


@pytest.mark.parametrize(
    ("statement", "value", "named"),
    [
        ("rotation", float("inf"), "rotation"),
        ("xscale", float("nan"), "x scale"),
        ("insert", Vec3(float("inf"), 0, 0), "insert point"),
        ("extrusion", Vec3(float("nan"), 0, 1), "extrusion"),
    ],
)
def test_a_block_reference_placed_nowhere_is_refused_by_what_it_states(
    statement: str, value: Any, named: str
) -> None:
    """The explode applies a placement, so one that is not finite refuses the drawing — at once, and
    naming the reference and the statement. v2 walked such a reference without end, and the first cut
    of v3 refused it as `non-finite coordinate nan`."""
    doc = ezdxf.new("R2018")
    doc.blocks.new("SYM").add_circle((0, 0), 1)
    reference = _stated(doc.modelspace().add_blockref("SYM", (1, 1)), **{statement: value})

    # `ingest_dxf` wraps this in DXF_UNEXTRACTABLE (the nested case below goes through a file).
    with pytest.raises(ValueError) as refused:
        ingest_document(doc)

    message = str(refused.value)
    assert f"block reference {reference.dxf.handle} (block SYM) states no finite {named}" in message
    assert "coordinate" not in message


def test_a_nested_reference_placed_nowhere_is_refused_before_its_walk(tmp_path: Path) -> None:
    doc = ezdxf.new("R2018")
    doc.blocks.new("INNER").add_circle((0, 0), 1)
    _stated(doc.blocks.new("OUTER").add_blockref("INNER", (0, 0)), rotation=float(_SENTINEL))
    outer = doc.modelspace().add_blockref("OUTER", (0, 0))
    path = _written(doc, tmp_path, {_SENTINEL: "1e400"})

    with pytest.raises(IngestError) as refused:
        ingest_dxf(path)

    assert refused.value.code == report.DXF_UNEXTRACTABLE
    assert (
        f"block reference nested in DXF_HANDLE:{outer.dxf.handle} (block INNER) states no finite rotation"
        in refused.value.message
    )


# ------------------------------------------------------------------------------ block definitions


def _chain(doc: Any, depth: int, deepest: Any) -> None:
    """B0 nests B1 nests … B<depth>, and B<depth> holds what `deepest` draws into it."""
    for level in range(depth, -1, -1):
        block = doc.blocks.new(f"B{level}")
        if level == depth:
            deepest(block)
        else:
            block.add_blockref(f"B{level + 1}", (0, 0))


def test_a_definition_past_the_depth_cap_that_cannot_be_read_costs_its_digest_not_the_drawing() -> None:
    """The explode stops at the cap, so v2 never read B9 and took the drawing. The digest walk reads
    every definition it meets, and a record it cannot read leaves that definition — and each that
    nests it — with no digest, named once."""
    doc = ezdxf.new("R2018")
    _chain(doc, 9, lambda block: _stated(block.add_line((0, 0), (1, 1)), end=Vec3(float("inf"), 0, 0)))
    doc.modelspace().add_blockref("B0", (0, 0))
    notes = report.Report()

    artifact = ingest_document(doc, notes)
    parse_entity_graph(artifact)

    (reference,) = [record for record in artifact["entities"] if record["type"] == "INSERT"]
    assert reference["block"]["definition_sha256"] is None
    (said,) = _notes(notes, report.BLOCK_DEFINITION_UNREADABLE)
    assert str(said["detail"]).startswith("block B9: LINE ")
    assert str(said["detail"]).endswith(
        "non-finite coordinate inf; it and every block that nests it carry no digest"
    )


def test_a_definition_nesting_an_unreadable_one_has_no_digest_of_its_own() -> None:
    """A symbol part of which cannot be read has no identity to state; a readable sibling keeps its."""
    doc = ezdxf.new("R2018")
    broken = doc.blocks.new("BROKEN")
    _stated(broken.add_line((0, 0), (1, 1)), start=Vec3(float("nan"), 0, 0))
    doc.blocks.new("HOLDS_BROKEN").add_blockref("BROKEN", (0, 0))
    doc.blocks.new("SOUND").add_circle((0, 0), 1)
    doc.blocks.new("HOLDS_SOUND").add_blockref("SOUND", (0, 0))
    notes = report.Report()
    extractor = ingest_module._Extractor(doc, notes)

    assert extractor.definition("HOLDS_BROKEN")[0] is None
    assert extractor.definition("BROKEN")[0] is None
    assert extractor.definition("HOLDS_SOUND")[0] is not None
    assert [note.code for note in notes.sorted_notes() if note.code.startswith("BLOCK")] == [
        report.BLOCK_DEFINITION_UNREADABLE
    ], "named once, at the definition that cannot be read"
