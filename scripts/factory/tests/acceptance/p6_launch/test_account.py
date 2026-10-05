"""Ticket T-LAUNCH, section 3 A (#301): the launcher refuses a launch from another account's config.
CLAUDE.md law: the default config `~/.claude` is account A and runs the orchestrator and every
builder; a session can message only sessions of its own config. Seams fixed by the ticket:
`launch.account_problem(environ, home) -> str | None` and `launch.main([...])`."""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

import pytest

from ._support import TICKET, World

# Typed Any: the seams this ticket adds do not exist on the base, and mypy must pass there.
launch: Any = importlib.import_module("scripts.factory.launch")


def main_code(argv: list[str], capsys: pytest.CaptureFixture[str]) -> tuple[int, list[str]]:
    capsys.readouterr()
    try:
        code = launch.main(argv)
    except SystemExit as stopped:
        code = stopped.code if isinstance(stopped.code, int) else 1
    return code, capsys.readouterr().out.splitlines()


def interim(world: World) -> list[str]:
    """`cloud`'s valid arguments on a tree with no leak scan or governor (the tmp main checkout)."""
    return world.argv(
        "--preflight", "df: 41G avail; free: 9.1Gi", "--prompt-scanned", "lits2: 0 literals"
    )


def test_a1_account_a_or_no_variable_is_no_problem(tmp_path: Path) -> None:
    home = tmp_path / "home"
    (home / ".claude").mkdir(parents=True)
    link = tmp_path / "link-to-claude"
    link.symlink_to(home / ".claude")
    for environ in (
        {},
        {"CLAUDE_CONFIG_DIR": ""},
        {"CLAUDE_CONFIG_DIR": str(home / ".claude")},
        {"CLAUDE_CONFIG_DIR": str(home / ".claude") + "/"},
        {"CLAUDE_CONFIG_DIR": str(link)},
    ):
        assert launch.account_problem(environ, home) is None, environ


def test_a1_another_config_is_a_one_line_reason_naming_the_variable(tmp_path: Path) -> None:
    home = tmp_path / "home"
    (home / ".claude").mkdir(parents=True)
    for other in (home / ".claude-b", home / ".claude-a", Path("/elsewhere/.claude")):
        problem = launch.account_problem({"CLAUDE_CONFIG_DIR": str(other)}, home)
        assert isinstance(problem, str), other
        assert problem.strip(), other
        assert "\n" not in problem.strip(), problem
        assert "CLAUDE_CONFIG_DIR" in problem
        assert "Traceback" not in problem


def test_a2_cloud_from_another_account_is_refused_recorded_and_runs_no_claude(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(world.tmp / ".claude-b"))
    code, lines = main_code(["cloud", *interim(world)], capsys)
    assert code == 2, lines
    assert lines, lines
    assert lines[0].startswith("REFUSED wrong-account: "), lines
    # The record's agents snapshot (`claude agents --json --all`) is the record's, not a launch.
    ran = [call for call in world.claude_calls() if call[:1] != ["agents"]]
    assert ran == [], "no launch, no message, not even --version"
    record = world.only_record()
    judged = record["judge"]
    assert isinstance(judged, dict)
    assert judged["code"] == "wrong-account"
    assert judged["ok"] is False
    assert record["session_id"] is None
    assert record["stop_sent"] is False
    assert record["ticket"] == TICKET


def test_a2_local_from_another_account_is_refused_and_runs_nothing(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    import scripts.factory.local as local

    ran: list[list[str]] = []

    def spy(argv: list[str]) -> int:
        ran.append(list(argv))
        return 0

    monkeypatch.setattr(local, "main", spy)
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(world.tmp / ".claude-b"))
    argv = ["local", "--ticket", "x1", "--branch", "s12-x", "--effort", "medium", "--name", "x1"]
    code, lines = main_code([*argv, "--prompt-file", str(world.prompt)], capsys)
    assert code == 2, lines
    assert lines, lines
    assert lines[0].startswith("REFUSED wrong-account: "), lines
    assert ran == []
    assert world.claude_calls() == []


def test_a2_say_from_another_account_is_refused_and_sends_nothing(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    from ._support import clean_scan

    monkeypatch.setattr(launch, "default_scan", lambda root: clean_scan)
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(world.tmp / ".claude-b"))
    message = world.tmp / "message.md"
    message.write_text("Round 1: MESSAGE-BODY-41c9.\n")
    argv = ["say", "session_01X", "--file", str(message), "--elapsed", "1/60"]
    code, lines = main_code(argv, capsys)
    assert code == 2, lines
    assert lines, lines
    assert lines[0].startswith("REFUSED wrong-account: "), lines
    assert world.claude_calls() == []


def test_a2_a_usage_error_still_exits_64_first(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(world.tmp / ".claude-b"))
    argv = interim(world)
    argv[argv.index("--branch") + 1] = "a b"
    code, _ = main_code(["cloud", *argv], capsys)
    assert code == 64
    assert world.record_files() == []
    assert world.claude_calls() == []


def test_a3_account_a_still_launches(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    for name, value in (("unset", None), ("same", str(world.home / ".claude"))):
        if value is None:
            monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
        else:
            monkeypatch.setenv("CLAUDE_CONFIG_DIR", value)
        argv = interim(world)
        argv[argv.index("--record-dir") + 1] = str(world.tmp / f"records-{name}")
        code, lines = main_code(["cloud", *argv], capsys)
        assert code == 0, (name, lines)
        assert lines[0].startswith("OK "), lines
        launches = [c for c in world.claude_calls() if "--debug-file" in c]
        assert len(launches) == 1, (name, launches)
        world.calls_file.unlink()
