"""Ticket T-LOCAL, Addendum 1 (the orchestrator's replacement, 5 Oct 2026): `python -m
scripts.factory.say` judges a local builder's liveness by its `pid`, not its `state`.

After a power cut, dead local sessions kept rows reading `done`, `failed` or `blocked`, with no `pid`;
live sessions carry one. So:
- a row with a `pid` is alive: the prefixed text is printed for SendMessage and no `claude` runs;
- a row with no `pid` is not running, whatever its `state`: it is resumed in its own folder
  (`claude --resume <id> --bg ...`), as `stopped` and `failed` rows already are;
- a row whose `cwd` is not under `<main checkout>/.claude/worktrees/` is refused (exit 2), and no
  `claude` runs.

Black-box, as `test_say.py` (its helper is copied, never imported): the agents rows come from
`VEXTRUS_AGENTS_FILE`; `claude` is a stub first on `PATH` that records its argv and cwd.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[5]
NOW = "2026-10-04T21:08:00Z"
SESSION = "0b5e2c71-9a3d-4e6f-8b1c-2d4e6f8a0b1c"
TEXT = "Round 1: two findings stand; fix the cap rule and push."
PREFIXED = f"[elapsed 42/150 min] {TEXT}"

STUB = """
import json, os, sys
open({log!r}, "a").write(json.dumps({{"argv": sys.argv[1:], "cwd": os.getcwd()}}) + "\\n")
print("resumed in the background")
"""


class Say:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.main = tmp / "main"
        self.main.mkdir()
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=self.main, check=True)
        self.worktree = self.main / ".claude" / "worktrees" / "t901"
        self.worktree.mkdir(parents=True)
        self.factory = tmp / "factory"
        self.factory.mkdir()
        self.agents = tmp / "agents.json"
        self.file = tmp / "message.txt"
        self.file.write_text(TEXT)
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.log = tmp / "claude.log"
        stub = self.stubs / "claude"
        stub.write_text(f"#!{sys.executable}\n" + STUB.format(log=str(self.log)))
        stub.chmod(0o755)

    def row(self, state: str, pid: int | None, cwd: Path | str | None = None) -> None:
        entry: dict[str, Any] = {
            "id": "0b5e2c71",
            "cwd": str(self.worktree if cwd is None else cwd),
            "kind": "background",
            "startedAt": "2026-10-04T20:00:00Z",
            "sessionId": SESSION,
            "name": "t901-builder",
            "state": state,
        }
        if pid is not None:
            entry["pid"] = pid
        self.agents.write_text(json.dumps([entry]))

    def say(self) -> subprocess.CompletedProcess[str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_NOW=NOW,
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_AGENTS_FILE=str(self.agents),
        )
        return subprocess.run(
            [
                sys.executable,
                "-m",
                "scripts.factory.say",
                SESSION,
                "--file",
                str(self.file),
                "--elapsed",
                "42/150",
            ],
            cwd=self.main,
            env=env,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def claude_calls(self) -> list[dict[str, Any]]:
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


@pytest.fixture
def say(tmp_path: Path) -> Say:
    return Say(tmp_path)


# S1, S2: `done` and `blocked` with no pid (the power cut's rows), and any other state with no pid.
@pytest.mark.parametrize("state", ["done", "blocked", "working"])
def test_s1_a_row_with_no_pid_is_resumed_in_its_own_folder_whatever_its_state(
    say: Say, state: str
) -> None:
    say.row(state, None)
    done = say.say()
    assert done.returncode == 0, show(done)
    [call] = say.claude_calls()
    argv = call["argv"]
    assert argv[:2] == ["--resume", SESSION], argv
    assert "--bg" in argv, argv
    assert argv[-1] == PREFIXED, argv
    assert Path(call["cwd"]).resolve() == say.worktree.resolve()


# S3
@pytest.mark.parametrize("state", ["done", "working"])
def test_s3_a_row_with_a_pid_gets_the_text_for_sendmessage_and_no_claude(say: Say, state: str) -> None:
    say.row(state, 4242)
    done = say.say()
    assert done.returncode == 0, show(done)
    assert done.stdout.strip() == PREFIXED
    assert say.claude_calls() == []


# S4
@pytest.mark.parametrize("where", ["elsewhere", "main checkout", "dot-dot out of the worktrees"])
@pytest.mark.parametrize("state", ["stopped", "done"])
def test_s4_a_row_whose_cwd_is_outside_the_worktrees_folder_is_refused(
    say: Say, where: str, state: str
) -> None:
    elsewhere = say.tmp / "elsewhere"
    elsewhere.mkdir()
    cwd = {
        "elsewhere": str(elsewhere),
        "main checkout": str(say.main),
        "dot-dot out of the worktrees": f"{say.main}/.claude/worktrees/../../../elsewhere",
    }[where]
    say.row(state, None, cwd)
    done = say.say()
    assert done.returncode == 2, show(done)
    assert say.claude_calls() == []
