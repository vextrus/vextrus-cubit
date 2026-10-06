"""verify's root-only reading (S14-F2 fix round 1): a run as root is excused only when its own counts
agree with the listed failures, and an entry names its test exactly."""

import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts.verify import flakes_in, root_only_in

ENTRY = "scripts/tests/test_x.py :: test_a_read_only_folder_refuses_writes"
ENTRIES = [(ENTRY, "scripts/tests/test_x.py", "test_a_read_only_folder_refuses_writes")]
LISTED = (
    "FAILED scripts/tests/test_x.py::test_a_read_only_folder_refuses_writes - Failed: DID NOT RAISE\n"
)
SECTION = "=== acceptance tests that did not run (ADR 0041) ===\nx.py::test_y: skipped\n"


def summary(*parts: str) -> str:
    return f"==== {', '.join(parts)} in 3.10s ====\n"


def test_a_listed_failure_with_agreeing_counts_is_root_only() -> None:
    output = LISTED + summary("1 failed", "40 passed")
    assert root_only_in(1, output, ENTRIES) == [ENTRY]


def test_a_fixture_error_beside_a_listed_failure_is_not_root_only() -> None:
    """`-rf` prints no ERROR line, so only the summary's count shows the error."""
    assert root_only_in(1, LISTED + summary("1 failed", "40 passed", "1 error"), ENTRIES) is None
    assert root_only_in(1, LISTED + summary("1 failed", "2 errors"), ENTRIES) is None


def test_an_unlisted_error_line_is_not_root_only() -> None:
    output = LISTED + "ERROR scripts/tests/test_y.py::test_b - RuntimeError\n" + summary("1 failed")
    assert root_only_in(1, output, ENTRIES) is None


def test_a_failure_the_lines_do_not_show_is_not_root_only() -> None:
    assert root_only_in(1, LISTED + summary("2 failed", "40 passed"), ENTRIES) is None


def test_the_acceptance_plugins_section_is_not_root_only() -> None:
    output = LISTED + SECTION + summary("1 failed", "40 passed")
    assert root_only_in(1, output, ENTRIES) is None


def test_a_run_with_no_summary_or_another_exit_code_is_not_root_only() -> None:
    assert root_only_in(1, LISTED, ENTRIES) is None
    assert root_only_in(2, LISTED + summary("1 failed"), ENTRIES) is None
    assert root_only_in(0, LISTED + summary("1 failed"), ENTRIES) is None


def test_an_entry_names_its_test_exactly() -> None:
    longer = "FAILED scripts/tests/test_x.py::test_a_read_only_folder_refuses_writes_and_logs - boom\n"
    assert flakes_in(longer, ENTRIES) is None
    assert root_only_in(1, longer + summary("1 failed"), ENTRIES) is None
    assert flakes_in(LISTED, ENTRIES) == [ENTRY]
    param = "FAILED scripts/tests/test_x.py::test_a_read_only_folder_refuses_writes[a] - boom\n"
    assert flakes_in(param, ENTRIES) == [ENTRY]
    bare = "FAILED scripts/tests/test_x.py::test_a_read_only_folder_refuses_writes\n"
    assert flakes_in(bare, ENTRIES) == [ENTRY]
    other_file = "FAILED scripts/tests/test_z.py::test_a_read_only_folder_refuses_writes - boom\n"
    assert flakes_in(other_file, ENTRIES) is None


def test_a_vitest_entry_names_the_title_that_ends_the_line() -> None:
    entries = [("web/src/a.test.tsx :: pans on a drag", "web/src/a.test.tsx", "pans on a drag")]
    assert flakes_in(" FAIL  src/a.test.tsx > suite > pans on a drag\n", entries) == [entries[0][0]]
    assert flakes_in(" FAIL  src/a.test.tsx > suite > pans on a drag, far\n", entries) is None


# Through `main`, as root: the three runs that must still fail verify.


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture
def clone(tmp_path: Path) -> Path:
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    (root / ".github").mkdir()
    (root / ".github/flaky.txt").write_text("# none\n")
    (root / ".github/flaky-root.txt").write_text(f"{ENTRY}\n")
    (root / "README.md").write_text("x\n")
    git(root, "add", ".github/flaky.txt", ".github/flaky-root.txt", "README.md")
    git(root, "commit", "-q", "-m", "init")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    (root / "scripts").mkdir()
    (root / "scripts/thing.py").write_text("x = 1\n")
    git(root, "add", "scripts/thing.py")
    return root


def verify_as_root(
    root: Path,
    pytest_run: tuple[int, str],
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[int, str]:
    from scripts.verify import main

    def run(check: Any) -> tuple[int, str]:
        return pytest_run if check.name == "pytest" else (0, "ok\n")

    monkeypatch.setattr(os, "geteuid", lambda: 0)
    monkeypatch.chdir(root)
    code = main([], run=run)
    return code, capsys.readouterr().out


RUNS: dict[str, tuple[int, str]] = {
    "fixture-error": (1, LISTED + summary("1 failed", "40 passed", "1 error")),
    "teardown-error": (1, LISTED + summary("1 failed", "39 passed", "2 errors")),
    "acceptance-skip": (1, LISTED + SECTION + summary("1 failed", "40 passed", "1 skipped")),
}


@pytest.mark.parametrize("name", RUNS)
def test_verify_as_root_fails_a_run_whose_counts_do_not_agree(
    clone: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    name: str,
) -> None:
    code, out = verify_as_root(clone, RUNS[name], capsys, monkeypatch)
    assert code == 1, out
    assert "Factory-Verify:" not in out
    assert "root-only" not in out


def test_verify_as_root_still_excuses_a_run_whose_counts_agree(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    code, out = verify_as_root(
        clone, (1, LISTED + summary("1 failed", "40 passed")), capsys, monkeypatch
    )
    assert code == 0, out
    assert "root-only: 1" in out


# vitest's own output (v5.0.2, ANSI stripped; the files are real runs of a scratch test file).

FIXTURES = Path(__file__).parent / "fixtures"
WEB_ENTRY = "web/src/zz_scratch/a.node.test.ts :: listed one"
WEB_ENTRIES = [(WEB_ENTRY, "web/src/zz_scratch/a.node.test.ts", "listed one")]


def test_a_listed_vitest_failure_with_agreeing_counts_is_root_only() -> None:
    output = (FIXTURES / "vitest_one_failed.txt").read_text()
    assert "Tests  1 failed" in output
    assert root_only_in(1, output, WEB_ENTRIES) == [WEB_ENTRY]


def test_a_listed_vitest_failure_beside_an_unlisted_one_is_not_root_only() -> None:
    output = (FIXTURES / "vitest_two_failed.txt").read_text()
    assert "Tests  2 failed" in output
    assert root_only_in(1, output, WEB_ENTRIES) is None


def test_a_vitest_run_with_a_failure_the_lines_do_not_show_is_not_root_only() -> None:
    output = (FIXTURES / "vitest_one_failed.txt").read_text().replace("1 failed |", "2 failed |")
    assert root_only_in(1, output, WEB_ENTRIES) is None


def test_a_vitest_run_with_an_unhandled_error_is_not_root_only() -> None:
    output = (FIXTURES / "vitest_one_failed.txt").read_text()
    with_error = (
        output.replace("   Start at", "     Errors  1 error\n   Start at")
        + "\n⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯\n"
    )
    assert with_error != output
    assert root_only_in(1, with_error, WEB_ENTRIES) is None
