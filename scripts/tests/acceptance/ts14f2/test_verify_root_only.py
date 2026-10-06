"""S14-F2 (issue #450): "`verify` treats a failure listed in a new `.github/flaky-root.txt` as
`root-only`, the way it already treats listed flakes." Acceptance (issue #450): "a failure listed in
`flaky-root.txt` is recorded as `root-only` and does not fail `verify`; an unlisted failure still
does"; factory-next.md section 8, row 3: "verify reports root-only not failure".

Seams: `scripts.verify.main(argv, *, run)` with `run(check) -> (exit code, output text)` (ticket f4);
the record contract `docs/specs/factory/contracts/verify-record.schema.json`; `.github/flaky-root.txt`
in `.github/flaky.txt`'s line format, `<repo path> :: <test title>`; the run is made root by
`os.geteuid` reporting 0 (a cloud container's uid). The scripted runner fails the same way on every
call, as a root-only failure does: a rerun never rescues it.
"""

import json
import os
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors

REPO = Path(__file__).resolve().parents[4]
ROOT_ONLY = "scripts/tests/test_x.py :: test_a_read_only_folder_refuses_writes"
ROOT_FAILED = (
    "FAILED scripts/tests/test_x.py::test_a_read_only_folder_refuses_writes"
    " - Failed: DID NOT RAISE <class 'PermissionError'>\n"
)
OTHER_FAILED = "FAILED scripts/tests/test_x.py::test_other - AssertionError: assert 1 == 2\n"
SUMMARY = "==== 1 failed, 40 passed in 3.10s ====\n"


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture
def clone(tmp_path: Path) -> Path:
    """A clone whose main lists one root-only test, with `origin/main` at main."""
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    (root / ".github").mkdir()
    (root / ".github/flaky.txt").write_text("# Known flaky tests: <repo path> :: <test title>\n")
    (root / ".github/flaky-root.txt").write_text(
        f"# Tests that fail only as root: <repo path> :: <test title>\n\n{ROOT_ONLY}\n"
    )
    (root / "README.md").write_text("x\n")
    git(root, "add", ".github/flaky.txt", ".github/flaky-root.txt", "README.md")
    git(root, "commit", "-q", "-m", "init")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    return root


def stage(root: Path, name: str) -> str:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("x = 1\n")
    git(root, "add", name)
    return git(root, "write-tree")


def always(failing: dict[str, tuple[int, str]]) -> Callable[[Any], tuple[int, str]]:
    def run(check: Any) -> tuple[int, str]:
        return failing.get(check.name, (0, f"output of {check.name}\n"))

    return run


def verify_as_root(
    root: Path,
    run: Callable[[Any], tuple[int, str]],
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[int, str]:
    from scripts.verify import main

    monkeypatch.setattr(os, "geteuid", lambda: 0)
    monkeypatch.chdir(root)
    code = main([], run=run)
    return code, capsys.readouterr().out


def record_of(root: Path, tree: str) -> dict[str, Any]:
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    loaded: dict[str, Any] = json.loads((common / "vextrus" / f"verify-{tree}.json").read_text())
    return loaded


def pytest_entry(record: dict[str, Any]) -> dict[str, Any]:
    [entry] = [check for check in record["checks"] if check["name"] == "pytest"]
    found: dict[str, Any] = entry
    return found


def test_a_failure_listed_in_flaky_root_does_not_fail_verify_as_root(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, out = verify_as_root(
        clone, always({"pytest": (1, ROOT_FAILED + SUMMARY)}), capsys, monkeypatch
    )
    assert code == 0, out
    record = record_of(clone, tree)
    assert errors(record, contract("verify-record.schema.json")) == []
    assert record["ok"] is True
    assert pytest_entry(record)["exit_code"] == 0
    assert out.rstrip("\n").splitlines()[-1] == f"Factory-Verify: {tree} ok"


def test_verify_reports_the_listed_failure_as_root_only(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    stage(clone, "scripts/thing.py")
    _code, out = verify_as_root(
        clone, always({"pytest": (1, ROOT_FAILED + SUMMARY)}), capsys, monkeypatch
    )
    [line] = [line for line in out.splitlines() if line.startswith("verify: pytest ")]
    assert "root-only" in line, line


def test_the_record_names_the_root_only_test(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    verify_as_root(clone, always({"pytest": (1, ROOT_FAILED + SUMMARY)}), capsys, monkeypatch)
    entry = pytest_entry(record_of(clone, tree))
    assert ROOT_ONLY in json.dumps({k: v for k, v in entry.items() if k != "output_file"})


def test_an_unlisted_failure_beside_a_root_only_one_still_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    run = always({"pytest": (1, ROOT_FAILED + OTHER_FAILED + SUMMARY)})
    code, out = verify_as_root(clone, run, capsys, monkeypatch)
    assert code == 1
    record = record_of(clone, tree)
    assert errors(record, contract("verify-record.schema.json")) == []
    assert pytest_entry(record)["exit_code"] == 1
    assert record["ok"] is False
    assert "Factory-Verify:" not in out


def test_the_repository_has_a_root_only_list_in_the_flaky_format() -> None:
    path = REPO / ".github/flaky-root.txt"
    assert path.is_file()
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        where, _, title = line.partition(" :: ")
        assert title.strip(), line
        assert (REPO / where.strip()).is_file(), line
