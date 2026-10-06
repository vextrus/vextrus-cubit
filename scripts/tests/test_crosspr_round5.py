"""Round 3 of PR #491 (S14-B1): an unimportable PR test file never hides another test, a baseline
that collects nothing is uncheckable, and a PR test that hangs is its own.
Beside the acceptance tests."""

from __future__ import annotations

import os
import time
from pathlib import Path

from scripts.tests.acceptance.ts14b1._world import CALC, World
from scripts.tests.test_crosspr_round1 import describe, run
from scripts.tests.test_crosspr_round2 import TRUSTED

BAD = "import not_a_module_anywhere\n\n\ndef test_never():\n    assert True\n"
NAME_TEST = "import calc\n\n\ndef test_name():\n    assert calc.name() == 'calc'\n"
NO_NAME = CALC.replace('def name():\n    return "calc"\n', "")
TINY = CALC.replace("A small", "A tiny")


def test_an_unimportable_pr_test_file_does_not_hide_a_real_test_the_builder_breaks(
    tmp_path: Path,
) -> None:
    world = World(tmp_path)
    world.open_pr(
        51, "s14-x1", {"calc.py": TINY, "tests/test_x1_bad.py": BAD, "tests/test_x1_name.py": NAME_TEST}
    )
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": NO_NAME, "tests/test_own.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 1, done.stdout + done.stderr
    assert "#51 and s14-b9 break each other" in done.stderr
    assert "test_x1_name" in done.stderr


def test_a_baseline_that_collects_nothing_is_uncheckable_and_the_line_says_so(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": TINY, "tests/test_x1_bad.py": BAD})
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": CALC.replace('return "calc"', 'return "own"'), "tests/test_own.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert "#51 uncheckable (collects nothing on main)" in done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 uncheckable"


def test_a_pr_whose_own_test_hangs_is_hangs_on_main_within_the_limit(tmp_path: Path) -> None:
    world = World(tmp_path)
    hang = "import time\n\n\ndef test_hangs():\n    time.sleep(60)\n"
    world.open_pr(51, "s14-x1", {"calc.py": TINY, "tests/test_x1_hang.py": hang})
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": CALC.replace('return "calc"', 'return "own"'), "tests/test_own.py": "X = 1\n"})
    os.environ["CROSSPR_TEST_SECONDS"] = "3"
    try:
        started = time.monotonic()
        done = run(world)
    finally:
        del os.environ["CROSSPR_TEST_SECONDS"]
    assert done.returncode == 0, done.stderr
    assert "#51 hangs on main: not yours" in done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 hangs-on-main"
    assert time.monotonic() - started < 25
