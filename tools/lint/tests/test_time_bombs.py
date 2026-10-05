"""The time-bomb lint (#308) at its seams: which files it reads, what a bomb is, and how the
allowlist fails closed. Every fixture is a string written to a tmp tree."""

from pathlib import Path

import pytest

from tools.lint.time_bombs import ALLOWLIST, bomb, main, problems

STAMP = 'T1 = "2026-10-05T01:00:00Z"\n'


def write(root: Path, name: str, text: str) -> None:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def test_a_datetime_time_call_is_not_a_clock_read() -> None:
    assert bomb(STAMP + "T = datetime.time(1, 2)\nD = datetime.date.today\n") is None


def test_the_qualified_reads_are_clock_reads() -> None:
    assert bomb(STAMP + "N = datetime.datetime.now(UTC)\n") == (2, "datetime.now()")
    assert bomb(STAMP + "N = datetime.date.today()\n") == (2, "date.today()")


def test_a_commit_in_a_file_that_never_names_git_is_not_a_commit() -> None:
    assert bomb(STAMP + 'run("commit", "-m", "x")\n') is None


def test_pinned_dates_do_not_excuse_a_clock_read() -> None:
    text = STAMP + "# GIT_AUTHOR_DATE GIT_COMMITTER_DATE\ngit = 1\nN = time.time()\n"
    assert bomb(text) == (4, "time.time()")


def test_a_commit_key_with_a_space_before_the_colon_is_data() -> None:
    assert bomb(STAMP + 'git = {"commit" : 1}\n') is None


def test_an_unparsable_allowlist_is_a_problem(tmp_path: Path) -> None:
    write(tmp_path, ALLOWLIST, "[[allow]\n")
    found = problems(tmp_path)
    assert len(found) == 1
    assert "cannot be read" in found[0]


def test_an_entry_without_a_path_is_a_problem(tmp_path: Path) -> None:
    write(tmp_path, ALLOWLIST, '[[allow]]\nreason = "r"\n')
    assert problems(tmp_path) == [f"{ALLOWLIST}: an entry names no path"]


def test_a_glob_allows_a_deep_hit(tmp_path: Path) -> None:
    write(tmp_path, "a/b/tests/test_x.py", STAMP + "N = time.time()\n")
    write(tmp_path, ALLOWLIST, '[[allow]]\npath = "a/**"\nreason = "never compared"\n')
    assert problems(tmp_path) == []


def test_main_with_no_argument_reads_the_working_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    write(tmp_path, "tests/test_x.py", STAMP + "N = time.time()\n")
    monkeypatch.chdir(tmp_path)
    assert main([]) == 1
