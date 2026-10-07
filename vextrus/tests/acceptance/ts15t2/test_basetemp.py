"""Ticket S15-T2 (issue #532): "pytest basetemp bounded (#243)". #243: "/tmp/pytest-of-riz held 18.5 GB
(parallel builders' suites with large DWG/PDF fixtures) and ... filled the disk"; its fix names
`tmp_path_retention_policy = "failed"`, whose meaning in pytest's own words is "retains directories only
for tests with outcome error or failed". Session 11 also left 2,778 test storage folders in /tmp
(`vextrus/settings/test.py`), outside pytest's folder and so outside any retention bound.

Each test runs an inner pytest session on a probe (`probes/`) with the repository's configuration, its
temporary root (`PYTEST_DEBUG_TEMPROOT`, pytest's own override, and `TMPDIR`) in this test's folder:

- a failed run keeps the failed test's own folder and nothing else of its basetemp (no passing test's
  folder, no session fixture's folder): what a failed run leaves is bounded by what failed;
- a killed run (SIGKILL: no `atexit`) leaves the files the tests stored only in the run's own basetemp
  (`pytest-of-<user>/pytest-<n>/`), which pytest's retention count bounds; nothing loose in the root.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
PROBES = Path(__file__).with_name("probes")


def probe_environ(root: Path, temp: Path) -> dict[str, str]:
    """The outer environment without pytest's and xdist's variables or a fixed storage root."""
    environ = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PYTEST_") and key != "VEXTRUS_TEST_STORAGE_ROOT"
    }
    environ["PYTEST_DEBUG_TEMPROOT"] = str(root)
    environ["TMPDIR"] = str(temp)
    return environ


def inner(probe: str, root: Path, temp: Path) -> subprocess.CompletedProcess[str]:
    root.mkdir(exist_ok=True)
    temp.mkdir(exist_ok=True)
    return subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "no:cacheprovider", "-q", "-rf", str(PROBES / probe)],
        cwd=REPO,
        env=probe_environ(root, temp),
        capture_output=True,
        text=True,
        check=False,
    )


def files_under(folder: Path) -> list[Path]:
    return sorted(path for path in folder.rglob("*") if path.is_file() and not path.is_symlink())


def test_a_failed_run_keeps_only_its_failed_tests_own_folder(tmp_path: Path) -> None:
    root = tmp_path / "root"
    done = inner("probe_tmp.py", root, root)
    assert done.returncode == 1, done.stdout[-3000:] + done.stderr[-3000:]
    assert "1 failed, 1 passed" in done.stdout, done.stdout[-3000:]

    kept = [path.name for path in files_under(root)]

    assert "failed-test.txt" in kept, f"the failed test's own folder was not kept: {kept}"
    assert kept == ["failed-test.txt"], f"a failed run kept more than its failed test's folder: {kept}"


def test_a_killed_run_leaves_its_stored_files_only_under_pytests_folder(tmp_path: Path) -> None:
    root = tmp_path / "root"
    done = inner("probe_kill.py", root, root)
    assert done.returncode == -9, done.stdout[-3000:] + done.stderr[-3000:]

    stored = [path for path in files_under(root) if path.name == "probe-stored.bin"]
    assert len(stored) == 1, f"the probe's stored file is not in the temporary root: {files_under(root)}"
    loose = sorted(entry.name for entry in root.iterdir() if not entry.name.startswith("pytest-of-"))

    assert loose == [], f"a killed run left folders outside pytest's own: {loose}"
    # In the run's own numbered basetemp (`pytest-of-<user>/pytest-<n>/...`), which the count bounds.
    parts = stored[0].relative_to(root).parts
    assert re.fullmatch(r"pytest-\d+", parts[1]), f"stored outside the run's basetemp: {parts}"
