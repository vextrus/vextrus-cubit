"""Review round 1 of S14-B1 (PR #479): crosspr's trust wall, staged tree, time limits, web limit, and
verify's handling of its exit. Beside, never inside, the acceptance tests."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import crosspr
from scripts.tests.acceptance.ts14b1._world import BRANCH, CALC, REPO, World
from scripts.verify import main as verify_main

WITH_TOTAL = CALC + "\n\ndef total(n):\n    return n * rate()\n"
TOTAL_TEST = "import calc\n\n\ndef test_total_of_three_is_six():\n    assert calc.total(3) == 6\n"
RATE_3 = CALC.replace("return 2", "return 3")
OWN_TEST = "import calc\n\n\ndef test_rate_is_three():\n    assert calc.rate() == 3\n"
TOTAL_FILES = {"calc.py": WITH_TOTAL, "tests/test_x1_total.py": TOTAL_TEST}
OWN_FILES = {"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST}


def describe(world: World, number: int, **fields: Any) -> None:
    for pr in world.prs:
        if pr["number"] == number:
            pr.update(fields)
    world.state.write_text(json.dumps(world.prs))


def run(world: World, *extra: str) -> subprocess.CompletedProcess[str]:
    env = world.env()
    env["PATH"] = f"{world.bin}{os.pathsep}{os.environ.get('PATH', '')}"
    env["PYTHONPATH"] = str(REPO)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        [sys.executable, "-m", "scripts.factory.crosspr", BRANCH, *extra],
        cwd=world.work,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_a_trusted_prs_failing_tests_refuse(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", TOTAL_FILES)
    describe(world, 51, author={"login": "vextrus"}, isCrossRepository=False)
    world.own(OWN_FILES)
    assert run(world).returncode == 1


@pytest.mark.parametrize(
    "fields",
    [
        {"author": {"login": "vextrus"}, "isCrossRepository": True},
        {"author": {"login": "stranger"}, "isCrossRepository": False},
    ],
)
def test_a_fork_or_foreign_authors_tests_are_never_run(tmp_path: Path, fields: dict[str, Any]) -> None:
    """The same union refuses when trusted (above); here it is only merge-tree'd and says so."""
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", TOTAL_FILES)
    describe(world, 51, **fields)
    world.own(OWN_FILES)
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert "#51 tests not run" in done.stderr
    assert not (world.work / ".private" / "work" / "crosspr" / "pr-51.txt").exists()


def test_a_foreign_prs_conflict_still_refuses(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(53, "s14-x3", {"calc.py": CALC.replace("return 2", "return 4")})
    describe(world, 53, author={"login": "stranger"}, isCrossRepository=True)
    world.own(OWN_FILES)
    assert run(world).returncode == 1


def test_the_staged_tree_is_what_is_checked_not_the_committed_tip(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", TOTAL_FILES)
    describe(world, 51, author={"login": "vextrus"}, isCrossRepository=False)
    world.own({"README": "own\n"})
    assert run(world).stdout.strip() == "Cross-PR: none ok"
    world.write(OWN_FILES)
    world.git(world.work, "add", *OWN_FILES)
    tree = world.git(world.work, "write-tree")
    committed = run(world)
    assert committed.stdout.strip() == "Cross-PR: none ok"
    staged = run(world, "--tree", tree)
    assert staged.returncode == 1, staged.stderr
    assert "#51" in staged.stderr


def test_a_hanging_process_is_killed_at_its_limit() -> None:
    started = time.monotonic()
    with pytest.raises(crosspr.Refusal, match="timed out"):
        crosspr.call(["sleep", "30"], limit=1)
    assert time.monotonic() - started < 10


def test_a_stale_crosspr_worktree_is_removed_at_the_start(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(52, "s14-x2", {"README": "other\n"})
    world.own(OWN_FILES)
    kept = world.work / ".private" / "work" / "crosspr"
    kept.mkdir(parents=True)
    world.git(world.work, "worktree", "add", "--detach", "-q", str(kept / "worktree-51"), "main")
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert "worktree-51" not in world.git(world.work, "worktree", "list", "--porcelain")


def test_web_tests_are_not_run_and_the_line_says_so(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"web/src/a.test.ts": "x\n", "calc.py": WITH_TOTAL})
    describe(world, 51, author={"login": "vextrus"}, isCrossRepository=False)
    world.own({"calc.py": RATE_3, "web/src/b.test.ts": "y\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 web not run"


# --- verify


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture
def clone(tmp_path: Path) -> Path:
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "t@example.invalid")
    git(root, "config", "user.name", "t")
    git(root, "config", "commit.gpgsign", "false")
    (root / "README.md").write_text("x\n")
    git(root, "add", "README.md")
    git(root, "commit", "-q", "-m", "init")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    (root / ".github").mkdir()
    (root / ".github" / "flaky.txt").write_text("scripts/tests/test_x.py :: test_a\n")
    (root / "scripts").mkdir()
    (root / "scripts" / "thing.py").write_text("x = 1\n")
    git(root, "add", "scripts/thing.py")
    return root


def verify(
    root: Path, monkeypatch: pytest.MonkeyPatch, answer: tuple[int, str]
) -> tuple[int, list[Any]]:
    seen: list[Any] = []

    def fake(check: Any) -> tuple[int, str]:
        seen.append(check)
        return answer if check.name == "crosspr" else (0, "ok\n")

    monkeypatch.chdir(root)
    return verify_main([], run=fake), seen


def test_verify_checks_the_staged_tree_and_names_a_detached_head(
    clone: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    git(clone, "switch", "-q", "-c", "s14-b9")
    tree = git(clone, "write-tree")
    _, seen = verify(clone, monkeypatch, (0, "Cross-PR: none ok\n"))
    [check] = [c for c in seen if c.name == "crosspr"]
    assert check.argv[-3:] == ("s14-b9", "--tree", tree)
    git(clone, "switch", "-q", "--detach")
    _, seen = verify(clone, monkeypatch, (0, "Cross-PR: none ok\n"))
    [check] = [c for c in seen if c.name == "crosspr"]
    assert "HEAD" in check.argv


def test_a_listed_flake_never_excuses_crosspr(clone: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    code, seen = verify(clone, monkeypatch, (1, "FAILED scripts/tests/test_x.py::test_a - boom\n"))
    assert code == 1
    assert len([c for c in seen if c.name == "crosspr"]) == 1
