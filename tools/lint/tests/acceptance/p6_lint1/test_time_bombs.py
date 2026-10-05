"""Ticket T-LINT-1, section 3 B (#308): `python -m tools.lint.time_bombs [root]` refuses a Python test
file that fixes a timestamp and also reads the wall clock or makes a git commit at the wall clock's
time (the #293 bomb: verdict times fixed, commits made "now", CI red after 01:10Z).

The seams are the ticket's: a test file is `test_*.py`, `*_test.py`, `conftest.py` or any `.py` under
a `tests/` folder (folders starting with `.`, `node_modules` and `.venv` skipped); a fixed timestamp is
`\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}`; a wall-clock read is `datetime.now(`, `datetime.utcnow(`,
`date.today(`, `time.time(` or `time.time_ns(`; a wall-clock commit is the literal "commit" (either
quote) not followed by `:`, in a file naming git, without both GIT_AUTHOR_DATE and GIT_COMMITTER_DATE.
Problem: `<path>:<line>: wall clock (<what>) in a file that holds a fixed timestamp: pin the date or
pass the time in`. The allowlist is `tools/lint/time_bombs_allowlist.toml` (`[[allow]]`, `path` a glob
from the root, `reason` required; an entry matching no hit is stale).

Every fixture is a string written to a tmp tree: this file is itself a hit on the real tree, and the
builder allowlists it ("fixtures are strings written to a tmp tree"). The module is imported inside
each test, so each test is red on its own until it exists.
"""

import importlib
import os
import subprocess
import sys
from pathlib import Path
from types import ModuleType

import pytest

REPO = Path(__file__).resolve().parents[5]
ALLOWLIST = "tools/lint/time_bombs_allowlist.toml"
TAIL = ") in a file that holds a fixed timestamp: pin the date or pass the time in"
STAMP = "2026-10-05T01:00:00Z"


def lint() -> ModuleType:
    return importlib.import_module("tools.lint.time_bombs")


def problems(root: Path) -> list[str]:
    found: list[str] = lint().problems(root)
    return found


def main(argv: list[str]) -> int:
    code: int = lint().main(argv)
    return code


def write(root: Path, name: str, text: str) -> Path:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return path


def line_of(text: str, needle: str) -> int:
    return next(n for n, line in enumerate(text.splitlines(), start=1) if needle in line)


def assert_one_bomb(found: list[str], name: str, line: int) -> None:
    assert len(found) == 1, found
    assert found[0].startswith(f"{name}:{line}: wall clock ("), found
    assert found[0].endswith(TAIL), found


CLOCK_READ = f"""import datetime

T1 = "{STAMP}"


def test_it() -> None:
    now = datetime.datetime.now(datetime.UTC)
    assert now.isoformat() > T1
"""

GIT_COMMIT = f"""import subprocess
from pathlib import Path

T1 = "{STAMP}"


def test_it(repo: Path) -> None:
    subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "c"], check=True)
    assert T1
"""

# The pre-fix #293 shape: a `_git` helper with no env, a fixed verdict time, a commit made "now".
HELPER = """import os
import subprocess
from pathlib import Path

T1 = "{stamp}"
D = "2026-10-05T00:55:00Z"


def _git(repo: Path, *args: str) -> None:
    {env}subprocess.run(["git", "-C", str(repo), *args], check=True{pass_env})


def test_it(repo: Path) -> None:
    _git(repo, "init", "-q")
    _git(repo, "commit", "-q", "-m", "c")
    assert T1
"""


def helper(env: str = "") -> str:
    return HELPER.format(
        stamp=STAMP,
        env=f"env = {env}\n    " if env else "",
        pass_env=", env=env" if env else "",
    )


def test_a_fixed_timestamp_beside_a_clock_read_is_a_bomb(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", CLOCK_READ)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", line_of(CLOCK_READ, ".now("))


def test_a_fixed_timestamp_beside_a_wall_clock_git_commit_is_a_bomb(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", GIT_COMMIT)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", line_of(GIT_COMMIT, '"commit"'))


@pytest.mark.parametrize(
    "read",
    [
        "datetime.now(UTC)",
        "datetime.utcnow()",
        "date.today()",
        "time.time()",
        "time.time_ns()",
    ],
)
def test_each_wall_clock_read_is_named(tmp_path: Path, read: str) -> None:
    text = f'T1 = "{STAMP}"\n\n\ndef test_it() -> None:\n    assert {read}\n'
    write(tmp_path, "x/tests/test_a.py", text)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", 5)


@pytest.mark.parametrize("stamp", ["2026-10-05T01:00:00Z", "2026-10-05 01:00", "2026-10-05T01:00"])
def test_a_timestamp_with_a_t_or_a_space_is_fixed(tmp_path: Path, stamp: str) -> None:
    text = f'T1 = "{stamp}"\nNOW = time.time()\n'
    write(tmp_path, "x/tests/test_a.py", text)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", 2)


def test_a_date_without_a_time_is_not_a_fixed_timestamp(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", 'DAY = "2026-10-05"\nNOW = time.time()\n')
    assert problems(tmp_path) == []


@pytest.mark.parametrize(
    "name",
    ["x/test_a.py", "x/a_test.py", "x/conftest.py", "x/tests/_stub.py", "x/tests/deep/helpers.py"],
)
def test_every_python_test_file_is_read(tmp_path: Path, name: str) -> None:
    write(tmp_path, name, CLOCK_READ)
    assert_one_bomb(problems(tmp_path), name, line_of(CLOCK_READ, ".now("))


def test_the_first_read_or_commit_by_line_is_named(tmp_path: Path) -> None:
    text = GIT_COMMIT + "\n\ndef test_later() -> None:\n    assert time.time()\n"
    write(tmp_path, "x/tests/test_a.py", text)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", line_of(text, '"commit"'))


def test_the_pre_fix_293_shape_is_a_bomb(tmp_path: Path) -> None:
    text = helper()
    write(tmp_path, "x/tests/test_a.py", text)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", line_of(text, '"commit"'))


def test_the_293_shape_with_both_git_dates_pinned_is_not_a_bomb(tmp_path: Path) -> None:
    text = helper('{**os.environ, "GIT_AUTHOR_DATE": D, "GIT_COMMITTER_DATE": D}')
    write(tmp_path, "x/tests/test_a.py", text)
    assert problems(tmp_path) == []


def test_the_293_shape_with_only_the_committer_date_pinned_is_a_bomb(tmp_path: Path) -> None:
    text = helper('{**os.environ, "GIT_COMMITTER_DATE": D}')
    write(tmp_path, "x/tests/test_a.py", text)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", line_of(text, '"commit"'))


def test_a_fixed_timestamp_alone_is_not_a_bomb(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", f'T1 = "{STAMP}"\n\n\ndef test_it() -> None:\n    assert T1\n')
    assert problems(tmp_path) == []


def test_a_clock_read_alone_is_not_a_bomb(tmp_path: Path) -> None:
    write(
        tmp_path,
        "x/tests/test_a.py",
        "import time\n\n\ndef test_it() -> None:\n    assert time.time()\n",
    )
    assert problems(tmp_path) == []


@pytest.mark.parametrize("quote", ['"', "'"])
def test_a_commit_key_in_data_is_not_a_commit_even_beside_git(tmp_path: Path, quote: str) -> None:
    key = f"{quote}commit{quote}"
    text = (
        f'# A stub of the `gh` and git APIs.\nT1 = "{STAMP}"\n'
        f"PAYLOAD = {{{key}: {{{quote}committer{quote}: {{{quote}date{quote}: T1}}}}}}\n"
    )
    write(tmp_path, "x/tests/_gh_stub.py", text)
    assert problems(tmp_path) == []


def test_a_single_quoted_commit_beside_git_is_a_commit(tmp_path: Path) -> None:
    text = GIT_COMMIT.replace('"commit"', "'commit'")
    write(tmp_path, "x/tests/test_a.py", text)
    assert_one_bomb(problems(tmp_path), "x/tests/test_a.py", line_of(text, "'commit'"))


def test_a_file_that_is_not_a_test_file_is_not_read(tmp_path: Path) -> None:
    write(tmp_path, "src/x.py", CLOCK_READ)
    write(tmp_path, "src/y.py", GIT_COMMIT)
    assert problems(tmp_path) == []


@pytest.mark.parametrize(
    "folder", [".git", ".venv", ".hidden", "node_modules", "x/.venv", "x/node_modules"]
)
def test_skipped_folders_are_not_read(tmp_path: Path, folder: str) -> None:
    write(tmp_path, f"{folder}/pkg/tests/test_a.py", CLOCK_READ)
    write(tmp_path, f"{folder}/pkg/tests/test_b.py", GIT_COMMIT)
    assert problems(tmp_path) == []


def test_a_missing_allowlist_is_the_empty_list(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", f'T1 = "{STAMP}"\n')
    assert not (tmp_path / ALLOWLIST).exists()
    assert problems(tmp_path) == []


def test_an_allowed_hit_is_not_reported(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", CLOCK_READ)
    write(tmp_path, "y/tests/test_b.py", GIT_COMMIT)
    write(
        tmp_path,
        ALLOWLIST,
        '[[allow]]\npath = "x/tests/test_*.py"\nreason = "the time is never compared"\n\n'
        '[[allow]]\npath = "y/tests/test_b.py"\nreason = "the commit time is never read"\n',
    )
    assert problems(tmp_path) == []


@pytest.mark.parametrize("reason", ["", 'reason = ""\n', 'reason = "   "\n'])
def test_an_entry_without_a_reason_is_a_problem(tmp_path: Path, reason: str) -> None:
    write(tmp_path, "x/tests/test_a.py", CLOCK_READ)
    write(tmp_path, ALLOWLIST, f'[[allow]]\npath = "x/tests/test_a.py"\n{reason}')
    assert problems(tmp_path) != []


def test_an_entry_matching_no_hit_is_stale(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", f'T1 = "{STAMP}"\n')
    write(tmp_path, ALLOWLIST, '[[allow]]\npath = "x/tests/test_a.py"\nreason = "was a hit once"\n')
    found = problems(tmp_path)
    assert len(found) == 1, found
    assert "stale" in found[0]


def test_main_prints_each_problem_and_exits_1(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, "x/tests/test_a.py", CLOCK_READ)
    write(tmp_path, "y/tests/test_b.py", GIT_COMMIT)
    found = problems(tmp_path)
    assert len(found) == 2
    assert main([str(tmp_path)]) == 1
    assert capsys.readouterr().out.splitlines() == found


def test_main_exits_0_on_a_clean_tree(tmp_path: Path) -> None:
    write(tmp_path, "x/tests/test_a.py", f'T1 = "{STAMP}"\n')
    assert main([str(tmp_path)]) == 0


def test_two_arguments_are_a_usage_error(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main([str(tmp_path), str(tmp_path)]) == 2
    captured = capsys.readouterr()
    assert "usage" in (captured.out + captured.err).lower()


def test_the_repo_has_no_unallowed_time_bomb() -> None:
    assert problems(REPO) == []


def test_the_lint_exits_0_at_the_repo_root() -> None:
    done = subprocess.run(
        [sys.executable, "-m", "tools.lint.time_bombs"],
        cwd=REPO,
        env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stdout + done.stderr
