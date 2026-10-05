"""say.py's liveness and folder rules (T-LOCAL fix round 1), black-box through `python -m
scripts.factory.say` with the `VEXTRUS_AGENTS_FILE` seam and a `claude` stub that logs its calls."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[3]
SESSION = "0b5e2c71-9a3d-4e6f-8b1c-2d4e6f8a0b1c"
TEXT = "Round 1: fix it."
PREFIXED = f"[elapsed 1/30 min] {TEXT}"
STUB = """
import json, os, sys
open({log!r}, "a").write(json.dumps({{"argv": sys.argv[1:], "cwd": os.getcwd()}}) + "\\n")
"""


class Say:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.main = tmp / "main"
        self.main.mkdir()
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=self.main, check=True)
        self.worktree = self.main / ".claude" / "worktrees" / "t901"
        self.worktree.mkdir(parents=True)
        self.agents = tmp / "agents.json"
        self.file = tmp / "message.txt"
        self.file.write_text(TEXT)
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.log = tmp / "claude.log"
        stub = self.stubs / "claude"
        stub.write_text(f"#!{sys.executable}\n" + STUB.format(log=str(self.log)))
        stub.chmod(0o755)

    def rows(self, *rows: dict[str, Any]) -> None:
        base = {"sessionId": SESSION, "name": "t901-builder", "cwd": str(self.worktree)}
        self.agents.write_text(json.dumps([{**base, **row} for row in rows]))

    def say(self) -> subprocess.CompletedProcess[str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_FACTORY_DIR=str(self.tmp / "factory"),
            VEXTRUS_AGENTS_FILE=str(self.agents),
        )
        argv = ["--file", str(self.file), "--elapsed", "1/30"]
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.say", SESSION, *argv],
            cwd=self.main,
            env=env,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def calls(self) -> list[dict[str, Any]]:
        return (
            [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
        )


@pytest.fixture
def say(tmp_path: Path) -> Say:
    return Say(tmp_path)


@pytest.mark.parametrize("first", ["done", "blocked"])
def test_an_attached_session_with_a_live_interactive_row_is_never_resumed(say: Say, first: str) -> None:
    say.rows(
        {"kind": "background", "state": first}, {"kind": "interactive", "state": "working", "pid": 77}
    )
    done = say.say()
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == PREFIXED
    assert say.calls() == []


def test_the_live_row_wins_whichever_order_the_rows_come_in(say: Say) -> None:
    say.rows(
        {"kind": "interactive", "state": "working", "pid": 77}, {"kind": "background", "state": "done"}
    )
    done = say.say()
    assert done.stdout.strip() == PREFIXED
    assert say.calls() == []


def test_a_row_whose_folder_was_removed_is_refused(say: Say) -> None:
    say.rows({"state": "done"})
    say.worktree.rmdir()
    assert say.say().returncode == 2
    assert say.calls() == []


def test_a_row_whose_folder_is_a_file_is_refused(say: Say) -> None:
    say.worktree.rmdir()
    say.worktree.write_text("")
    say.rows({"state": "done"})
    assert say.say().returncode == 2
    assert say.calls() == []


def test_a_resume_runs_in_the_rows_own_folder(say: Say) -> None:
    say.rows({"state": "blocked"})
    done = say.say()
    assert done.returncode == 0, done.stderr
    [call] = say.calls()
    assert Path(call["cwd"]).resolve() == say.worktree.resolve()
    assert call["argv"][:3] == ["--resume", SESSION, "--bg"]
