"""The acceptance plugin reads a test's opt-in marks as written in its file, per test (issue #107, the
orchestrator's ruling 1): a hook that marks one test is caught even when the file names that marker for
another test, and a mark set on the function object by a hook is not read as written."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
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
    (root / "pytest.ini").write_text(INI)
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    plugins = ["-p", "tools.lint.acceptance_pytest", "-p", "no:django", "-p", "no:cacheprovider"]
    return subprocess.run(
        [sys.executable, "-m", "pytest", *plugins, *args, FOLDER],
        cwd=root,
        env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True,
        text=True,
        check=False,
    )


def not_run(stdout: str) -> str:
    marker = "acceptance tests that did not run"
    return stdout.split(marker, 1)[1] if marker in stdout else ""


ONE_WRITTEN_ONE_PLAIN = """\
import pytest


@pytest.mark.needs_toolchain
def test_written():
    assert True


def test_plain():
    assert False
"""


def hook(body: str) -> str:
    head = "import pytest\n\n\ndef pytest_collection_modifyitems(config, items):\n"
    return f"{head}    for item in items:\n{body}"


def test_a_hook_marking_the_file_s_other_test_is_caught(tmp_path: Path) -> None:
    conftest = hook(
        '        if item.name == "test_plain":\n'
        "            item.add_marker(pytest.mark.needs_toolchain)\n"
    )
    done = run(tmp_path, {"conftest.py": conftest, f"{FOLDER}/test_a.py": ONE_WRITTEN_ONE_PLAIN})
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_plain: deselected" in not_run(done.stdout), done.stdout
    assert "test_written" not in not_run(done.stdout), done.stdout


def test_a_hook_setting_the_function_s_pytestmark_is_caught(tmp_path: Path) -> None:
    conftest = hook(
        '        if item.name == "test_plain":\n'
        "            item.function.pytestmark = [pytest.mark.needs_toolchain.mark]\n"
        "            item.add_marker(pytest.mark.needs_toolchain)\n"
    )
    done = run(tmp_path, {"conftest.py": conftest, f"{FOLDER}/test_a.py": ONE_WRITTEN_ONE_PLAIN})
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_plain: deselected" in not_run(done.stdout), done.stdout


WRITTEN_ON_A_CLASS_AND_A_PARAM = """\
import pytest


@pytest.mark.needs_bwrap
class TestInTheSandbox:
    def test_one(self):
        assert True


@pytest.mark.parametrize("n", [1, pytest.param(2, marks=pytest.mark.needs_toolchain)])
def test_numbers(n):
    assert n == 1
"""


def test_marks_written_on_a_class_or_a_param_are_left_to_the_engine(tmp_path: Path) -> None:
    done = run(tmp_path, {f"{FOLDER}/test_a.py": WRITTEN_ON_A_CLASS_AND_A_PARAM})
    assert done.returncode == 0, done.stdout
    assert not_run(done.stdout) == "", done.stdout


def test_the_opt_in_run_counts_a_written_opt_in_test_a_k_leaves_out(tmp_path: Path) -> None:
    done = run(
        tmp_path,
        {f"{FOLDER}/test_a.py": ONE_WRITTEN_ONE_PLAIN},
        "-m",
        "needs_toolchain or needs_bwrap",
        "-k",
        "not test_written",
    )
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_written: deselected" in not_run(done.stdout), done.stdout


def test_an_addopts_naming_the_engine_s_expression_is_not_the_opt_in_run(tmp_path: Path) -> None:
    done = run(
        tmp_path,
        {f"{FOLDER}/test_a.py": ONE_WRITTEN_ONE_PLAIN},
        "-o",
        "addopts=-m 'needs_toolchain or needs_bwrap'",
    )
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_plain: deselected" in not_run(done.stdout), done.stdout


def test_pytest_addopts_naming_the_engine_s_expression_is_not_the_opt_in_run(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PYTEST_ADDOPTS", "-m 'needs_toolchain or needs_bwrap'")
    done = run(tmp_path, {f"{FOLDER}/test_a.py": ONE_WRITTEN_ONE_PLAIN})
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_plain: deselected" in not_run(done.stdout), done.stdout


def test_a_hook_pointing_the_item_s_path_at_a_file_naming_the_marker_is_caught(tmp_path: Path) -> None:
    conftest = (
        "import pytest\n\n\n@pytest.hookimpl(tryfirst=True)\ndef pytest_itemcollected(item):\n"
        '    if item.name == "test_plain":\n'
        "        item.function.pytestmark = [pytest.mark.needs_toolchain.mark]\n"
        "        item.add_marker(pytest.mark.needs_toolchain)\n"
        "        item.path = item.config.rootpath / 'conftest.py'\n"
    )
    plain = "def test_plain():\n    assert False\n"
    done = run(tmp_path, {"conftest.py": conftest, f"{FOLDER}/test_a.py": plain})
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_plain: deselected" in not_run(done.stdout), done.stdout
