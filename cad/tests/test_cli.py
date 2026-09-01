"""`vextrus-cad ingest` as the seam is invoked: one shot, then the process ends (L-CAD-01).

Failures are loud (L-CAD-04): an unparseable drawing exits non-zero, names the file on stderr and
leaves `--out` exactly as it found it — a half-written artifact would be worse than none, because
downstream stages read the artifact and nothing else.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from corpus import artifact_names, artifact_path, drawing_path
from vextrus_cad import parse_entity_graph
from vextrus_cad.cli import EXIT_REFUSED, main

NAMES = artifact_names()


@pytest.mark.parametrize("name", NAMES)
def test_ingest_writes_the_artifact_and_exits_zero(name: str, tmp_path: Path) -> None:
    out = tmp_path / "artifact.json"
    assert main(["ingest", str(drawing_path(name)), "--out", str(out)]) == 0
    assert out.read_bytes() == artifact_path(name).read_bytes()
    parse_entity_graph(json.loads(out.read_text(encoding="utf-8")))


def test_ingest_writes_into_a_directory_that_does_not_exist_yet(tmp_path: Path) -> None:
    out = tmp_path / "artifacts" / "nested" / "artifact.json"
    assert main(["ingest", str(drawing_path(NAMES[0])), "--out", str(out)]) == 0
    assert out.is_file()


def test_an_unparseable_drawing_is_refused_by_name(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "not-a-drawing.dxf"
    source.write_text("this is not a DXF file\n", encoding="utf-8")
    out = tmp_path / "artifact.json"
    out.write_text("untouched", encoding="utf-8")

    assert main(["ingest", str(source), "--out", str(out)]) == EXIT_REFUSED
    assert str(source) in capsys.readouterr().err
    assert out.read_text(encoding="utf-8") == "untouched"


def test_a_destination_that_cannot_be_written_is_refused_by_name(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # A readable drawing and an impossible destination is the third ending the contract has to
    # spell: still loud, still non-zero, still naming what the operator gave it — never a traceback
    # naming cli.py, and never a staging directory left behind (L-CAD-04).
    out = tmp_path / "artifacts"
    out.mkdir()

    assert main(["ingest", str(drawing_path(NAMES[0])), "--out", str(out)]) == EXIT_REFUSED
    assert str(out) in capsys.readouterr().err
    assert out.is_dir()
    assert list(out.iterdir()) == []
    assert [entry.name for entry in tmp_path.iterdir() if entry.name.startswith(".vextrus-cad-")] == []


def test_a_missing_drawing_is_refused_by_name(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = tmp_path / "absent.dxf"
    out = tmp_path / "artifact.json"

    assert main(["ingest", str(source), "--out", str(out)]) == EXIT_REFUSED
    assert str(source) in capsys.readouterr().err
    assert not out.exists()
