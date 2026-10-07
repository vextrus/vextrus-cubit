"""A failed run under pytest-xdist (the suite's normal mode) keeps only the failed tests' own folders:
a worker that passed keeps nothing, though pytest never removes a basetemp it was given (#243)."""

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROBES = Path(__file__).with_name("probes_basetemp")


def test_a_failed_run_under_xdist_leaves_only_the_failed_tests_folder(tmp_path: Path) -> None:
    root = tmp_path / "root"
    root.mkdir()
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith("PYTEST_") and k != "VEXTRUS_TEST_STORAGE_ROOT"
    }
    env["PYTEST_DEBUG_TEMPROOT"] = str(root)
    env["TMPDIR"] = str(root)
    done = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            "-q",
            "-n",
            "2",
            "--dist",
            "loadfile",
            str(PROBES / "probe_failing.py"),
            str(PROBES / "probe_passing.py"),
        ],
        cwd=REPO,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 1, done.stdout[-3000:] + done.stderr[-3000:]
    kept = sorted(p.name for p in root.rglob("*") if p.is_file() and not p.is_symlink())
    assert kept == ["failed-test.txt"], kept
