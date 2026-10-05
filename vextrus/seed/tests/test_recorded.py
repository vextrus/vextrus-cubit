"""The seed's recording (`vextrus/seed/recorded/`, #182) is what `vextrus/seed/kr01.py` draws, read by
the engine's readers: the folder holds only the files the recorder writes; each recorded DWG is the one
its reading was read from (its sha256 and the artefact's); each reading is of the drawing `kr01.py`
draws now (a changed drawing with no new recording fails here); and, with the toolchain, the drawing
written again by the repo's writer and read by today's reader reads exactly as the recording says (a
changed reader or reader version with no new recording fails there; the writer stamps each save
differently, so the readings are compared, not the bytes). A file the recording does not hold is the
seed's fault, raised by name, never a file's reason."""

import hashlib
from collections import Counter
from pathlib import Path

import pytest

from engine.read.artefact import ReadArtefact, Text
from vextrus.seed import kr01


def _recorded(name: str) -> ReadArtefact:
    return ReadArtefact.from_json(kr01.recorded_of(name)["artefact"])  # type: ignore[arg-type]


def _reading(artefact: ReadArtefact) -> dict[str, object]:
    """The whole reading but the bytes' sha256 (the writer stamps each save differently): the reader
    and its version, every block and entity."""
    kept = artefact.to_json()
    summary = dict(kept["summary"])
    summary.pop("source_sha256")
    return {**kept, "summary": summary}


def test_the_recorded_folder_holds_only_what_the_recorder_writes() -> None:
    written = {n for name in kr01.FILES for n in (name, f"{name}.json.gz")}

    assert {p.name for p in kr01.RECORDED.iterdir()} == written


@pytest.mark.parametrize("name", list(kr01.FILES))
def test_each_recorded_dwg_is_the_one_its_reading_was_read_from(name: str) -> None:
    sha256 = hashlib.sha256(kr01.content(name)).hexdigest()

    assert kr01.recorded_of(name)["sha256"] == sha256
    assert _recorded(name).summary.source_sha256 == sha256


@pytest.mark.parametrize("name", list(kr01.FILES))
def test_each_reading_is_of_the_drawing_kr01_draws_now(name: str) -> None:
    """Change `kr01.py`'s drawing and this fails until `record_demo_reading` is run again."""
    assert kr01.recorded_of(name)["drawn"] == kr01.drawn_digest(name)


def _drawn(name: str) -> dict[str, object]:
    """What `kr01.draw(name)` draws, as a reading of it would hold it."""
    doc = kr01.draw(name)
    return {
        "insunits": doc.header["$INSUNITS"],
        "styles": {style.dxf.name: style.dxf.font for style in doc.styles},
        "entities": Counter(
            (layout.name, entity.dxftype(), entity.dxf.layer)
            for layout in doc.layouts
            for entity in layout
        ),
        "texts": Counter(
            (
                layout.name,
                entity.dxf.style,
                entity.text if entity.dxftype() == "MTEXT" else entity.dxf.text,  # type: ignore[attr-defined]
            )
            for layout in doc.layouts
            for entity in layout
            if entity.dxftype() in ("TEXT", "MTEXT")
        ),
    }


def _held(name: str) -> dict[str, object]:
    """The same, from the recorded reading (no toolchain)."""
    artefact = _recorded(name)
    layout = {handle: block.layout for handle, block in artefact.blocks.items()}
    return {
        "insunits": artefact.summary.insunits,
        "styles": {style.name: style.font for style in artefact.styles.values()},
        "entities": Counter((layout.get(e.owner), e.type, e.layer) for e in artefact.entities.values()),
        "texts": Counter(
            (layout.get(e.owner), e.style, e.text)
            for e in artefact.entities.values()
            if isinstance(e, Text) and e.type in ("TEXT", "MTEXT")
        ),
    }


@pytest.mark.parametrize("name", list(kr01.FILES))
def test_each_reading_holds_what_kr01_draws_now_without_the_toolchain(name: str) -> None:
    """The recorded reading against `draw(name)` itself, field by field: its units, its styles' fonts,
    every entity by layout, kind and layer, and every text by layout and style (a recording of
    another drawing, or a drawing since changed in units, fonts or words, fails here in CI)."""
    drawn, held = _drawn(name), _held(name)

    for field in ("insunits", "styles", "entities", "texts"):
        assert held[field] == drawn[field], (name, field)


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_the_drawing_written_again_reads_as_the_recording_says(tmp_path: Path) -> None:
    from engine.fixtures import dwg
    from engine.read import read

    writer = dwg.build_writer(tmp_path / "writer")
    for name in kr01.FILES:
        dxf, path = tmp_path / f"{name}.dxf", tmp_path / name
        kr01.draw(name).saveas(dxf)
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(path), kr01.VERSION], 120)

        assert _reading(read(path, source_name=name)) == _reading(_recorded(name)), name


def test_a_file_the_recording_does_not_hold_is_named_as_the_seeds_fault(tmp_path: Path) -> None:
    stray = tmp_path / "KR-STR-R0.dwg"
    stray.write_bytes(kr01.content("KR-STR-R0.dwg") + b"\0")

    with pytest.raises(kr01.NotRecorded, match="record_demo_reading"):
        kr01.replayed().dwg(stray, stray.name)
