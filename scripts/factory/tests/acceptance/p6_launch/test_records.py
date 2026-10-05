"""Ticket T-LAUNCH, section 3 D (#310): every non-usage outcome writes exactly one launch record; an
exit-1 run's judge is `{"ok": false, "code": "error", "reason": ...}` (contract launch-cli.md 5).
A usage error (exit 64) writes none; the refusal records are as before."""

from __future__ import annotations

import fcntl
import importlib
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from ._support import (
    BRANCH,
    RECORD_KEYS,
    TICKET,
    FakeClaude,
    World,
    cloud,
)

# Typed Any: the seams this ticket adds do not exist on the base, and mypy must pass there.
launch: Any = importlib.import_module("scripts.factory.launch")


def assert_one_error_record(world: World, lines: list[str]) -> None:
    files = world.record_files()
    assert len(files) == 1, [p.name for p in files]
    assert lines[-1].startswith("record: "), lines
    assert Path(lines[-1].removeprefix("record: ")).resolve() == files[0].resolve()
    record = world.only_record()
    assert set(record) == RECORD_KEYS
    judged = record["judge"]
    assert isinstance(judged, dict)
    assert set(judged) == {"ok", "code", "reason"}
    assert judged["ok"] is False
    assert judged["code"] == "error"
    assert isinstance(judged["reason"], str)
    assert judged["reason"]
    assert record["ticket"] == TICKET
    assert record["session_id"] is None
    assert record["stop_sent"] is False
    assert "PROMPT-BODY-7f3a" not in files[0].read_text()


def assert_error(code: int, lines: list[str]) -> None:
    assert code == 1, lines
    assert lines[0].startswith("ERROR "), lines
    assert not any("PROMPT-BODY-7f3a" in line for line in lines)


def test_d_an_unreadable_prompt_file_is_recorded(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    world.prompt.unlink()
    claude = FakeClaude()
    code, lines = cloud(world, capsys, claude)
    assert_error(code, lines)
    assert claude.calls == []
    assert_one_error_record(world, lines)


def test_d_an_existing_log_is_recorded(world: World, capsys: pytest.CaptureFixture[str]) -> None:
    old = world.tmp / "old.log"
    old.write_text("an earlier launch\n")
    claude = FakeClaude()
    code, lines = cloud(world, capsys, claude, "--log", str(old))
    assert_error(code, lines)
    assert old.read_text() == "an earlier launch\n"
    assert claude.calls == []
    assert_one_error_record(world, lines)


def test_d_a_held_proving_lock_is_recorded(world: World, capsys: pytest.CaptureFixture[str]) -> None:
    folder = world.main / ".private/work/factory"
    folder.mkdir(parents=True)
    fd = os.open(folder / "proven-cli.lock", os.O_CREAT | os.O_WRONLY, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        claude = FakeClaude()
        code, lines = cloud(world, capsys, claude)
    finally:
        os.close(fd)
    assert_error(code, lines)
    assert "proven-cli.lock" in lines[0]
    assert claude.calls == []
    assert_one_error_record(world, lines)


def test_d_a_missing_claude_is_recorded(world: World, capsys: pytest.CaptureFixture[str]) -> None:
    claude = FakeClaude(code=launch.NOT_FOUND)
    code, lines = cloud(world, capsys, claude)
    assert_error(code, lines)
    assert_one_error_record(world, lines)


def test_d_an_unreadable_acceptance_commit_is_recorded(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    world.fake_git("fetch")
    claude = FakeClaude()
    code, lines = cloud(world, capsys, claude)
    assert_error(code, lines)
    assert claude.calls == []
    assert_one_error_record(world, lines)


def test_d_a_usage_error_writes_no_record(world: World, capsys: pytest.CaptureFixture[str]) -> None:
    for request in (
        launch.CloudRequest(branch="a b", prompt_file=world.prompt, ticket=TICKET, effort="medium"),
        launch.CloudRequest(
            branch=BRANCH, prompt_file=world.prompt, ticket=TICKET, effort="medium", untestable=""
        ),
    ):
        request = launch.CloudRequest(**{**request.__dict__, "record_dir": world.records})
        code, _ = cloud(world, capsys, FakeClaude(), request=request)
        assert code == 64
        assert world.record_files() == []


def test_d_a_refusal_record_is_unchanged(world: World, capsys: pytest.CaptureFixture[str]) -> None:
    world.push_branch("s12-bare", acceptance=False)
    claude = FakeClaude()
    code, lines = cloud(world, capsys, claude, branch="s12-bare")
    assert code == 2, lines
    assert lines[0].startswith("REFUSED no-acceptance-commit: "), lines
    record = world.only_record()
    assert set(record) == RECORD_KEYS
    judged = record["judge"]
    assert isinstance(judged, dict)
    assert judged["ok"] is False
    assert judged["code"] == "no-acceptance-commit"


def test_addendum_2_started_at_is_whole_seconds(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    """The factory's canonical UTC form (`status.utc`), which the watcher reads; never microseconds."""
    moment = datetime(2026, 10, 5, 3, 42, 44, 196170, tzinfo=UTC)
    code, lines = cloud(world, capsys, FakeClaude(), now=moment)
    assert code == 0, lines
    started = world.only_record()["started_at"]
    assert isinstance(started, str)
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", started), started
    assert started == "2026-10-05T03:42:44Z"
