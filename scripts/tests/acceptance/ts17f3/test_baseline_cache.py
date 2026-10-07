"""S17-F3: crosspr keeps each overlapping PR's baseline (its tests on main + the PR alone) and does not
run it again while it would be the same run: the key is "(origin/main sha, PR head sha, sorted test-file
list)" (verify-ci-speed.md 2, item 1 (b): "A hit skips the baseline worktree run; only the union runs").
A changed head, a moved main or another test-file list is a miss and runs the baseline again."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14b1._world import World
from scripts.tests.acceptance.ts17f3._world import (
    NAME_TEST,
    OWN_CALC,
    RATE_TEST,
    TINY,
    TRUSTED,
    Check,
    advance_main,
    commit,
    describe,
    names,
    new_pr_head,
    one_pr_world,
    show,
    two_pr_world,
)

AGAIN = "the baseline ran again"


def main_test_world(tmp: Path) -> World:
    """Main holds tests/test_main_calc.py before PR #51 opens: a builder can change a test of main's."""
    world = World(tmp)
    world.write({"tests/test_main_calc.py": RATE_TEST})
    world.git(world.work, "add", "tests/test_main_calc.py")
    world.git(world.work, "commit", "-q", "-m", "main holds a test")
    world.git(world.work, "push", "-q", "origin", "main")
    return world


def test_a_second_check_with_unchanged_shas_runs_no_baseline_again(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    check = Check(two_pr_world(tmp_path), monkeypatch, capsys)
    first = check()
    assert first.code == 0, show(first)
    assert first.out.strip() == "Cross-PR: #51 #53 ok", show(first)
    assert len(first.baselines()) == 2, show(first)

    second = check()
    assert second.code == 0, show(second)
    assert second.out.strip() == "Cross-PR: #51 #53 ok", show(second)
    assert second.baselines() == [], f"{AGAIN}: {show(second)}"
    assert second.sides() == ["union", "union"], show(second)


def test_a_kept_red_baseline_still_says_not_checked_without_running(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    check = Check(one_pr_world(tmp_path), monkeypatch, capsys, red={"baseline"})
    first = check()
    assert first.out.strip() == "Cross-PR: #51 not checked", show(first)
    assert first.sides() == ["baseline"], show(first)

    second = check()
    assert second.code == 0, show(second)
    assert second.runs == [], f"{AGAIN}: {show(second)}"
    assert second.out.strip() == "Cross-PR: #51 not checked", show(second)
    assert "#51 not checked (its own tests are not green on main)" in second.err, show(second)


def test_a_changed_pr_head_runs_the_baseline_again_then_keeps_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    world = one_pr_world(tmp_path)
    check = Check(world, monkeypatch, capsys)
    first = check()
    assert first.sides() == ["baseline", "union"], show(first)
    kept = check()
    assert kept.baselines() == [], f"{AGAIN}: {show(kept)}"

    new_pr_head(world, 51, {"tests/test_x1_name.py": NAME_TEST + "\n# a new head\n"})
    moved = check()
    assert moved.code == 0, show(moved)
    assert moved.sides() == ["baseline", "union"], show(moved)
    again = check()
    assert again.baselines() == [], f"{AGAIN}: {show(again)}"


def test_a_moved_main_runs_the_baseline_again_then_keeps_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    world = one_pr_world(tmp_path)
    check = Check(world, monkeypatch, capsys)
    first = check()
    assert first.sides() == ["baseline", "union"], show(first)
    kept = check()
    assert kept.baselines() == [], f"{AGAIN}: {show(kept)}"

    advance_main(world, {"README": "main moves\n"})
    moved = check()
    assert moved.code == 0, show(moved)
    assert moved.sides() == ["baseline", "union"], show(moved)
    again = check()
    assert again.baselines() == [], f"{AGAIN}: {show(again)}"


def test_another_test_file_list_runs_the_baseline_again_then_keeps_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Same main, same PR head: the builder now changes a test file main already has, so the baseline's
    test-file list gains it and the kept result (which never ran that file) is not the answer."""
    world = main_test_world(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": TINY, "tests/test_x1_name.py": NAME_TEST})
    describe(world, 51, **TRUSTED)
    world.own({"calc.py": OWN_CALC, "b9.txt": "own\n"})
    check = Check(world, monkeypatch, capsys)
    first = check()
    assert first.sides() == ["baseline", "union"], show(first)
    kept = check()
    assert kept.baselines() == [], f"{AGAIN}: {show(kept)}"

    commit(world, {"tests/test_main_calc.py": RATE_TEST + "\n# the builder's\n"}, "own: a main test")
    listed = check()
    assert listed.code == 0, show(listed)
    assert listed.sides() == ["baseline", "union"], show(listed)
    assert names(listed.baselines()[0].argv, "tests/test_main_calc.py"), show(listed)
    again = check()
    assert again.baselines() == [], f"{AGAIN}: {show(again)}"
