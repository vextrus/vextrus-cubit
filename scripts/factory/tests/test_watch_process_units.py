"""The watcher as a process (review round 1, F1): one loop per run folder, `ensure`'s child names
watch.py on its command line, and the script form runs under the machine's own `python3`."""

from __future__ import annotations

import json
import os
import select
import shutil
import signal
import subprocess
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.serial  # signals and process groups: not under xdist (see ci.yml)

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "scripts" / "factory" / "watch.py"
NOW = "2026-10-04T21:08:00Z"


def stop(pid: int) -> None:
    """SIGTERM a process and wait (bounded, by pidfd) for it to go."""
    try:
        handle = os.pidfd_open(pid)
    except ProcessLookupError:
        return
    try:
        os.kill(pid, signal.SIGTERM)
        if not select.select([handle], [], [], 30)[0]:
            os.kill(pid, signal.SIGKILL)
    finally:
        os.close(handle)


def wait_for_pidfile(path: Path, pid: int) -> None:
    handle = os.pidfd_open(pid)
    try:
        for _ in range(600):
            if path.exists() and path.read_text().strip() == str(pid):
                return
            assert not select.select([handle], [], [], 0.05)[0], "the watcher exited"
    finally:
        os.close(handle)
    raise AssertionError(f"{path} never named {pid}")


@pytest.fixture
def world(tmp_path: Path) -> tuple[Path, dict[str, str]]:
    """A run folder, a cwd that is no repository (so no git reaches a network) and every seam set."""
    factory = tmp_path / "factory"
    factory.mkdir()
    stubs = tmp_path / "stubs"
    stubs.mkdir()
    for name in ("claude", "gh"):
        (stubs / name).write_text("#!/bin/sh\nexit 1\n")
        (stubs / name).chmod(0o755)
    seams = {
        "VEXTRUS_MEMINFO_FILE": "MemAvailable: 16777216 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n",
        "VEXTRUS_DF_FILE": "Avail\n62914560\n",
        "VEXTRUS_USAGE_FILE": "Current session: 12% used\nCurrent week (all models): 27% used\n",
        "VEXTRUS_AGENTS_FILE": "[]",
        "VEXTRUS_PRS_FILE": "[]",
    }
    env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
    for name, text in seams.items():
        (tmp_path / name).write_text(text)
        env[name] = str(tmp_path / name)
    env.update(
        PATH=f"{stubs}{os.pathsep}{env['PATH']}",
        PYTHONPATH=str(REPO),
        VEXTRUS_FACTORY_DIR=str(factory),
        VEXTRUS_NOW=NOW,
        VEXTRUS_LEAKSCAN_CMD=str(tmp_path / "no-scanner"),
        VEXTRUS_JEV_CMD=str(tmp_path / "no-jev"),
        GIT_ALLOW_PROTOCOL="file",
    )
    return factory, env


def test_two_loops_on_one_run_folder_leave_exactly_one_alive(world: tuple[Path, dict[str, str]]) -> None:
    factory, env = world
    argv = [sys.executable, "-m", "scripts.factory.watch", "run", "--interval", "3600"]
    first = subprocess.Popen(argv, cwd=factory, env=env, stdin=subprocess.DEVNULL)
    try:
        wait_for_pidfile(factory / "watch.pid", first.pid)
        second = subprocess.run(argv, cwd=factory, env=env, capture_output=True, text=True, timeout=60)
        assert second.returncode == 0, second.stderr
        assert second.stdout.strip() == f"running {first.pid}"
        assert first.poll() is None, "the first watcher died"
        assert (factory / "watch.pid").read_text().strip() == str(first.pid)

        # The reproduction: a failed spawn left watch.pid naming a dead pid while the first still runs.
        dead = subprocess.Popen(["true"])
        dead.wait()
        (factory / "watch.pid").write_text(f"{dead.pid}\n")
        third = subprocess.run(argv, cwd=factory, env=env, capture_output=True, text=True, timeout=30)
        assert third.returncode == 0, third.stderr
        assert third.stdout.startswith("running"), third.stdout
        assert first.poll() is None, "the first watcher died"
    finally:
        stop(first.pid)
        first.wait(timeout=30)


def test_ensure_starts_the_script_form_and_a_second_ensure_finds_it(
    world: tuple[Path, dict[str, str]],
) -> None:
    factory, env = world
    argv = [sys.executable, "-m", "scripts.factory.watch", "ensure"]
    done = subprocess.run(argv, cwd=factory, env=env, capture_output=True, text=True, timeout=60)
    assert done.returncode == 0, done.stderr
    pid = int(done.stdout.split()[1])
    try:
        assert done.stdout.strip() == f"started {pid}"
        cmdline = Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0")
        assert any(arg.endswith(b"scripts/factory/watch.py") for arg in cmdline), cmdline
        again = subprocess.run(argv, cwd=factory, env=env, capture_output=True, text=True, timeout=60)
        assert again.stdout.strip() == f"running {pid}"
    finally:
        stop(pid)


def system_python3() -> str | None:
    """The first `python3` on PATH in a folder outside this test's own virtual environment."""
    venv = Path(sys.prefix).resolve()
    for folder in os.environ.get("PATH", "").split(os.pathsep):
        if not folder or Path(folder).resolve().is_relative_to(venv):
            continue
        found = shutil.which("python3", path=folder)
        if found:
            return found
    return None


def test_the_script_form_runs_under_the_machines_python3(world: tuple[Path, dict[str, str]]) -> None:
    python3 = system_python3()
    if python3 is None:
        pytest.skip("no python3 on PATH outside the virtual environment")
    factory, env = world
    env = {k: v for k, v in env.items() if k != "PYTHONPATH"}
    done = subprocess.run(
        [python3, str(SCRIPT), "--once"],
        cwd=factory,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    version = subprocess.run([python3, "--version"], capture_output=True, text=True, check=False).stdout
    assert done.returncode == 0, f"{python3} ({version.strip()}): {done.stderr}"
    assert json.loads((factory / "status.json").read_text())["written_at"] == NOW
