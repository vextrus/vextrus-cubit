"""Ticket T-AMEND, section 3: `python -m scripts.factory.amend --subject <text> --red <n> --green <n>
[--body-file <f>] [--base <rev>] <path>...` commits an acceptance amendment only after ruff, ruff
format, mypy and the acceptance lint pass on it (#313).

The seam is the ticket's `scripts.factory.amend.main(argv, *, run, root)`, `run(check, cwd)` returning
`(exit code, output)`. Exit codes: 0 committed, 2 bad input or usage (nothing changed), 3 a check
refused (nothing committed, the index as found).

Each test builds a git repo in `tmp_path` with a `pyproject.toml` carrying the real ruff `select` list,
`line-length = 105` and `[tool.mypy] strict = true`, and a base commit whose sha is passed as `--base`.
The `run` given runs each check's argv for real in its cwd, the leading `uv run` dropped and this venv's
`bin/` first on PATH, so real ruff and real mypy judge the fixture; `node` alone is answered 0 without
running (the pytest job need not have Node), and the call is recorded. The acceptance lint is the
repo's own, in-process.
"""

from __future__ import annotations

import importlib
import os
import re
import subprocess
import sys
import tomllib
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

from tools.lint.acceptance import count_problems, problems

if TYPE_CHECKING:
    from scripts.verify import Check

REPO_ROOT = Path(__file__).resolve().parents[5]
VENV_BIN = str(Path(sys.executable).parent)

NEW_INIT = "scripts/tests/acceptance/p6x/__init__.py"
NEW_TEST = "scripts/tests/acceptance/p6x/test_a.py"
OLD_TEST = "scripts/tests/acceptance/p6w/test_old.py"
LEDGER = "scripts/ledger.py"

CLEAN = '"""A pinned promise."""\n\n\ndef test_x() -> None:\n    assert sum([1, 1]) == 2\n'
CLEAN_EDITED = '"""A pinned promise."""\n\n\ndef test_y() -> None:\n    assert sum([2, 2]) == 4\n'
LONG_COMMENT = "# " + " ".join(["word"] * 25) + "\n"
TOO_LONG = CLEAN + "\n\n" + LONG_COMMENT
UNFORMATTED = '"""A pinned promise."""\n\nx=1\n\n\ndef test_x() -> None:\n    assert sum([1, x]) == 2\n'
MISTYPED = CLEAN + '\n\ndef f() -> int:\n    return "a"\n'
ALL_WRONG = '"""A pinned promise."""\n\nx=1\n' + LONG_COMMENT + '\n\ndef f() -> int:\n    return "a"\n'


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.rstrip("\n")


def write(repo: Path, path: str, text: str) -> None:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)


def fixture_pyproject() -> str:
    real = tomllib.loads((REPO_ROOT / "pyproject.toml").read_text())
    select = ", ".join(f'"{rule}"' for rule in real["tool"]["ruff"]["lint"]["select"])
    return (
        '[tool.ruff]\nline-length = 105\ntarget-version = "py314"\n\n'
        f"[tool.ruff.lint]\nselect = [{select}]\n\n"
        "[tool.mypy]\nstrict = true\n"
    )


class Runner:
    """The `run` the command is given: every check for real, recorded; `node` answered 0."""

    def __init__(self) -> None:
        self.calls: list[tuple[Check, Path]] = []

    def __call__(self, check: Check, cwd: Path) -> tuple[int, str]:
        self.calls.append((check, cwd))
        argv = list(check.argv)
        if argv[:2] == ["uv", "run"]:
            argv = argv[2:]
        if argv[0] == "node":
            return 0, ""
        path = VENV_BIN + os.pathsep + os.environ.get("PATH", "")
        env = {**os.environ, **check.env, "PATH": path}
        done = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, check=False, env=env)
        return done.returncode, done.stdout + done.stderr

    def argvs(self) -> list[list[str]]:
        return [list(check.argv) for check, _ in self.calls]


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "writer@example.com")
    git(root, "config", "user.name", "Acceptance Writer")
    git(root, "config", "commit.gpgsign", "false")
    files = {
        ".gitignore": ".mypy_cache/\n.ruff_cache/\n__pycache__/\n",
        "pyproject.toml": fixture_pyproject(),
        "scripts/__init__.py": "",
        LEDGER: '"""The ledger."""\n\nLEDGER = 1\n',
        "scripts/tests/__init__.py": "",
        "scripts/tests/acceptance/__init__.py": "",
        "scripts/tests/acceptance/p6w/__init__.py": "",
        OLD_TEST: CLEAN,
    }
    for path, text in files.items():
        write(root, path, text)
    git(root, "add", "--", *files)
    git(root, "commit", "-q", "-m", "base")
    monkeypatch.chdir(root)
    return root


def base_of(repo: Path) -> str:
    return git(repo, "rev-list", "--max-parents=0", "HEAD")


def amend(
    repo: Path, argv: list[str], run: Runner, capfd: pytest.CaptureFixture[str]
) -> tuple[int, str]:
    """The command's exit code (a SystemExit's too) and everything it printed."""
    module = importlib.import_module("scripts.factory.amend")
    main: Callable[..., int] = module.main
    try:
        code = main(argv, run=run, root=repo)
    except SystemExit as stop:
        code = 0 if stop.code is None else stop.code if isinstance(stop.code, int) else 1
    printed = capfd.readouterr()
    return code, printed.out + printed.err


def args(repo: Path, *paths: str, red: str = "2", green: str = "2") -> list[str]:
    counts = ["--red", red, "--green", green]
    return ["--subject", "p6 amend: pin x", *counts, "--base", base_of(repo), *paths]


def new_amendment(repo: Path, text: str = CLEAN) -> list[str]:
    write(repo, NEW_INIT, "")
    write(repo, NEW_TEST, text)
    return [NEW_INIT, NEW_TEST]


def staged(repo: Path) -> str:
    return git(repo, "diff", "--cached", "--name-only")


def assert_refused(repo: Path, code: int, head: str, expected: int = 3) -> None:
    assert code == expected
    assert git(repo, "rev-parse", "HEAD") == head
    assert staged(repo) == ""


def names(output: str, check: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(check)}(?![\w-])", output) is not None


def covers(argv: list[str], cwd: Path, repo: Path, path: str) -> bool:
    return any((cwd / arg).resolve() == (repo / path).resolve() for arg in argv)


@pytest.mark.parametrize("kind", ["new", "edited"])
def test_a_clean_amendment_is_one_acceptance_commit_of_exactly_its_paths(
    repo: Path, tmp_path: Path, kind: str, capfd: pytest.CaptureFixture[str]
) -> None:
    if kind == "new":
        paths = new_amendment(repo)
    else:
        write(repo, OLD_TEST, CLEAN_EDITED)
        paths = [OLD_TEST]
    body = "Why: pin x before the build.\n\nCo-Authored-By: A Writer <writer@example.com>"
    body_file = tmp_path / "body.txt"
    body_file.write_text(body + "\n")
    base = base_of(repo)

    code, output = amend(repo, [*args(repo, *paths), "--body-file", str(body_file)], Runner(), capfd)

    assert code == 0, output
    assert git(repo, "rev-list", "--count", f"{base}..HEAD") == "1"
    assert git(repo, "rev-parse", "HEAD^") == base
    assert git(repo, "log", "-1", "--format=%s") == "acceptance: p6 amend: pin x"
    message = git(repo, "log", "-1", "--format=%B")
    assert "red-on-main: 2 failed" in message.splitlines()
    assert "green-on-throwaway: 2 passed" in message.splitlines()
    assert body in message
    changed = git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").splitlines()
    assert sorted(changed) == sorted(paths)
    assert problems(repo, base, "HEAD") == []
    assert git(repo, "status", "--porcelain", "--", *paths) == ""


def test_a_line_over_105_characters_refuses_and_commits_nothing(
    repo: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    head = git(repo, "rev-parse", "HEAD")
    code, output = amend(repo, args(repo, *new_amendment(repo, TOO_LONG)), Runner(), capfd)
    assert_refused(repo, code, head)
    assert names(output, "ruff"), output
    assert "E501" in output


def test_a_file_ruff_format_would_change_refuses_and_commits_nothing(
    repo: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    head = git(repo, "rev-parse", "HEAD")
    code, output = amend(repo, args(repo, *new_amendment(repo, UNFORMATTED)), Runner(), capfd)
    assert_refused(repo, code, head)
    assert names(output, "ruff-format"), output
    assert "reformat" in output


def test_a_type_error_refuses_and_commits_nothing(repo: Path, capfd: pytest.CaptureFixture[str]) -> None:
    head = git(repo, "rev-parse", "HEAD")
    code, output = amend(repo, args(repo, *new_amendment(repo, MISTYPED)), Runner(), capfd)
    assert_refused(repo, code, head)
    assert names(output, "mypy"), output
    assert "Incompatible return value type" in output


@pytest.mark.parametrize(("red", "green"), [("0", "2"), ("2", "0"), ("2", "1")])
def test_counts_the_lint_refuses_are_refused_with_its_words(
    repo: Path, red: str, green: str, capfd: pytest.CaptureFixture[str]
) -> None:
    head = git(repo, "rev-parse", "HEAD")
    paths = new_amendment(repo)
    code, output = amend(repo, args(repo, *paths, red=red, green=green), Runner(), capfd)
    assert_refused(repo, code, head)
    assert names(output, "acceptance"), output
    wording = count_problems(f"red-on-main: {red} failed\ngreen-on-throwaway: {green} passed\n")
    assert wording
    for problem in wording:
        assert problem in output


@pytest.mark.parametrize(
    "counts",
    [
        ["--green", "2"],
        ["--red", "2"],
        ["--red", "two", "--green", "2"],
        ["--red", "2", "--green", "1.5"],
    ],
    ids=["no-red", "no-green", "red-not-an-integer", "green-not-an-integer"],
)
def test_missing_or_non_integer_counts_are_usage_errors(
    repo: Path, counts: list[str], capfd: pytest.CaptureFixture[str]
) -> None:
    head = git(repo, "rev-parse", "HEAD")
    paths = new_amendment(repo)
    argv = ["--subject", "p6 amend: pin x", *counts, "--base", base_of(repo), *paths]
    code, _ = amend(repo, argv, Runner(), capfd)
    assert_refused(repo, code, head, expected=2)


@pytest.mark.parametrize(
    "bad",
    [
        LEDGER,
        "scripts/tests/acceptance/p6x",
        ".",
        "scripts/tests/acceptance/p6x/*.py",
        OLD_TEST,
    ],
    ids=["not-an-acceptance-path", "a-directory", "dot", "a-glob", "unchanged-from-head"],
)
def test_a_path_that_is_not_one_changed_acceptance_file_is_bad_input(
    repo: Path, bad: str, capfd: pytest.CaptureFixture[str]
) -> None:
    write(repo, LEDGER, '"""The ledger."""\n\nLEDGER = 2\n')
    head = git(repo, "rev-parse", "HEAD")
    paths = new_amendment(repo)
    code, _ = amend(repo, args(repo, *paths, bad), Runner(), capfd)
    assert_refused(repo, code, head, expected=2)
    assert git(repo, "status", "--porcelain", "--", LEDGER) == " M " + LEDGER


def test_something_staged_outside_the_paths_is_refused_and_the_index_left_as_found(
    repo: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    write(repo, LEDGER, '"""The ledger."""\n\nLEDGER = 2\n')
    git(repo, "add", "--", LEDGER)
    head, tree = git(repo, "rev-parse", "HEAD"), git(repo, "write-tree")
    paths = new_amendment(repo)
    code, output = amend(repo, args(repo, *paths), Runner(), capfd)
    assert code == 2
    assert "an acceptance commit changes acceptance tests only" in output
    assert git(repo, "rev-parse", "HEAD") == head
    assert staged(repo) == LEDGER
    assert git(repo, "write-tree") == tree


def test_only_the_given_paths_are_committed(repo: Path, capfd: pytest.CaptureFixture[str]) -> None:
    write(repo, LEDGER, '"""The ledger."""\n\nLEDGER = 2\n')
    write(repo, "notes.txt", "a note\n")
    write(repo, "scripts/tests/acceptance/p6x/test_b.py", CLEAN)
    paths = new_amendment(repo)
    code, output = amend(repo, args(repo, *paths), Runner(), capfd)
    assert code == 0, output
    changed = git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").splitlines()
    assert sorted(changed) == sorted(paths)
    assert git(repo, "status", "--porcelain", "--", LEDGER) == " M " + LEDGER
    assert git(repo, "status", "--porcelain", "--", "notes.txt") == "?? notes.txt"
    untracked = git(repo, "status", "--porcelain", "--", "scripts/tests/acceptance/p6x/test_b.py")
    assert untracked == "?? scripts/tests/acceptance/p6x/test_b.py"
    assert staged(repo) == ""


def test_the_real_lint_judges_the_commit_as_it_will_be(
    repo: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    write(repo, "scripts/tests/acceptance/p6w/helper.py", '"""A helper."""\n')
    git(repo, "add", "--", "scripts/tests/acceptance/p6w/helper.py")
    git(repo, "commit", "-q", "-m", "wip: add a helper")
    base = base_of(repo)
    expected = problems(repo, base, "HEAD")
    assert expected
    head = git(repo, "rev-parse", "HEAD")
    code, output = amend(repo, args(repo, *new_amendment(repo)), Runner(), capfd)
    assert_refused(repo, code, head)
    for problem in expected:
        assert problem in output


def test_every_check_runs_on_every_python_file_even_after_one_fails(
    repo: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    head = git(repo, "rev-parse", "HEAD")
    paths = new_amendment(repo, ALL_WRONG)
    run = Runner()
    code, output = amend(repo, args(repo, *paths), run, capfd)
    assert_refused(repo, code, head)
    kinds: dict[str, Callable[[list[str]], bool]] = {
        "ruff": lambda argv: "ruff" in argv and "check" in argv,
        "ruff-format": lambda argv: "ruff" in argv and "format" in argv and "--check" in argv,
        "mypy": lambda argv: "mypy" in argv,
    }
    for kind, matches in kinds.items():
        calls = [(list(check.argv), cwd) for check, cwd in run.calls if matches(list(check.argv))]
        assert calls, f"no {kind} check was run: {run.argvs()}"
        for path in paths:
            assert any(covers(argv, cwd, repo, path) for argv, cwd in calls), (kind, path)
        assert all("." not in argv for argv, _ in calls), (kind, calls)
    assert "E501" in output
    assert "reformat" in output
    assert "Incompatible return value type" in output


def test_non_python_acceptance_files_are_committed_after_node_check_or_a_note(
    repo: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    mjs = "scripts/tests/acceptance/p6x/tool.test.mjs"
    spec = "web/e2e/acceptance/p6x/flow.spec.ts"
    write(repo, mjs, "export const x = 1;\n")
    write(repo, spec, "export const y: number = 1;\n")
    run = Runner()
    code, output = amend(repo, args(repo, mjs, spec), run, capfd)
    assert code == 0, output
    changed = git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").splitlines()
    assert sorted(changed) == sorted([mjs, spec])
    node = [(list(check.argv), cwd) for check, cwd in run.calls if check.argv[:2] == ("node", "--check")]
    assert any(covers(argv, cwd, repo, mjs) for argv, cwd in node), run.argvs()
    assert not any(covers(list(check.argv), cwd, repo, spec) for check, cwd in run.calls)
    assert f"not checked: {spec}" in output
