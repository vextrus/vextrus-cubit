"""Ticket S14-B1 (issue #454): the READY gate refuses when the cross-PR check fails.

Authority: issue #454, "Fix": "The READY gate (`verify` or `merge_ready`) refuses a READY whose list is
missing or shows a conflict or test break." The seam chosen: `scripts.verify`. It runs the cross-PR
check (a command naming `scripts.factory.crosspr`) as one of its checks, through the same
`run(check) -> (exit code, output)` it runs every check with (ticket f4's seam,
`scripts/tests/acceptance/tf4/test_verify.py`). Its record is the guard's READY push gate's input
(`docs/specs/factory/contracts/verify-record.schema.json`: the gate "passes only when ... every
element's `exit_code` is 0"), so a failed cross-PR check recorded there refuses the READY push, and
verify prints no `Factory-Verify:` trailer.

`verify.plan(paths)` is left as ticket f4 pins it (the cross-PR check is not one of its path checks); the
check is pinned on what `main` runs and records.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

CROSSPR = "scripts.factory.crosspr"


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture
def clone(tmp_path: Path) -> Path:
    """A clone with main at one commit, `origin/main` at it, and a ticket branch checked out."""
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    (root / "README.md").write_text("x\n")
    git(root, "add", "README.md")
    git(root, "commit", "-q", "-m", "init")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    git(root, "switch", "-q", "-c", "s14-b9")
    return root


def stage(root: Path, name: str, text: str = "x = 1\n") -> str:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    git(root, "add", name)
    return git(root, "write-tree")


def is_crosspr(check: Any) -> bool:
    return CROSSPR in " ".join(check.argv)


class Runner:
    """A fake `run`: the cross-PR check answers `crosspr`; every other check passes."""

    def __init__(self, crosspr: tuple[int, str]) -> None:
        self.crosspr = crosspr
        self.ran: list[str] = []

    def __call__(self, check: Any) -> tuple[int, str]:
        self.ran.append(" ".join(check.argv))
        if is_crosspr(check):
            return self.crosspr
        return 0, f"output of {check.name}\n"


def verify(
    root: Path, run: Runner, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> tuple[int, str]:
    from scripts.verify import main

    monkeypatch.chdir(root)
    code = main([], run=run)
    return code, capsys.readouterr().out


def record_of(root: Path, tree: str) -> dict[str, Any]:
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    loaded: dict[str, Any] = json.loads((common / "vextrus" / f"verify-{tree}.json").read_text())
    return loaded


REFUSAL = "crosspr: #51 and s14-b9 break each other: tests/test_x1_total.py failed on their union\n"


def test_a_failed_cross_pr_check_refuses_the_ready_record_and_the_trailer(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    run = Runner((1, REFUSAL))
    code, out = verify(clone, run, capsys, monkeypatch)
    assert any(CROSSPR in argv for argv in run.ran), run.ran
    assert code == 1
    assert "Factory-Verify:" not in out
    record = record_of(clone, tree)
    assert record["ok"] is False
    [crosspr] = [check for check in record["checks"] if CROSSPR in check["command"]]
    assert crosspr["exit_code"] != 0
    assert "#51" in (clone / crosspr["output_file"]).read_text()


def test_a_passing_cross_pr_check_is_recorded_beside_the_trailer(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, out = verify(clone, Runner((0, "Cross-PR: none ok\n")), capsys, monkeypatch)
    assert code == 0
    assert out.rstrip("\n").splitlines()[-1] == f"Factory-Verify: {tree} ok"
    record = record_of(clone, tree)
    [crosspr] = [check for check in record["checks"] if CROSSPR in check["command"]]
    assert crosspr["exit_code"] == 0
