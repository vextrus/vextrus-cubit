"""The seed's recording (`vextrus/seed/recorded/`, #182) is what `vextrus/seed/kr01.py` draws, read by
the engine's readers: the folder holds only the files the recorder writes; each recorded DWG is the one
its reading was read from (its sha256 and the artefact's); each reading is of the drawing `kr01.py`
draws now (a changed drawing with no new recording fails here); and, with the toolchain, the drawing
written again by the repo's writer and read by today's reader reads exactly as the recording says (a
changed reader or reader version with no new recording fails there; the writer stamps each save
differently, so the readings are compared, not the bytes). A file the recording does not hold is the
seed's fault, raised by name, never a file's reason."""

import hashlib
from pathlib import Path

import pytest

from engine.read.artefact import ReadArtefact
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
