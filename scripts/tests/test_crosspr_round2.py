"""Review round 2 of S14-B1 (PR #479): a stale PR is not the builder's conflict, node tests run, and a
union with no runnable Python test is not a break. Beside, never inside, the acceptance tests."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14b1._world import CALC, World
from scripts.tests.test_crosspr_round1 import describe, run

TRUSTED = {"author": {"login": "vextrus"}, "isCrossRepository": False}
LIB = "export const f = () => 1;\n" + "// pad\n" * 8 + "export const g = () => 'g';\n"
LIB_TOTAL = LIB + "export const total = () => f() * 2;\n"
LIB_F3 = LIB.replace("() => 1", "() => 3")
TOTAL_TEST = (
    "import test from 'node:test';\nimport assert from 'node:assert';\n"
    "import { total } from './lib.mjs';\ntest('total', () => assert.equal(total(), 2));\n"
)
F3_TEST = (
    "import test from 'node:test';\nimport assert from 'node:assert';\n"
    "import { f } from './lib.mjs';\ntest('f', () => assert.equal(f(), 3));\n"
)


def advance_main(world: World, files: dict[str, str]) -> None:
    world.git(world.work, "switch", "-q", "main")
    world.write(files)
    world.git(world.work, "add", *files)
    world.git(world.work, "commit", "-q", "-m", "main moves")
    world.git(world.work, "push", "-q", "origin", "main")


def test_a_pr_that_conflicts_with_main_alone_is_not_the_builders_conflict(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(53, "s14-x3", {"calc.py": CALC.replace("return 2", "return 4")})
    describe(world, 53, **TRUSTED)
    advance_main(world, {"calc.py": CALC.replace("return 2", "return 5")})
    world.own({"calc.py": CALC.replace('return "calc"', 'return "own"'), "README": "own\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert "#53 conflicts with main (not yours)" in done.stderr
    assert done.stdout.strip() == "Cross-PR: #53 ok"


def test_a_conflict_that_appears_only_with_the_builders_tree_refuses_naming_both(
    tmp_path: Path,
) -> None:
    world = World(tmp_path)
    world.open_pr(53, "s14-x3", {"calc.py": CALC.replace("return 2", "return 4")})
    describe(world, 53, **TRUSTED)
    advance_main(world, {"README": "main moves\n"})
    world.own({"calc.py": CALC.replace("return 2", "return 3")})
    done = run(world)
    assert done.returncode == 1, done.stderr
    assert "#53 and s14-b9 conflict" in done.stderr


@pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
def test_both_sides_changing_node_tests_are_run_and_a_break_refuses(tmp_path: Path) -> None:
    world = World(tmp_path)
    advance_main(world, {"tools/mod/p/lib.mjs": LIB})
    world.open_pr(51, "s14-x1", {"tools/mod/p/lib.mjs": LIB_TOTAL, "tools/mod/p/a.test.mjs": TOTAL_TEST})
    describe(world, 51, **TRUSTED)
    world.own({"tools/mod/p/lib.mjs": LIB_F3, "tools/mod/p/b.test.mjs": F3_TEST})
    done = run(world)
    assert done.returncode == 1, done.stdout + done.stderr
    for part in ("#51", "a.test.mjs", "node tests failed"):
        assert part in done.stderr


@pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
def test_node_tests_that_pass_together_are_ok(tmp_path: Path) -> None:
    world = World(tmp_path)
    advance_main(world, {"tools/mod/p/lib.mjs": LIB})
    world.open_pr(51, "s14-x1", {"tools/mod/p/lib.mjs": LIB.replace("'g'", "'h'")})
    describe(world, 51, **TRUSTED)
    world.own({"tools/mod/p/lib.mjs": LIB_F3, "tools/mod/p/b.test.mjs": F3_TEST})
    done = run(world)
    assert done.returncode == 0, done.stdout + done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 ok"


def test_helpers_and_empty_test_files_are_not_a_break(tmp_path: Path) -> None:
    """Exit 5 from pytest (no test ran) is not a failure; a helper module is never collected."""
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": CALC + "\n# x\n", "tests/helpers.py": "VALUE = 1\n"})
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": CALC.replace("return 2", "return 3"), "tests/test_empty.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 0, done.stdout + done.stderr
    assert "no Python test ran" in done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 ok"
