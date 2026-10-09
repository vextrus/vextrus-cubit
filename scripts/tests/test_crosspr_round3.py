"""Review round 1 of PR #491 (S14-B1): crosspr's one baseline rule, the line's per-PR statuses, the pipe
that a child outside the group holds, and verify's root-only excuse. Beside the acceptance tests."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest

from scripts.factory import crosspr
from scripts.tests.acceptance.ts14b1._world import CALC, World
from scripts.tests.test_crosspr_round1 import clone as clone
from scripts.tests.test_crosspr_round1 import describe, run
from scripts.tests.test_crosspr_round2 import TRUSTED, advance_main
from scripts.verify import main as verify_main

pytestmark = pytest.mark.serial  # signals and process groups: not under xdist (see ci.yml)

FAILING_TEST = "def test_already_red():\n    assert False\n"
RATE_TEST = "import calc\n\n\ndef test_rate_is_two():\n    assert calc.rate() == 2\n"
WITH_DOUBLE = CALC + "\n\ndef double(n):\n    return 2 * n\n"
OWN = {
    "calc.py": CALC.replace("A small", "An own"),
    "tests/test_own.py": "def test_a():\n    assert True\n",
}


def test_a_test_main_added_that_a_stale_pr_breaks_is_not_the_builders(tmp_path: Path) -> None:
    """Main gains a test on `rate()` after the PR was cut; the PR changes rate, so that test fails on
    main + the PR. It is in neither side's changed set (three-dot), so it is not run against the
    builder."""
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": CALC.replace("return 2", "return 9")})
    describe(world, 51, **TRUSTED)
    advance_main(world, {"tests/test_rate.py": RATE_TEST})
    world.own({"calc.py": CALC.replace("A small", "An own"), "README": "own\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 ok"


def test_the_builders_own_conflict_with_main_is_named_as_that(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(52, "s14-x2", {"calc.py": WITH_DOUBLE})
    describe(world, 52, **TRUSTED)
    world.own({"calc.py": CALC.replace("return 2", "return 3")})
    advance_main(world, {"calc.py": CALC.replace("return 2", "return 5")})
    world.git(world.work, "fetch", "-q", "origin")
    done = run(world)
    assert done.returncode == 1
    assert "your branch conflicts with main: merge main" in done.stderr
    assert "#52 and" not in done.stderr


def test_the_line_names_each_prs_status(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": WITH_DOUBLE})
    world.open_pr(53, "s14-x3", {"calc.py": CALC.replace("return 2", "return 4")})
    world.open_pr(55, "s14-x5", {"calc.py": CALC + "\n# five\n"})
    describe(world, 51, author={"login": "stranger"}, isCrossRepository=False)
    describe(world, 53, **TRUSTED)
    describe(world, 55, **TRUSTED)
    advance_main(world, {"calc.py": CALC.replace("return 2", "return 5")})
    world.own({"calc.py": CALC.replace("A small", "An own"), "README": "own\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 merge-only, #53 stale, #55 ok"


def test_the_line_says_merge_only_for_a_pr_whose_tests_never_ran(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": WITH_DOUBLE})
    world.open_pr(55, "s14-x5", {"calc.py": CALC + "\n# five\n"})
    describe(world, 51, author={"login": "stranger"}, isCrossRepository=False)
    describe(world, 55, **TRUSTED)
    world.own({"calc.py": CALC.replace("return 2", "return 3")})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 merge-only, #55 ok"


def test_a_child_outside_the_group_holding_the_pipe_does_not_hang_the_kill() -> None:
    leave = (
        "import subprocess, time;"
        "subprocess.Popen(['sleep', '20'], start_new_session=True); time.sleep(20)"
    )
    started = time.monotonic()
    with pytest.raises(crosspr.Refusal, match="timed out"):
        crosspr.call([sys.executable, "-c", leave], limit=1)
    assert time.monotonic() - started < 12


def test_a_root_only_excuse_never_covers_crosspr(clone: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (clone / ".github" / "flaky-root.txt").write_text("scripts/tests/test_x.py :: test_a\n")
    failure = (
        "FAILED scripts/tests/test_x.py::test_a - boom\n"
        "=========== 1 failed, 1 passed in 0.5s ===========\n"
    )

    def fail(name: str):  # type: ignore[no-untyped-def]
        return lambda check: (1, failure) if check.name == name else (0, "ok\n")

    monkeypatch.setattr(os, "geteuid", lambda: 0)
    monkeypatch.chdir(clone)
    assert verify_main([], run=fail("pytest")) == 0, "control: the excuse does cover a listed pytest"
    assert verify_main([], run=fail("crosspr")) == 1
