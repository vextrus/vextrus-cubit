"""The acceptance lint's own seams (S14-AL): the declarations it reads from an `acceptance:` commit, the
pins it compares, the collection errors it lets through and the stated reasons it matches. Its whole
runs on fixture repositories are the acceptance tests under `tests/acceptance/ts14al`."""

import subprocess
from pathlib import Path

import pytest

from tools.lint.acceptance_lint import (
    PIN,
    RED_FOR,
    RULING,
    Ticket,
    _failures,
    _stated,
    collects,
    contradictions,
    main,
    rulings_at,
)

MISSING = "ModuleNotFoundError: No module named 'pkg.storeys'"


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def repo(tmp_path: Path, files: dict[str, str]) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    for name, text in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(text)
        git(root, "add", name)
    git(root, "commit", "-q", "--allow-empty", "-m", "base")
    return root


def test_the_declarations_are_read_from_their_own_lines() -> None:
    message = (
        "acceptance: x pins y\n\nThe body says red-for: is a line.\n"
        f"red-for: a/tests/acceptance/t1/test_x.py {MISSING}\n"
        "pin: review.tier = no-model  \n"
        "red-on-main: 1 failed\n"
    )

    assert RED_FOR.findall(message) == [("a/tests/acceptance/t1/test_x.py", MISSING)]
    assert PIN.findall(message) == [("review.tier", "no-model")]


def test_a_ruling_is_read_bare_listed_or_in_backticks() -> None:
    register = (
        "# Rulings\n\nruling: a = 1\n- `ruling: b = two words`\n* ruling: c=3\nSays ruling: d = 4\n"
    )

    assert dict(RULING.findall(register)) == {"a": "1", "b": "two words", "c": "3"}


def test_pins_agreeing_across_tickets_and_with_the_rulings_pass() -> None:
    tickets = [Ticket("s1", pins=[("k", "3")]), Ticket("s2", pins=[("k", "3"), ("j", "1")])]

    assert contradictions(tickets, {"k": "3"}) == []


def test_pins_of_one_key_to_different_values_name_every_branch_and_the_key() -> None:
    tickets = [Ticket("s1", pins=[("k", "3")]), Ticket("s2", pins=[("k", "4")]), Ticket("s3")]

    [problem] = contradictions(tickets, {})

    assert "s1" in problem
    assert "s2" in problem
    assert "k" in problem
    assert "s3" not in problem


def test_a_pin_against_a_ruling_names_the_ticket_and_the_key() -> None:
    [problem] = contradictions([Ticket("s1", pins=[("k", "4")])], {"k": "3"})

    assert problem.startswith("s1: pin k = 4")
    assert "k = 3" in problem


def test_no_register_at_the_base_means_no_rulings(tmp_path: Path) -> None:
    root = repo(tmp_path, {"README.md": "x\n"})

    assert rulings_at(root, "main") == {}


def test_the_register_is_read_as_it_is_at_the_base(tmp_path: Path) -> None:
    root = repo(tmp_path, {"docs/rulings.md": "ruling: k = 3\n"})
    (root / "docs/rulings.md").write_text("ruling: k = 4\n")

    assert rulings_at(root, "main") == {"k": "3"}


def test_only_a_module_not_built_yet_may_stop_collection() -> None:
    assert collects(f"E   {MISSING}\n")
    assert collects("E   ImportError: cannot import name 'count' from 'pkg.units'\n")
    assert not collects(f"E   {MISSING}\nE   FileNotFoundError: cases.json\n")
    assert not collects("ERROR: usage: pytest [options]\n")


def test_a_reason_is_stated_when_one_line_of_the_failure_contains_it() -> None:
    assert _stated(f"Traceback\nE   {MISSING}\n", [MISSING])
    assert not _stated("E   ModuleNotFoundError: No module named 'pkg.storey'\n", [MISSING])
    assert not _stated(f"E   {MISSING}\n", [])


def test_the_failures_of_a_junit_report_are_each_test_red_with_its_text(tmp_path: Path) -> None:
    report = tmp_path / "report.xml"
    report.write_text(
        '<testsuites><testsuite><testcase classname="m" name="ok"/>'
        '<testcase classname="m" name="red"><failure message="boom">E   why</failure></testcase>'
        '<testcase classname="m" name="setup"><error message="fixture">E   other</error></testcase>'
        "</testsuite></testsuites>"
    )

    assert _failures(report) == [("m::red", "boom\nE   why"), ("m::setup", "fixture\nE   other")]
    assert _failures(tmp_path / "none.xml") is None


def test_an_unknown_branch_is_a_verdict_not_a_traceback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.chdir(repo(tmp_path, {"README.md": "x\n"}))

    assert main(["main", "no-such-branch"]) == 1
    printed = capsys.readouterr()
    assert "no-such-branch" in printed.out
    assert "Traceback" not in printed.out + printed.err
