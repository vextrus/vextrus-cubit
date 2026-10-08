"""Unit tests of the clock's durations and of status.py's tally."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import stamp, status


@pytest.mark.parametrize(
    ("text", "minutes"), [("90", 90), ("2h", 120), ("45m", 45), ("1h05m", 65), (" 3h ", 180)]
)
def test_durations(text: str, minutes: int) -> None:
    assert stamp.parse_minutes(text) == minutes


@pytest.mark.parametrize("text", ["", "0", "h", "1.5h", "5m3h", "-1"])
def test_bad_durations_are_refused(text: str) -> None:
    with pytest.raises(stamp.Refused):
        stamp.parse_minutes(text)


def test_hmm() -> None:
    assert stamp.hmm(0) == "0:00"
    assert stamp.hmm(665) == "11:05"


def test_the_builder_groups_tally_items_by_where_and_state() -> None:
    items: list[dict[str, Any]] = [
        {"where": "cloud", "state": "quiet", "quiet_minutes": 31},
        {"where": "cloud", "state": "quiet", "quiet_minutes": 45},
        {"where": "cloud", "state": "ready", "quiet_minutes": 2},
        {"where": "local", "state": "working", "quiet_minutes": None},
    ]
    cloud = status.builder_group(items, "cloud")
    assert cloud["quiet"] == 2
    assert cloud["ready"] == 1
    assert cloud["quiet_max_minutes"] == 45
    local = status.builder_group(items, "local")
    assert local["working"] == 1
    assert local["quiet_max_minutes"] is None


def test_a_missing_state_folder_is_made(tmp_path: Path) -> None:
    state = tmp_path / "a" / "b" / "STATE.md"
    stamp.make_state_folder(state)
    assert state.parent.is_dir()
    assert not state.exists()


def test_a_folder_or_a_file_parent_is_refused(tmp_path: Path) -> None:
    afile = tmp_path / "afile"
    afile.write_text("x\n")
    for state in (tmp_path, afile / "STATE.md"):
        with pytest.raises(stamp.Refused):
            stamp.make_state_folder(state)
    assert afile.read_text() == "x\n"


def test_end_archives_under_the_start_and_a_failed_line_keeps_the_session(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)  # outside a repository `end` measures nothing
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path / "factory"))
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-04T08:00:05Z")
    state = tmp_path / "s" / "STATE.md"
    stamp.start("2h", str(state), None, force=False)
    state.parent.rmdir()
    state.parent.write_text("not a folder\n")
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-04T10:30:00Z")
    with pytest.raises(stamp.Refused):
        stamp.end()
    assert stamp.session_path().exists()

    state.parent.unlink()
    state.parent.mkdir()
    archive = stamp.end()
    assert archive == state.parent / "session-20261004T080005Z.json"
    assert json.loads(archive.read_text())["ended_utc"] == "2026-10-04T10:30:00Z"
    assert state.read_text() == "2026-10-04T10:30:00Z session ended 2:29/2:00\n"
    assert not stamp.session_path().exists()
