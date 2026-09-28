"""`python -m engine.render`: one sheet of a drawing to its buffers and a PNG, printing counts only."""

from pathlib import Path

import pytest

from engine.render import __main__ as command
from engine.render.buffers import SheetBuffers
from engine.render.fixtures.make import tiny_sheet


def test_it_writes_the_buffers_and_the_raster_and_prints_no_drawing_text(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(command, "read", lambda path: tiny_sheet()[0])
    assert (
        command.main(
            [str(tmp_path / "S-01.dwg"), "--out", str(tmp_path / "out"), "--box", "0,0,210,148"]
        )
        == 0
    )

    written = sorted(p.name for p in (tmp_path / "out").iterdir())
    assert written == ["S-01.bin", "S-01@4.png"]
    assert len(SheetBuffers.from_bytes((tmp_path / "out" / "S-01.bin").read_bytes()).lines) > 0
    printed = capsys.readouterr().out
    assert "BEAM" not in printed
    assert "paper 210 x 148 mm" in printed


def test_with_no_box_it_draws_model_spaces_extents(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(command, "read", lambda path: tiny_sheet()[0])
    assert command.main([str(tmp_path / "x.dwg"), "--out", str(tmp_path)]) == 0
