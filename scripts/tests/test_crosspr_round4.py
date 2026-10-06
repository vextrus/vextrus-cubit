"""Round 2 of PR #491 (S14-B1): a PR's own red test must not hide the builder's collection or setup
error, and a node failure naming no file must not hide behind a baseline failure. Beside the
acceptance tests."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from scripts.factory import crosspr
from scripts.tests.acceptance.ts14b1._world import CALC, World
from scripts.tests.test_crosspr_round1 import describe, run
from scripts.tests.test_crosspr_round2 import TRUSTED

RED = "def test_already_red():\n    assert False\n"
USES_NAME = "from calc import name\n\n\ndef test_name():\n    assert name() == 'calc'\n"
FIXTURE = (
    "import calc\nimport pytest\n\n\n@pytest.fixture\ndef label():\n    return calc.name()\n\n\n"
    "def test_label(label):\n    assert label == 'calc'\n"
)
NO_NAME = CALC.replace('def name():\n    return "calc"\n', "")
PADDED = CALC.replace("A small", "A tiny")


def refused_naming_both(world: World, second: dict[str, str]) -> None:
    world.open_pr(51, "s14-x1", {"calc.py": PADDED, "tests/test_x1_red.py": RED, **second})
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": NO_NAME, "tests/test_own.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 1, done.stdout + done.stderr
    assert "#51 and s14-b9 break each other" in done.stderr


def test_a_prs_red_test_does_not_hide_a_collection_error_the_builder_causes(tmp_path: Path) -> None:
    refused_naming_both(World(tmp_path), {"tests/test_x1_name.py": USES_NAME})


def test_a_prs_red_test_does_not_hide_a_fixture_setup_error_the_builder_causes(
    tmp_path: Path,
) -> None:
    refused_naming_both(World(tmp_path), {"tests/test_x1_fixture.py": FIXTURE})


def test_a_prs_own_red_test_alone_is_still_not_the_builders(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": PADDED, "tests/test_x1_red.py": RED})
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": CALC.replace('return "calc"', 'return "own"'), "tests/test_own.py": "X = 1\n"})
    done = run(world)
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == "Cross-PR: #51 fails-on-main"


def answer(code: int, text: str) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess([], code, text, "")


def node_run(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, code: int, text: str) -> crosspr.Tests:
    monkeypatch.setattr(crosspr, "call", lambda *a, **k: answer(code, text))
    one = crosspr.Tests(tmp_path, tmp_path, "n")
    one.collect(["node"], "n", "node", ["tools/mod/p/a.test.mjs"], ok=(0,))
    return one


def test_a_node_failure_naming_no_file_is_refused_unless_the_baseline_failed_so(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    named = node_run(monkeypatch, tmp_path, 1, "not ok tools/mod/p/a.test.mjs\n")
    nameless = node_run(monkeypatch, tmp_path, 1, "the runner exploded\n")
    clean = node_run(monkeypatch, tmp_path, 0, "ok\n")
    assert nameless.broke_beyond(named)
    assert nameless.broke_beyond(clean)
    assert not nameless.broke_beyond(node_run(monkeypatch, tmp_path, 1, "it exploded too\n"))
    assert not named.broke_beyond(named)


def test_a_pytest_exit_other_than_0_1_5_refuses_unless_the_baseline_exited_so(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def py(code: int, text: str) -> crosspr.Tests:
        monkeypatch.setattr(crosspr, "call", lambda *a, **k: answer(code, text))
        one = crosspr.Tests(tmp_path, tmp_path, "p")
        one.collect(["pytest"], "p", "Python", ["t.py"], ok=(0, 5))
        return one

    interrupted = py(2, "ERROR t.py\n1 error in 0.1s\n")
    red = py(1, "FAILED t.py::a - x\n1 failed in 0.1s\n")
    assert interrupted.broke_beyond(red)
    assert not interrupted.broke_beyond(py(2, "ERROR t.py\n1 error in 0.1s\n"))
