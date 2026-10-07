"""Ticket T-LAUNCH, section 3 C (#310): a timed-out launch kills its whole process tree before
`default_claude` returns, and the debug log is read again after `LOG_GRACE` so a session created a
moment after the timeout is judged, stopped and listed for deletion."""

from __future__ import annotations

import contextlib
import importlib
import os
import signal
import sys
from pathlib import Path
from typing import Any

import pytest

from ._support import STOP, FakeClaude, World, cloned, cloud

# Typed Any: the seams this ticket adds do not exist on the base, and mypy must pass there.
launch: Any = importlib.import_module("scripts.factory.launch")


LATE = "session_01Late"

# A `claude` that forks a grandchild; both ignore SIGHUP and SIGTERM, the pids go to $FAKE_PIDS.
STUBBORN = """\
import os, signal, sys, time
signal.signal(signal.SIGHUP, signal.SIG_IGN)
signal.signal(signal.SIGTERM, signal.SIG_IGN)
child = os.fork()
if child == 0:
    time.sleep(600)
    os._exit(0)
with open(os.environ["FAKE_PIDS"], "w") as out:
    out.write(f"{os.getpid()} {child}\\n")
time.sleep(600)
"""


def gone(pid: int) -> bool:
    """Dead: no /proc entry, or a zombie waiting for its parent."""
    try:
        stat = Path(f"/proc/{pid}/stat").read_text()
    except OSError:
        return True
    return stat.rpartition(")")[2].split()[0] == "Z"


def test_c1_a_timed_out_launch_leaves_no_process_of_its_tree_alive(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake = bin_dir / "claude"
    fake.write_text(f"#!{sys.executable}\n{STUBBORN}")
    fake.chmod(0o755)
    pids_file = tmp_path / "pids.txt"
    monkeypatch.setenv("FAKE_PIDS", str(pids_file))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(launch, "LAUNCH_TIMEOUT", 1)
    monkeypatch.setattr(launch, "KILL_GRACE", 1)
    pids: list[int] = []
    try:
        code = launch.default_claude(["claude", "--debug-file", str(tmp_path / "x.log"), "--cloud", "x"])
        pids = [int(word) for word in pids_file.read_text().split()]
        assert code == launch.TIMED_OUT
        assert len(pids) == 2, pids
        alive = [pid for pid in pids if not gone(pid)]
        assert alive == [], f"still alive on return: {alive}"
    finally:
        if not pids and pids_file.exists():
            pids = [int(word) for word in pids_file.read_text().split()]
        for pid in pids:
            with contextlib.suppress(OSError):
                os.kill(pid, signal.SIGKILL)


def test_c2_a_session_created_after_the_timeout_is_judged_stopped_and_listed(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude(log=cloned(session=None), code=launch.TIMED_OUT)
    slept: list[float] = []

    def fake_sleep(seconds: float) -> None:
        slept.append(seconds)
        log = Path(claude.calls[0][claude.calls[0].index("--debug-file") + 1])
        with log.open("a") as out:
            out.write(f"[DEBUG] Successfully created remote session: {LATE}\n")

    code, lines = cloud(world, capsys, claude, sleep=fake_sleep)
    assert code == 2, lines
    assert lines[0].startswith("REFUSED launch-timeout: "), lines
    assert lines[0].endswith(f" {LATE}"), lines
    assert claude.calls[1:] == [["claude", "-p", STOP, "--cloud", LATE, "--output-format", "json"]]
    assert LATE in (world.records / "to-delete.txt").read_text().split()
    record = world.only_record()
    assert record["session_id"] == LATE
    assert record["stop_sent"] is True
    grace = launch.LOG_GRACE
    assert isinstance(grace, int | float)
    assert grace > 0
    assert slept == [grace]


@pytest.mark.parametrize("returned", [0, 1])
def test_c2_a_launch_that_finished_reads_the_log_without_waiting(
    world: World, capsys: pytest.CaptureFixture[str], returned: int
) -> None:
    claude = FakeClaude(code=returned)
    slept: list[float] = []
    cloud(world, capsys, claude, sleep=slept.append)
    assert slept == []
