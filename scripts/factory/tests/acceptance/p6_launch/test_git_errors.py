"""Ticket T-LAUNCH, section 3 B (#310): a git command that did not run is an ERROR (exit 1, with a
record whose judge code is `error`), never a refusal that says the branch or the checkout is wrong.
A fake `git` first on PATH runs the real one except the named subcommand."""

from __future__ import annotations

import importlib
from typing import Any

import pytest

from ._support import FakeClaude, World, cloud, git

# Typed Any: the seams this ticket adds do not exist on the base, and mypy must pass there.
launch: Any = importlib.import_module("scripts.factory.launch")


def assert_error_record(world: World) -> None:
    record = world.only_record()
    judged = record["judge"]
    assert isinstance(judged, dict)
    assert judged["ok"] is False
    assert judged["code"] == "error"
    assert isinstance(judged["reason"], str)
    assert judged["reason"]


@pytest.mark.parametrize("mode", ["fail", "hang"])
def test_b1_ls_remote_that_did_not_answer_is_an_error_not_branch_not_on_origin(
    world: World,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
) -> None:
    monkeypatch.setattr(launch, "TOOL_TIMEOUT", 1)
    world.fake_git("ls-remote", mode)
    claude = FakeClaude()
    code, lines = cloud(world, capsys, claude)
    assert code == 1, lines
    assert lines[0].startswith("ERROR git ls-remote"), lines
    assert not any(line.startswith("REFUSED branch-not-on-origin") for line in lines)
    assert claude.calls == []
    assert_error_record(world)


def test_b1_a_branch_really_absent_from_a_healthy_origin_is_still_refused(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude()
    code, lines = cloud(world, capsys, claude, branch="s12-absent")
    assert code == 2, lines
    assert lines[0].startswith("REFUSED branch-not-on-origin: "), lines
    assert claude.calls == []


def test_b2_rev_parse_failing_in_the_main_checkout_is_an_error_not_not_main_checkout(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    world.fake_git("rev-parse")
    claude = FakeClaude()
    code, lines = cloud(world, capsys, claude)
    assert code == 1, lines
    assert lines[0].startswith("ERROR git rev-parse"), lines
    assert not any(line.startswith("REFUSED not-main-checkout") for line in lines)
    assert claude.calls == []
    assert_error_record(world)


def test_b2_a_linked_worktree_and_a_subdirectory_are_still_not_the_main_checkout(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = world.tmp / "wt"
    git(world.main, "worktree", "add", "-q", "-b", "wt-branch", str(tree))
    sub = world.main / "sub"
    sub.mkdir()
    for root in (tree, sub):
        monkeypatch.chdir(root)
        claude = FakeClaude()
        code, lines = cloud(world, capsys, claude, root=root)
        assert code == 2, (root, lines)
        assert lines[0].startswith("REFUSED not-main-checkout: "), lines
        assert claude.calls == []
