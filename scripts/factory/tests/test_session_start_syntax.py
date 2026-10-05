"""A regression pin for the cloud scripts no other test runs: `scripts/cloud/session-start.sh` runs at
every cloud session start and `setup.sh` builds the VM's toolchain, so a syntax error in either breaks
every cloud session. Outside a cloud VM `session-start.sh` must leave at once, silently."""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
CLOUD = ROOT / "scripts" / "cloud"
BASH = shutil.which("bash") or "/bin/bash"


@pytest.mark.parametrize("name", ["session-start.sh", "setup.sh"])
def test_the_cloud_script_parses(name: str) -> None:
    done = subprocess.run([BASH, "-n", str(CLOUD / name)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stderr


def test_session_start_outside_a_cloud_vm_exits_0_with_no_output(tmp_path: Path) -> None:
    env = {k: v for k, v in os.environ.items() if k != "CLAUDE_CODE_REMOTE"}
    env["CLAUDE_PROJECT_DIR"] = str(tmp_path)
    env["CLAUDE_ENV_FILE"] = str(tmp_path / "env")
    done = subprocess.run(
        [BASH, str(CLOUD / "session-start.sh")], capture_output=True, text=True, env=env, check=False
    )
    assert (done.returncode, done.stdout, done.stderr) == (0, "", "")
    assert not (tmp_path / "env").exists()
