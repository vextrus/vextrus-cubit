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


def test_sheets_renders_the_first_sheets_the_finder_finds_and_prints_counts_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """13's `--sheets N`: the orchestrator's look at real sheets, each written as `<stem>-<j>`."""
    from engine.recognise.tests.drawing import Sheets, frame_block
    from engine.recognise.tests.test_sheets import placed_frame

    drawing = Sheets()
    block = frame_block(drawing)
    for i in range(3):
        placed_frame(drawing, block, (1000.0 * i, 0.0), {2: f"S-0{i + 1}", 0: "SECRET TITLE"})
    monkeypatch.setattr(command, "read", lambda path: drawing.artefact())

    assert command.main([str(tmp_path / "K.dwg"), "--out", str(tmp_path / "out"), "--sheets", "2"]) == 0

    written = sorted(p.name for p in (tmp_path / "out").iterdir())
    assert written == ["K-1.bin", "K-1@4.png", "K-2.bin", "K-2@4.png"]
    printed = capsys.readouterr().out
    assert "SECRET" not in printed
    assert "S-0" not in printed
    assert "3 sheets found; 2 rendered" in printed
    assert printed.count("paper 841 x 594 mm (source 1)") == 2
