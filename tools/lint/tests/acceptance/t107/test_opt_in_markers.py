"""Ticket 107 (issue #107, finding 1): an acceptance test cannot hide behind an opt-in marker.

The rule pinned here. In CI's test run (`pytest -p tools.lint.acceptance_pytest`), an acceptance test
deselected by an opt-in marker is exempt only when
- the marker is one a CI job runs on the acceptance paths: `needs_toolchain` or `needs_bwrap`
  (engine.yml's `-m "needs_toolchain or needs_bwrap"`); never `live`, which no CI job runs; and
- the acceptance file's own source names that marker (a `@pytest.mark.<name>` or a `pytestmark`), so a
  conftest hook outside the acceptance paths cannot add it.
And engine.yml's opt-in runs load the same plugin, so an opt-in acceptance test skipped there fails too,
while the plain acceptance tests that run's `-m` leaves out (ci.yml runs them) do not.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
FOLDER = "vextrus/t/tests/acceptance/t99"
INI = """\
[pytest]
markers =
  needs_toolchain: x
  needs_bwrap: x
  live: x
addopts = -m 'not needs_toolchain and not needs_bwrap and not live'
"""


def run(root: Path, files: dict[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    """CI's test run on a throwaway project: the acceptance plugin loaded, the suite's opt-in markers
    deselected by `addopts` as the repository's pyproject.toml does."""
    (root / "pytest.ini").write_text(INI)
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "tools.lint.acceptance_pytest",
            "-p",
            "no:django",
            "-p",
            "no:cacheprovider",
            *args,
            FOLDER,
        ],
        cwd=root,
        env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True,
        text=True,
        check=False,
    )


def not_run(stdout: str) -> str:
    """The plugin's section naming the acceptance tests that did not run ('' when it printed none)."""
    marker = "acceptance tests that did not run"
    return stdout.split(marker, 1)[1] if marker in stdout else ""


HIDDEN_BY_A_HOOK = """\
import pytest


def pytest_collection_modifyitems(config, items):
    for item in items:
        if "accept" in str(item.path):
            item.add_marker(pytest.mark.needs_toolchain)
"""


def test_a_conftest_hook_marking_an_acceptance_test_opt_in_fails_the_run(tmp_path: Path) -> None:
    done = run(
        tmp_path,
        {
            "conftest.py": HIDDEN_BY_A_HOOK,
            f"{FOLDER}/test_a.py": "def test_hidden():\n    assert False\n",
        },
    )
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_hidden: deselected" in not_run(done.stdout), done.stdout


def test_a_hook_adding_needs_bwrap_is_refused_as_well(tmp_path: Path) -> None:
    done = run(
        tmp_path,
        {
            "vextrus/conftest.py": HIDDEN_BY_A_HOOK.replace("needs_toolchain", "needs_bwrap"),
            f"{FOLDER}/test_a.py": "def test_hidden():\n    assert False\n",
        },
    )
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_hidden: deselected" in not_run(done.stdout), done.stdout


def test_an_acceptance_test_marked_live_in_its_own_source_fails_the_run(tmp_path: Path) -> None:
    source = "import pytest\n\n\n@pytest.mark.live\ndef test_calls_jev():\n    assert False\n"
    done = run(tmp_path, {f"{FOLDER}/test_a.py": source})
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_calls_jev: deselected" in not_run(done.stdout), done.stdout


def test_a_module_wide_live_mark_fails_the_run(tmp_path: Path) -> None:
    source = (
        "import pytest\n\npytestmark = pytest.mark.live\n\n\ndef test_calls_jev():\n    assert False\n"
    )
    done = run(tmp_path, {f"{FOLDER}/test_a.py": source})
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_calls_jev: deselected" in not_run(done.stdout), done.stdout


TOOLCHAIN_IN_ITS_OWN_SOURCE = """\
import pytest

pytestmark = pytest.mark.needs_toolchain


def test_reads_a_drawing():
    assert True


@pytest.mark.needs_bwrap
def test_in_the_sandbox():
    assert True
"""


def test_needs_toolchain_or_needs_bwrap_named_in_the_file_itself_is_left_to_the_engine_workflow(
    tmp_path: Path,
) -> None:
    done = run(
        tmp_path,
        {
            f"{FOLDER}/test_a.py": TOOLCHAIN_IN_ITS_OWN_SOURCE,
            f"{FOLDER}/test_b.py": "def test_plain():\n    assert True\n",
        },
    )
    assert done.returncode == 0, done.stdout
    assert not_run(done.stdout) == "", done.stdout


SKIPPED_UNDER_THE_TOOLCHAIN = """\
import pytest

pytestmark = pytest.mark.needs_toolchain


@pytest.mark.skipif(True, reason="not today")
def test_reads_a_drawing():
    assert False


def test_runs():
    assert True
"""


def test_an_opt_in_acceptance_test_skipped_in_the_opt_in_run_fails_it(tmp_path: Path) -> None:
    done = run(
        tmp_path,
        {f"{FOLDER}/test_a.py": SKIPPED_UNDER_THE_TOOLCHAIN},
        "-m",
        "needs_toolchain or needs_bwrap",
    )
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_reads_a_drawing: skipped" in not_run(done.stdout), done.stdout


def test_the_opt_in_run_does_not_count_the_plain_acceptance_tests_it_leaves_to_ci(
    tmp_path: Path,
) -> None:
    done = run(
        tmp_path,
        {
            f"{FOLDER}/test_a.py": TOOLCHAIN_IN_ITS_OWN_SOURCE,
            f"{FOLDER}/test_b.py": "def test_plain():\n    assert True\n",
        },
        "-m",
        "needs_toolchain or needs_bwrap",
    )
    assert done.returncode == 0, done.stdout
    assert not_run(done.stdout) == "", done.stdout


OPT_IN_RUN = re.compile(r"""pytest\b[^\n]*-m\s+["']needs_toolchain or needs_bwrap["']""")


def test_every_opt_in_run_in_the_engine_workflow_loads_the_acceptance_plugin() -> None:
    text = (REPO / ".github/workflows/engine.yml").read_text()
    commands = re.sub(r"\\\n\s*", " ", text).splitlines()
    runs = [line for line in commands if OPT_IN_RUN.search(line)]
    assert runs, 'engine.yml runs no `pytest -m "needs_toolchain or needs_bwrap"`'
    for line in runs:
        assert "-p tools.lint.acceptance_pytest" in line, line.strip()
