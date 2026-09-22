"""`vextrus-cad ingest` as the seam is invoked: one shot, then the process ends (L-CAD-01).

Failures are loud (L-CAD-04): an unparseable drawing exits non-zero, names the file on stderr and
leaves `--out` exactly as it found it — a half-written artifact would be worse than none, because
downstream stages read the artifact and nothing else.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest

from corpus import artifact_names, artifact_path, drawing_path
from vextrus_cad import cli, parse_entity_graph, report
from vextrus_cad.cli import EXIT_REFUSED, main
from vextrus_cad.dwg import SHORTFALL, UNKNOWN_ENT, DwgConversion, RefusedClass

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


def test_dwg_ingest_writes_the_artifact_and_exits_zero(tmp_path: Path) -> None:
    dwg_source = Path(__file__).parent / "dwg" / "fixtures" / "basic.dwg"
    out = tmp_path / "basic.dwg.entitygraph.json"
    assert main(["ingest", str(dwg_source), "--out", str(out)]) == 0
    assert out.is_file()
    graph = parse_entity_graph(json.loads(out.read_text(encoding="utf-8")))
    assert len(graph.document["entities"]) > 0


#: What a conversion lost on the staged drawing: a class the sheet kept most of, a whole sheet the
#: conversion emptied, and a class the census could not name. The numbers are ARCHITECTURE.dwg's own.
CONVERSION_LOSSES = (
    RefusedClass("model", "LWPOLYLINE", SHORTFALL, 13157, 466),
    RefusedClass("Layout1", "VIEWPORT", SHORTFALL, 15, 0),
    RefusedClass("model", UNKNOWN_ENT, UNKNOWN_ENT, 4, 0),
)


def test_a_dwg_whose_conversion_lost_classes_ingests_and_names_every_loss(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A per-class shortfall is a named loss, not a refused sheet (L-CAD-04).

    The conversion is staged rather than run: `cad/tests/dwg/test_dwg_shortfall.py` proves a real
    LibreDWG pass produces the disagreement, and what is graded here is the CLI's own carrying of
    it — onto the artifact, where the product reads losses, and onto stderr, where the operator
    does. A drawing that still yields geometry exits 0 whatever the two passes disagreed about, and
    a space the conversion emptied is named even though no layout of the artifact carries it.
    """
    converted = tmp_path / "converted.dxf"
    shutil.copyfile(drawing_path(NAMES[0]), converted)

    def _staged(source: Path, out_dir: Path, **_: Any) -> DwgConversion:
        return DwgConversion(
            dxf_path=converted,
            census={},
            geometry={},
            refused=CONVERSION_LOSSES,
            tool="libredwg",
            tool_version="0.13.0",
        )

    monkeypatch.setattr(cli, "convert_dwg", _staged)
    source = tmp_path / "sheets.dwg"
    source.write_bytes(b"AC1015\x00")
    out = tmp_path / "sheets.entitygraph.json"

    assert main(["ingest", str(source), "--out", str(out)]) == 0
    graph = parse_entity_graph(json.loads(out.read_text(encoding="utf-8")))

    rows = {row["space"]: row for row in graph.document["counters"]}
    assert rows["model"]["conversion_losses"] == {"LWPOLYLINE": 12691, UNKNOWN_ENT: 4}
    assert rows["Layout1"]["conversion_losses"] == {"VIEWPORT": 15}
    assert "Layout1" not in {layout["name"] for layout in graph.document["layouts"]}, (
        "the staged sheet is one the artifact does not carry — which is why its loss must be named"
    )

    said = capsys.readouterr().err
    assert (
        f"{report.NOTE_PREFIX}{report.CONVERSION_SHORTFALL}: LWPOLYLINE is refused on model — "
        "the census counted 13157, the conversion carried 466" in said
    )
    assert (
        f"{report.NOTE_PREFIX}{report.CONVERSION_SHORTFALL}: VIEWPORT is refused on Layout1 — "
        "the census counted 15, the conversion carried 0" in said
    )
    assert (
        f"{report.NOTE_PREFIX}{report.CONVERSION_UNKNOWN_ENT}: {UNKNOWN_ENT} is refused on model"
        in said
    )


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
