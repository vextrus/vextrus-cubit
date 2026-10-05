"""T-XDIST (issue #248): the acceptance plugin (ADR 0041) fails a `-n` run as it fails the same run
serially. Under xdist the workers collect, deselect and run; the controller reports and sets the exit
status. Each case runs the same folder with `-n 2` and serially and compares the two."""

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
FOLDER = "vextrus/t/tests/acceptance/t99"
PLAIN = "vextrus/t/tests/plain"
INI = """\
[pytest]
markers =
  needs_toolchain: x
  needs_bwrap: x
  live: x
addopts = -m 'not needs_toolchain and not needs_bwrap and not live'
"""
MARKER = "acceptance tests that did not run"


def run(
    root: Path, files: dict[str, str], *args: str, folders: tuple[str, ...] = (FOLDER,)
) -> subprocess.CompletedProcess[str]:
    root.mkdir(parents=True, exist_ok=True)
    (root / "pytest.ini").write_text(INI)
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    plugins = ["-p", "tools.lint.acceptance_pytest", "-p", "no:django", "-p", "no:cacheprovider"]
    environ = {key: value for key, value in os.environ.items() if not key.startswith("PYTEST_XDIST_")}
    return subprocess.run(
        [sys.executable, "-m", "pytest", *plugins, *args, *folders],
        cwd=root,
        env={**environ, "PYTHONPATH": str(REPO)},
        capture_output=True,
        text=True,
        check=False,
    )


def not_run(stdout: str) -> str:
    return stdout.split(MARKER, 1)[1] if MARKER in stdout else ""


def flagged(stdout: str) -> list[str]:
    """The section's lines that name a test, sorted."""
    return sorted(line for line in not_run(stdout).splitlines() if "::" in line)


def both(
    root: Path, files: dict[str, str], *args: str, folders: tuple[str, ...] = (FOLDER,)
) -> tuple[subprocess.CompletedProcess[str], subprocess.CompletedProcess[str]]:
    serial = run(root / "serial", files, *args, folders=folders)
    workers = run(root / "workers", files, "-n", "2", *args, folders=folders)
    return serial, workers


def four(**bodies: str) -> dict[str, str]:
    """Four acceptance test files, so the two workers share them; `bodies` replaces a file's text."""
    files = {
        f"{FOLDER}/test_{letter}.py": f"def test_{letter}():\n    assert True\n" for letter in "abcd"
    }
    files.update({f"{FOLDER}/test_{letter}.py": text for letter, text in bodies.items()})
    return files


TWO_IN_B = "def test_b():\n    assert True\n\n\ndef test_gone():\n    assert True\n"


def test_a_deselected_acceptance_test_fails_the_run_once_as_it_does_serially(tmp_path: Path) -> None:
    serial, workers = both(tmp_path, four(b=TWO_IN_B), "-k", "not test_gone")
    assert serial.returncode == 1, serial.stdout

    assert workers.returncode == 1, workers.stdout
    assert not_run(workers.stdout).count("test_b.py::test_gone") == 1, workers.stdout
    assert (
        flagged(workers.stdout)
        == flagged(serial.stdout)
        == [f"{FOLDER}/test_b.py::test_gone: deselected"]
    ), workers.stdout


SKIPPED = "import pytest\n\n\n@pytest.mark.skip(reason='x')\ndef test_skipped():\n    assert True\n"
XFAILED = "import pytest\n\n\n@pytest.mark.xfail(reason='x')\ndef test_xfailed():\n    assert False\n"


def test_a_skipped_and_an_xfailed_acceptance_test_are_each_named_once(tmp_path: Path) -> None:
    serial, workers = both(tmp_path, four(a=SKIPPED, c=XFAILED))
    assert serial.returncode == 1, serial.stdout

    assert workers.returncode == 1, workers.stdout
    section = not_run(workers.stdout)
    assert section.count("test_a.py::test_skipped") == 1, workers.stdout
    assert section.count("test_c.py::test_xfailed") == 1, workers.stdout
    assert (
        flagged(workers.stdout)
        == flagged(serial.stdout)
        == [
            f"{FOLDER}/test_a.py::test_skipped: skipped",
            f"{FOLDER}/test_c.py::test_xfailed: xfailed or xpassed",
        ]
    ), workers.stdout


def test_a_run_where_every_acceptance_test_runs_passes_with_no_section(tmp_path: Path) -> None:
    serial, workers = both(tmp_path, four())

    assert serial.returncode == workers.returncode == 0, workers.stdout
    assert MARKER not in serial.stdout, serial.stdout
    assert MARKER not in workers.stdout, workers.stdout


ONE_WRITTEN_ONE_PLAIN = """\
import pytest


@pytest.mark.needs_toolchain
def test_written():
    assert True


def test_plain():
    assert True
"""


def test_the_engine_s_opt_in_run_leaves_an_unmarked_acceptance_test_to_ci(tmp_path: Path) -> None:
    serial, workers = both(
        tmp_path, four(d=ONE_WRITTEN_ONE_PLAIN), "-m", "needs_toolchain or needs_bwrap"
    )

    assert serial.returncode == workers.returncode == 0, workers.stdout
    assert MARKER not in serial.stdout, serial.stdout
    assert MARKER not in workers.stdout, workers.stdout


PLAIN_FILES = {
    f"{PLAIN}/test_plain_{letter}.py": (
        "import pytest\n\n\n"
        f"def test_kept_{letter}():\n    assert True\n\n\n"
        f"def test_left_out_{letter}():\n    assert True\n\n\n"
        f"@pytest.mark.skip(reason='x')\ndef test_skipped_{letter}():\n    assert True\n"
    )
    for letter in "ab"
}


def test_a_non_acceptance_test_left_out_is_never_flagged(tmp_path: Path) -> None:
    serial, workers = both(
        tmp_path, {**four(), **PLAIN_FILES}, "-k", "not test_left_out", folders=(FOLDER, PLAIN)
    )

    assert serial.returncode == workers.returncode == 0, workers.stdout
    assert MARKER not in serial.stdout, serial.stdout
    assert MARKER not in workers.stdout, workers.stdout
