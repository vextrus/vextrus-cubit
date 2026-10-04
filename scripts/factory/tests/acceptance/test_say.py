"""Ticket f3, 3.10 (tier 2, cut 2): talking to a local builder (`python -m scripts.factory.say`), spec
2.2 "Talk to a local builder".

    say <session> --file F (--elapsed n/m | --ticket T)

The session is a full `sessionId` (a UUID). The text is prefixed `[elapsed n/m min] `. A session that
is alive (`done`, or any row with a `pid`) gets the prefixed text printed for the orchestrator's
SendMessage and no `claude` call. A `stopped` or `failed` row with no `pid` is resumed: `claude
--resume <full id> --bg --settings <abs builder.settings.json> "<prefixed text>"`, where the settings
path is in the main checkout (the cwd's git common dir's parent). `stopped`/`failed` with a `pid` is
refused. A resume that prints a line starting `note:` (the CLI copied the conversation) exits 6 and
appends an `ALARM-RESUME-COPY` line to `$VEXTRUS_FACTORY_DIR/events.log`.

Black-box: the agents rows come from `VEXTRUS_AGENTS_FILE`; `claude` is a stub first on `PATH` that
records its argv and prints what the test sets.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-04T21:08:00Z"
SESSION = "0b5e2c71-9a3d-4e6f-8b1c-2d4e6f8a0b1c"
TEXT = "Round 1: two findings stand; fix the cap rule and push."
PREFIXED = f"[elapsed 42/150 min] {TEXT}"

STUB = """
import json, sys
open({log!r}, "a").write(json.dumps(sys.argv[1:]) + "\\n")
print(open({says!r}).read(), end="")
"""


class Say:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.main = tmp / "main"
        self.main.mkdir()
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=self.main, check=True)
        self.factory = tmp / "factory"
        self.factory.mkdir()
        self.agents = tmp / "agents.json"
        self.file = tmp / "message.txt"
        self.file.write_text(TEXT)
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.log = tmp / "claude.log"
        self.says = tmp / "claude-says.txt"
        self.says.write_text("resumed in the background\n")
        stub = self.stubs / "claude"
        stub.write_text(f"#!{sys.executable}\n" + STUB.format(log=str(self.log), says=str(self.says)))
        stub.chmod(0o755)

    def row(self, state: str, pid: int | None) -> None:
        entry: dict[str, Any] = {
            "id": "0b5e2c71",
            "cwd": str(self.main / ".claude" / "worktrees" / "t901"),
            "kind": "background",
            "startedAt": "2026-10-04T20:00:00Z",
            "sessionId": SESSION,
            "name": "t901-builder",
            "state": state,
        }
        if pid is not None:
            entry["pid"] = pid
        self.agents.write_text(json.dumps([entry]))

    def say(self, session: str = SESSION) -> subprocess.CompletedProcess[str]:
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
                session,
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

    def claude_calls(self) -> list[list[str]]:
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


@pytest.fixture
def say(tmp_path: Path) -> Say:
    return Say(tmp_path)


# Y1
def test_y1_a_session_that_is_not_a_full_uuid_is_refused(say: Say) -> None:
    say.row("stopped", None)
    done = say.say("0b5e2c71")
    assert done.returncode == 2, show(done)
    assert "No module named" not in done.stderr, show(done)
    assert say.claude_calls() == []


# Y2
@pytest.mark.parametrize(("state", "pid"), [("done", None), ("working", 4242), ("blocked", 4242)])
def test_y2_a_live_session_gets_the_prefixed_text_for_sendmessage_and_no_resume(
    say: Say, state: str, pid: int | None
) -> None:
    say.row(state, pid)
    done = say.say()
    assert done.returncode == 0, show(done)
    assert done.stdout.strip() == PREFIXED
    assert say.claude_calls() == []


# Y3
@pytest.mark.parametrize("state", ["stopped", "failed"])
def test_y3_a_stopped_session_with_no_pid_is_resumed_by_full_id_with_the_settings_again(
    say: Say, state: str
) -> None:
    say.row(state, None)
    done = say.say()
    assert done.returncode == 0, show(done)
    [call] = say.claude_calls()
    assert call[:4] == ["--resume", SESSION, "--bg", "--settings"]
    assert Path(call[4]).is_absolute()
    assert (
        Path(call[4]).resolve() == (say.main / "scripts" / "factory" / "builder.settings.json").resolve()
    )
    assert call[5:] == [PREFIXED]


# Y4
@pytest.mark.parametrize("state", ["stopped", "failed"])
def test_y4_a_stopped_session_that_still_has_a_pid_is_refused(say: Say, state: str) -> None:
    say.row(state, 4242)
    done = say.say()
    assert done.returncode != 0, show(done)
    assert "No module named" not in done.stderr, show(done)
    assert say.claude_calls() == []


# Y5
def test_y5_a_resume_that_copies_the_conversation_exits_6_and_alarms(say: Say) -> None:
    say.row("stopped", None)
    say.says.write_text("note: this conversation was copied into a new session\n")
    done = say.say()
    assert done.returncode == 6, show(done)
    events = (say.factory / "events.log").read_text().splitlines()
    assert any("ALARM-RESUME-COPY" in line for line in events), events
