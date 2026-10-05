"""Ticket f3, 3.7: `scripts/factory/orchestrator.sh`, the orchestrator's start (spec 2.2 "Start").

It refuses while `$VEXTRUS_FACTORY_DIR/g1.pid` or `rd.pid` names a live run it would orphan; runs
`uv run --no-sync python -m scripts.factory.watch ensure` (a failure only warns); drops the two Remote
Control killers from the environment; then execs `claude --model claude-opus-5-5 --settings
<repo>/scripts/factory/orchestrator.settings.json [--plugin-dir <repo>/tools/mod/vextrus-factory]
"$@"` with `VEXTRUS_ROLE=orchestrator` and `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS=8`, where
`<repo>` is the script's own repository whatever the cwd. `--plugin-dir` is dropped when
`$VEXTRUS_FACTORY_DIR/mod-disabled` exists.

Black-box: `bash <script> <args>` from a temporary cwd, with `claude` and `uv` stubs first on `PATH` that
record their argv, environment and order.
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
SCRIPT = REPO / "scripts" / "factory" / "orchestrator.sh"
CALLER_ARGS = ["--resume", "0b5e2c71-9a3d-4e6f-8b1c-2d4e6f8a0b1c", "--name", "two words"]
REMOTE_CONTROL_KILLERS = {"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1", "DISABLE_GROWTHBOOK": "1"}

STUB = """
import json, os, sys
with open({log!r}, "a") as log:
    log.write(json.dumps({{"who": {who!r}, "argv": sys.argv[1:], "env": dict(os.environ)}}) + "\\n")
sys.exit({code})
"""


class Start:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.cwd = tmp / "elsewhere"
        self.cwd.mkdir()
        self.factory = tmp / "factory"
        self.factory.mkdir()
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.log = tmp / "calls.log"
        self.stub("claude", 0)
        self.stub("uv", 0)

    def stub(self, name: str, code: int) -> None:
        path = self.stubs / name
        path.write_text(f"#!{sys.executable}\n" + STUB.format(log=str(self.log), who=name, code=code))
        path.chmod(0o755)

    def run(self, extra_env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        for key in (*REMOTE_CONTROL_KILLERS, "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS"):
            env.pop(key, None)
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}", VEXTRUS_FACTORY_DIR=str(self.factory)
        )
        env.update(extra_env or {})
        return subprocess.run(
            ["bash", str(SCRIPT), *CALLER_ARGS],
            cwd=self.cwd,
            env=env,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def calls(self, who: str | None = None) -> list[dict[str, Any]]:
        if not self.log.exists():
            return []
        found = [json.loads(line) for line in self.log.read_text().splitlines()]
        return [call for call in found if who is None or call["who"] == who]


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def same_path(actual: str, expected: Path) -> bool:
    return os.path.isabs(actual) and os.path.realpath(actual) == os.path.realpath(expected)


def dead_pid() -> int:
    finished = subprocess.Popen(["true"])
    finished.wait()
    return finished.pid


@pytest.fixture
def start(tmp_path: Path) -> Start:
    return Start(tmp_path)


# O1
def test_o1_claude_gets_the_model_settings_and_plugin_dir_then_the_callers_arguments(
    start: Start,
) -> None:
    done = start.run()
    assert done.returncode == 0, show(done)
    [call] = start.calls("claude")
    argv = call["argv"]
    assert argv[:3] == ["--model", "claude-opus-5-5", "--settings"]
    assert same_path(argv[3], REPO / "scripts" / "factory" / "orchestrator.settings.json"), argv
    assert argv[4] == "--plugin-dir"
    assert same_path(argv[5], REPO / "tools" / "mod" / "vextrus-factory"), argv
    assert argv[6:] == CALLER_ARGS
    assert call["env"].get("VEXTRUS_ROLE") == "orchestrator"
    assert call["env"].get("CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS") == "8"


# O2
def test_o2_mod_disabled_drops_the_plugin_dir(start: Start) -> None:
    (start.factory / "mod-disabled").write_text("")
    done = start.run()
    assert done.returncode == 0, show(done)
    [call] = start.calls("claude")
    assert "--plugin-dir" not in call["argv"]
    assert call["argv"][-len(CALLER_ARGS) :] == CALLER_ARGS


# O3
def test_o3_the_remote_control_killers_never_reach_claude(start: Start) -> None:
    done = start.run(REMOTE_CONTROL_KILLERS)
    assert done.returncode == 0, show(done)
    [call] = start.calls("claude")
    for key in REMOTE_CONTROL_KILLERS:
        assert key not in call["env"]


# O4
@pytest.mark.parametrize("pidfile", ["g1.pid", "rd.pid"])
def test_o4_a_live_walk_or_real_drawing_run_refuses_the_start(start: Start, pidfile: str) -> None:
    live = os.getpid()
    (start.factory / pidfile).write_text(f"{live}\n")
    done = start.run()
    assert done.returncode != 0, show(done)
    said = done.stdout + done.stderr
    assert pidfile in said, show(done)
    assert str(live) in said, show(done)
    assert start.calls("claude") == []

    (start.factory / pidfile).write_text(f"{dead_pid()}\n")
    (start.factory / "watch.pid").write_text(f"{live}\n")
    done = start.run()
    assert done.returncode == 0, show(done)
    assert len(start.calls("claude")) == 1


# O5
@pytest.mark.parametrize("ensure_exit", [0, 1])
def test_o5_the_watcher_is_ensured_first_and_a_failure_only_warns(
    start: Start, ensure_exit: int
) -> None:
    start.stub("uv", ensure_exit)
    done = start.run()
    assert done.returncode == 0, show(done)
    calls = start.calls()
    assert [call["who"] for call in calls] == ["uv", "claude"], calls
    assert calls[0]["argv"] == ["run", "--no-sync", "python", "-m", "scripts.factory.watch", "ensure"]
    if ensure_exit:
        assert "warn" in (done.stdout + done.stderr).lower(), show(done)
