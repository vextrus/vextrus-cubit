"""One handle names one record, and a drawing that says otherwise is refused by name (L-CAD-02).

Every drawing here is minted by this module — ezdxf writes it, then one handle line is restated —
because what is graded is a RULE about a file's handles and not a drawing (L-CAD-09: a fixture is a
synthetic drawing a committed script authors; this is the script). A drawing carrying the shape by
luck would prove the rule only for as long as the luck held.

What the rule is, measured rather than assumed. A reader binds every section of a DXF into one
handle-keyed database, so where two records state one handle it keeps the one it read last and drops
the earlier from the layout or block that held it:

* an entity in the BLOCKS section under a layout's own space block record (`*Paper_Space0` — where
  `cad/tests/fixtures/layouts.dxf` keeps SHEET A1's two entities) restating an ENTITIES handle costs
  the model-space original AND leaves one source key naming what is now the sheet's line;
* an entity inside an ordinary block definition restating an ENTITIES handle costs the model-space
  original too — the block keeps its paint, and the artifact stands for one entity fewer than the
  drawing holds, with nothing naming the loss;
* a repeat no drawing content takes part in costs nothing: an APPID and an XRECORD sharing a handle
  (the shape a converted sheet set really carries) leaves every original standing and every minted
  key unique, and LibreDWG writes a hundred such repeats into one converted drawing's TABLES.

So the refusal is owed where a drawing-content record takes part in the repeat, and owed nowhere
else. The three tests below are those three readings.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import ezdxf
import pytest

from vextrus_cad import ingest_dxf, report
from vextrus_cad.ingest import IngestError

#: The DXF group code a record's own handle is stated under.
HANDLE_CODE = "5"


@dataclass(frozen=True)
class Minted:
    """The drawing this module writes, and the handles its canaries restate."""

    path: Path
    text: str
    model_line: str
    appid: str


def _mint(path: Path) -> Minted:
    """A drawing with model paint, a block definition it instances, and a second paper layout.

    The second paper layout is the point of the shape: a DXF writes the active layout's entities in
    ENTITIES and every other layout's under its own space block record in BLOCKS, so this drawing
    carries layout content in both sections — which is what the scan has to walk.
    """
    doc = ezdxf.new("R2000", setup=False)
    model = doc.modelspace()
    model_line = model.add_line((0, 0), (1000, 0))
    block = doc.blocks.new("CANARY")
    block.add_line((0, 0), (100, 100))
    model.add_blockref("CANARY", (500, 500))
    sheet = doc.layouts.new("SHEET B")
    sheet.add_line((0, 0), (200, 0))
    sheet.add_text("SHEET B", dxfattribs={"height": 5}).set_placement((0, 10))
    doc.objects.add_xrecord(owner=doc.rootdict.dxf.handle)
    doc.saveas(str(path))
    return Minted(
        path=path,
        text=path.read_text(encoding="utf-8"),
        model_line=str(model_line.dxf.handle),
        appid=str(doc.appids.get("ACAD").dxf.handle),
    )


def _restated(text: str, *, section: str, block: str | None, dxftype: str, handle: str) -> str:
    """The same drawing with the first `dxftype` of `section` (and `block`) stating `handle`.

    Walked along the stream's own code/value rhythm, the way the extractor's scan walks it, so the
    line this rewrites is the record's handle line and never a value that happens to say 5.
    """
    lines = text.split("\n")
    at_section: str | None = None
    at_block: str | None = None
    current: str | None = None
    naming = False
    for index in range(0, len(lines) - 1, 2):
        code = lines[index].strip()
        value = lines[index + 1].strip()
        if code == "0" and value == "SECTION":
            at_section = lines[index + 3].strip()
            at_block = None
            current = None
        elif code == "0" and value == "ENDSEC":
            at_section = None
            at_block = None
            current = None
        elif code == "0":
            current = value
            if value == "BLOCK":
                naming = True
                at_block = None
        elif code == "2" and naming and current == "BLOCK":
            at_block = value
            naming = False
        elif code == HANDLE_CODE and current == dxftype and at_section == section and at_block == block:
            lines[index + 1] = handle
            return "\n".join(lines)
    raise AssertionError(f"this drawing states no {dxftype} in {section}/{block}")


def _write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


@pytest.fixture
def minted(tmp_path: Path) -> Minted:
    return _mint(tmp_path / "canary.dxf")


def test_the_drawing_this_module_mints_ingests_with_unique_keys(minted: Minted) -> None:
    """The control: undoctored, it is a drawing with paint in both sections and no repeat at all."""
    assert report.duplicate_handles(minted.path.read_bytes()) == []
    artifact = ingest_dxf(minted.path)
    keys = [entity["key"] for entity in artifact["entities"]]
    assert len(keys) == len(set(keys)), "the control drawing mints a key twice"
    assert {layout["name"] for layout in artifact["layouts"]} == {"model", "SHEET B"}


def test_a_space_block_record_restating_an_entities_handle_is_refused_by_name(
    minted: Minted, tmp_path: Path
) -> None:
    """A sheet's own entity, in BLOCKS, carrying a handle ENTITIES already stated (L-CAD-02).

    Both records are layout content, so both would mint `DXF_HANDLE:<handle>` — one key naming two
    originals. Unrefused, the reader settles it instead: the model-space line is dropped and the key
    names the sheet's.
    """
    drawing = _write(
        tmp_path / "space-block.dxf",
        _restated(
            minted.text,
            section="BLOCKS",
            block="*Paper_Space0",
            dxftype="LINE",
            handle=minted.model_line,
        ),
    )

    assert report.duplicate_handles(drawing.read_bytes()) == [minted.model_line]
    with pytest.raises(IngestError) as raised:
        ingest_dxf(drawing)
    assert raised.value.code == report.HANDLES_NOT_UNIQUE
    assert "1 handle(s) are stated more than once" in str(raised.value)
    assert minted.model_line in str(raised.value)


def test_an_ordinary_block_definition_restating_an_entities_handle_is_refused_by_name(
    minted: Minted, tmp_path: Path
) -> None:
    """Paint in a block definition mints no key of its own — and still costs an original.

    The block's line is never an original (an INSERT explodes it into `derived`, carrying its
    instance's key), so no key repeats. What repeats is the HANDLE, and the reader answers that by
    dropping the model-space line the ENTITIES section states: the artifact would stand for one
    entity fewer than the drawing holds, and nothing in it would say so (L-CAD-04).
    """
    drawing = _write(
        tmp_path / "block-definition.dxf",
        _restated(
            minted.text, section="BLOCKS", block="CANARY", dxftype="LINE", handle=minted.model_line
        ),
    )

    assert report.duplicate_handles(drawing.read_bytes()) == [minted.model_line]
    with pytest.raises(IngestError) as raised:
        ingest_dxf(drawing)
    assert raised.value.code == report.HANDLES_NOT_UNIQUE
    assert "1 handle(s) are stated more than once" in str(raised.value)
    assert minted.model_line in str(raised.value)


def test_a_repeat_no_drawing_content_takes_part_in_still_ingests(
    minted: Minted, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """An XRECORD restating an APPID's handle: structure, not content — the drawing is whole.

    This is the shape a real converted sheet set carries (`General Note_Edison Lavinia.dwg` states
    one, and the F-RCC6 corpus's own conversion states a hundred repeated BLOCK_RECORD, LTYPE and
    LAYER handles). No original is dropped and no key repeats, so refusing it would refuse the
    corpora this product is built on.
    """
    drawing = _write(
        tmp_path / "structure-only.dxf",
        _restated(
            minted.text, section="OBJECTS", block=None, dxftype="XRECORD", handle=minted.appid
        ),
    )

    assert report.duplicate_handles(drawing.read_bytes()) == []
    whole = ingest_dxf(minted.path)
    notes = report.Report()
    with caplog.at_level(logging.WARNING):
        artifact = ingest_dxf(drawing, notes)
    keys = [entity["key"] for entity in artifact["entities"]]
    assert len(keys) == len(set(keys)), "a repeat outside the drawing's content minted a key twice"
    assert keys == [entity["key"] for entity in whole["entities"]], (
        "a repeat outside the drawing's content cost the extraction surface an original"
    )

    # The reader has something to say about this file, and it says it to this process rather than to
    # whoever spawned it (L-CAD-01): held for the duration of the open, then counted as a note.
    warned = [note for note in notes.sorted_notes() if note.code == report.READER_WARNED]
    assert warned, "the reader's words about the repeat were dropped rather than held and counted"
    assert "non-unique entity handle" in warned[0].detail
    assert [record for record in caplog.records if record.name.startswith("ezdxf")] == [], (
        "the reader's words left this process on a stream that is not its own"
    )
