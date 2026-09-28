"""11's stages run in the harness under the names the contract fixes, and the export meets its schema.

The sheets stage (13) is not built yet, so without it the harness never builds buffers: these tests
put a stand-in for 13 in the stage table, returning one hand-made SheetCandidate over the drawing, and
leave every other stage at its real target (the reader, or a stand-in for it where no toolchain is
asked for).
"""

import json
import textwrap
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.export import load_schema, validate
from engine.fixtures import dwg

STAND_IN_SHEETS = """
from engine.recognise.types import Box, SheetCandidate, SheetLocation

def find(artefact, discipline, conventions):
    return [SheetCandidate(SheetLocation(box=Box({box})))]
"""
STAND_IN_READ = """
from engine.render.fixtures.make import tiny_sheet

def read(path):
    return tiny_sheet()[0]
"""


def _stages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, **stand_ins: str
) -> tuple[harness.Stage, ...]:
    folder = tmp_path / "code" / "stand_ins_11"
    folder.mkdir(parents=True)
    (folder / "__init__.py").write_text("")
    for name, source in stand_ins.items():
        (folder / f"{name}.py").write_text(textwrap.dedent(source))
    monkeypatch.syspath_prepend(str(tmp_path / "code"))
    targets = {"sheets": "stand_ins_11.sheets:find", "read": "stand_ins_11.read:read"}
    return tuple(
        replace(s, target=targets[s.name]) if s.name in stand_ins else s for s in harness.STAGES
    )


def _conventions(tmp_path: Path) -> Path:
    """A sheet conventions file (13's default is not on main yet); the sheets stage needs one."""
    folder = tmp_path / "conventions"
    folder.mkdir()
    sheet = {"disciplines": [{"key": "structural", "prefixes": ["S"]}]}
    (folder / "sheet-default.json").write_text(json.dumps(sheet))
    return folder


def _states(document: dict[str, Any]) -> dict[str, str]:
    return {name: report["state"] for name, report in document["files"][0]["stages"].items()}


def test_the_harness_runs_11s_stages_and_writes_a_valid_export(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    stages = _stages(
        tmp_path, monkeypatch, read=STAND_IN_READ, sheets=STAND_IN_SHEETS.format(box="0, 0, 210, 148")
    )
    folder = tmp_path / "set"
    folder.mkdir()
    (folder / "S-01.dwg").write_bytes(b"AC1032 stand-in")
    out = tmp_path / "out" / "export.json"
    document: Any = harness.run(folder, out, stages=stages, conventions=_conventions(tmp_path))

    states = _states(document)
    for stage in ("font_report", "bangla_ansi", "render_buffers", "rasterise"):
        assert states[stage] == "ok", (stage, document["files"][0]["stages"][stage])
    reading = document["files"][0]
    assert reading["font_report"]["fonts_named"] == 3
    assert reading["bangla_ansi"] == {"by_font": 0, "by_pattern": 0, "fonts": 0, "texts": 0}
    assert validate(document, load_schema()) == []


@pytest.fixture(scope="module")
def dwg_set(tmp_path_factory: pytest.TempPathFactory) -> Path:
    build = tmp_path_factory.mktemp("build")
    folder = tmp_path_factory.mktemp("set")
    writer = dwg.build_writer(build)
    for name in ("mirrored_insert", "mtext_no_height", "mtext_angle", "title_block", "text_kinds"):
        (folder / f"S-{name}.dwg").write_bytes(dwg.build(name, build, writer).read_bytes())
    return folder


@pytest.mark.needs_toolchain
def test_on_real_reads_of_the_fixture_dwgs(
    dwg_set: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    box = "-100000, -100000, 100000, 100000"
    stages = _stages(tmp_path, monkeypatch, sheets=STAND_IN_SHEETS.format(box=box))
    out = tmp_path / "out" / "export.json"
    document: Any = harness.run(dwg_set, out, stages=stages, conventions=_conventions(tmp_path))

    for reading in document["files"]:
        states = {name: report["state"] for name, report in reading["stages"].items()}
        for stage in ("read", "font_report", "bangla_ansi", "render_buffers", "rasterise"):
            assert states[stage] == "ok", (reading["path"], stage, reading["stages"][stage])
    by_path: dict[str, Any] = {f["path"]: f for f in document["files"]}
    assert by_path["S-title_block.dwg"]["font_report"]["single_stroke"] == 1  # romans.shx
    assert validate(document, load_schema()) == []
