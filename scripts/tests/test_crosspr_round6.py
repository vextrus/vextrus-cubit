"""Round 1 of PR #509 (S14-B1): crosspr's baseline rule has no subtraction."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14b1._world import BRANCH, CALC, REPO, World
from scripts.tests.test_crosspr_round1 import describe, run
from scripts.tests.test_crosspr_round2 import (
    F3_TEST,
    LIB,
    LIB_F3,
    TRUSTED,
    advance_main,
)

GREEN_TEST = "import calc\n\n\ndef test_name():\n    assert calc.name() == 'calc'\n"
TINY = CALC.replace("A small", "A tiny")
NO_NAME = CALC.replace('def name():\n    return "calc"\n', "")
RED_NODE = (
    "import test from 'node:test';\nimport assert from 'node:assert';\n"
    "test('red', () => assert.equal(1, 2));\n"
)


def green_pr_world(tmp_path: Path) -> World:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": TINY, "tests/test_x1_name.py": GREEN_TEST})
    describe(world, 51, **TRUSTED)
    return world


def test_a_green_pr_plus_a_builder_break_refuses_naming_both(tmp_path: Path) -> None:
    world = green_pr_world(tmp_path)
    world.own({"calc.py": NO_NAME, "tests/test_own.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 1, done.stdout + done.stderr
    assert "#51 and s14-b9 break each other" in done.stderr


def test_a_green_pr_plus_a_clean_builder_is_ok(tmp_path: Path) -> None:
    world = green_pr_world(tmp_path)
    world.own({"calc.py": CALC.replace('return "calc"', 'return "calc"  # own'), "README": "own\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 ok"


def test_the_time_limit_is_never_read_from_the_environment(tmp_path: Path) -> None:
    world = green_pr_world(tmp_path)
    world.own({"calc.py": NO_NAME, "tests/test_own.py": "X = 1\n"})
    env = dict(world.env())
    env.update(
        PATH=f"{world.bin}{os.pathsep}{os.environ.get('PATH', '')}",
        PYTHONPATH=str(REPO),
        CROSSPR_TEST_SECONDS="0",
    )
    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.crosspr", BRANCH],
        cwd=world.work,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 1, done.stdout + done.stderr
    assert "#51 and s14-b9 break each other" in done.stderr


def test_a_pr_whose_own_python_test_is_red_is_not_checked_never_ok(tmp_path: Path) -> None:
    world = World(tmp_path)
    red = "def test_red():\n    assert False\n"
    world.open_pr(51, "s14-x1", {"calc.py": TINY, "tests/test_x1_red.py": red})
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": CALC.replace('return "calc"', 'return "own"'), "tests/test_own.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert "#51 not checked (its own tests are not green on main)" in done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 not checked"


def test_a_pr_with_an_unimportable_test_file_is_not_checked(tmp_path: Path) -> None:
    world = World(tmp_path)
    bad = "import not_a_module_anywhere\n\n\ndef test_never():\n    assert True\n"
    world.open_pr(
        51, "s14-x1", {"calc.py": TINY, "tests/test_x1_bad.py": bad, "tests/test_x1_name.py": GREEN_TEST}
    )
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": NO_NAME, "tests/test_own.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 not checked"


@pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
def test_a_pr_with_a_red_node_test_and_a_builder_break_in_the_same_file_is_not_checked(
    tmp_path: Path,
) -> None:
    world = World(tmp_path)
    advance_main(world, {"tools/mod/p/lib.mjs": LIB})
    world.open_pr(
        51,
        "s14-x1",
        {"tools/mod/p/lib.mjs": LIB.replace("'g'", "'h'"), "tools/mod/p/a.test.mjs": RED_NODE},
    )
    describe(world, 51, **TRUSTED)
    world.own({"tools/mod/p/lib.mjs": LIB_F3, "tools/mod/p/b.test.mjs": F3_TEST})
    done = run(world)
    assert done.returncode == 0, done.stdout + done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 not checked"
