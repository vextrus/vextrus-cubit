"""The acceptance check's `--staged` form (S29-F2b): the per-commit rules on the commit `git commit`
would make, run by the shift-left hook before the commit."""

import os
import subprocess
import sys
from pathlib import Path

from tools.lint import acceptance

REPO = Path(__file__).resolve().parents[3]
COUNTS = "\n\nred-on-main: 1 failed\ngreen-on-throwaway: 1 passed\n"
ENV = {
    **os.environ,
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_AUTHOR_NAME": "F",
    "GIT_AUTHOR_EMAIL": "f@example.invalid",
    "GIT_COMMITTER_NAME": "F",
    "GIT_COMMITTER_EMAIL": "f@example.invalid",
}


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, env=ENV, check=True, capture_output=True)


def _repo(tmp_path: Path, files: dict[str, str]) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    (repo / "README.md").write_text("x\n")
    _git(repo, "add", "README.md")
    _git(repo, "commit", "-q", "-m", "base")
    for name, text in files.items():
        (repo / name).parent.mkdir(parents=True, exist_ok=True)
        (repo / name).write_text(text)
    if files:
        _git(repo, "add", *files)
    return repo


TEST = "tools/x/tests/acceptance/test_a.py"


def test_an_acceptance_path_under_another_message_is_named(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {TEST: "X = 1\n"})
    (found,) = acceptance.staged_problems(repo, "S99: the widget\n")
    assert found.startswith(f"the staged commit changes {TEST} (an acceptance test)")


def test_an_acceptance_message_with_another_file_or_no_counts_is_named(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {TEST: "X = 1\n", "tools/x/core.py": "X = 1\n"})
    found = acceptance.staged_problems(repo, "acceptance: t1\n")
    assert any("also changes tools/x/core.py" in line for line in found)
    assert any("red-on-main" in line for line in found)


def test_an_acceptance_commit_of_acceptance_paths_with_counts_passes(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {TEST: "X = 1\n"})
    assert acceptance.staged_problems(repo, f"acceptance: t1{COUNTS}") == []


def test_a_config_line_naming_the_acceptance_tests_is_named(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {"conftest.py": "collect_ignore = ['tests/acceptance']\n"})
    (found,) = acceptance.staged_problems(repo, "chore: tidy\n")
    assert "naming the acceptance tests in conftest.py" in found


def test_a_merge_being_concluded_is_left_to_ci(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {})
    _git(repo, "checkout", "-q", "-b", "side")
    (repo / TEST).parent.mkdir(parents=True)
    (repo / TEST).write_text("X = 1\n")
    _git(repo, "add", TEST)
    _git(repo, "commit", "-q", "-m", f"acceptance: t1{COUNTS}")
    _git(repo, "checkout", "-q", "main")
    (repo / "other.md").write_text("y\n")
    _git(repo, "add", "other.md")
    _git(repo, "commit", "-q", "-m", "other")
    _git(repo, "merge", "-q", "--no-commit", "--no-ff", "side")
    assert acceptance.staged_problems(repo, "Merge side\n") == []


def test_the_command_line_prints_problems_and_exits_1(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {TEST: "X = 1\n"})
    message = tmp_path / "message"
    message.write_text("S99: the widget\n")
    done = subprocess.run(
        [sys.executable, "-m", "tools.lint.acceptance", "--staged", "--message-file", str(message)],
        cwd=repo,
        env={**ENV, "PYTHONPATH": str(REPO)},
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 1
    assert TEST in done.stdout
    assert acceptance.main(["--staged"]) == 2
