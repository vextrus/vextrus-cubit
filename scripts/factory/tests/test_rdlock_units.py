"""rdlock's `run` (review round 1, F2): a duplicate is refused before anything runs or rd.pid moves."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
HEAD = "ab" * 20


def rdlock(factory: Path, *args: str) -> subprocess.CompletedProcess[str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
    env.update(PYTHONPATH=str(REPO), VEXTRUS_FACTORY_DIR=str(factory))
    return subprocess.run(
        [sys.executable, "-m", "scripts.factory.rdlock", *args],
        cwd=factory,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=60,
        check=False,
    )


def test_a_run_for_a_held_head_and_kind_exits_5_and_runs_nothing(tmp_path: Path) -> None:
    factory = tmp_path / "work" / "factory"
    factory.mkdir(parents=True)
    held = rdlock(factory, "acquire", "--kind", "posting", "--head", HEAD, "--pid", str(os.getpid()))
    assert held.returncode == 0, held.stdout
    pidfile = factory / "rd.pid"
    pidfile.write_text(f"{os.getpid()}\n")  # the holder's own run
    marker = tmp_path / "marker"

    done = rdlock(factory, "run", "--kind", "posting", "--head", HEAD, "--", "touch", str(marker))

    assert done.returncode == 5, done.stdout + done.stderr
    assert not marker.exists(), "the command ran without the lock"
    assert pidfile.read_text() == f"{os.getpid()}\n", "rd.pid was changed or removed"
    assert not (tmp_path / "work" / "rd").exists() or not list((tmp_path / "work" / "rd").iterdir())
    status = rdlock(factory, "status")
    assert f"holder: posting {HEAD[:8]}" in status.stdout
