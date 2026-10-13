"""review self's base and its uncommitted work (S25-F1, PR 748 round 1), in the acceptance world."""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts25f1._world import (
    BRANCH_MARK,
    HANG,
    MAIN_MARK,
    REPO,
    World,
    commit,
    git,
    script,
)

pytestmark = pytest.mark.serial  # the Ctrl-C test sends a signal: not under xdist (see ci.yml)

STAGED_MARK = "STAGED_EDIT_MARK_1A"
UNSTAGED_MARK = "UNSTAGED_EDIT_MARK_2B"
UNTRACKED_MARK = "UNTRACKED_FILE_MARK_3C"


@pytest.fixture
def world(tmp_path: Path) -> World:
    return World(tmp_path)


def given(world: World) -> list[str]:
    return [call["stdin"] + "\n".join(call["files"].values()) for call in world.calls()]


def test_the_base_is_origin_main_when_the_local_main_lags(world: World) -> None:
    """The builder merged origin/main; the local `main` was never pulled. Main's commits are not the
    builder's change."""
    git(world.main, "reset", "-q", "--hard", "HEAD~1")  # the local main is back at the cut
    git(world.worktree, "merge", "-q", "--no-edit", "origin/main")
    ran = world.run()
    seen = given(world)
    assert len(seen) == 2, ran.text
    for text in seen:
        assert BRANCH_MARK in text
        assert MAIN_MARK not in text


def test_the_base_is_fetched_first(world: World) -> None:
    """origin/main moved after the worktree's last fetch: the merge of it is not the builder's change."""
    clone = world.tmp / "other"
    git(world.tmp, "clone", "-q", str(world.origin), str(clone))
    for key, value in (("user.name", "T"), ("user.email", "t@example.invalid")):
        git(clone, "config", key, value)
    (clone / "later.py").write_text('LATER = "LATER_MARK_5E"\n')
    git(clone, "add", "later.py")
    git(clone, "commit", "-q", "-m", "later")
    git(clone, "push", "-q", "origin", "main")
    git(world.worktree, "fetch", "-q", "origin")
    git(world.worktree, "merge", "-q", "--no-edit", "origin/main")
    git(clone, "checkout", "-q", "-b", "x")  # the clone is only a pusher
    ran = world.run()
    assert len(given(world)) == 2, ran.text
    assert all("LATER_MARK_5E" not in text for text in given(world))


def test_staged_unstaged_and_untracked_work_reaches_the_lenses(world: World) -> None:
    table = world.worktree / "vextrus" / "rates" / "table.py"
    table.write_text(f'STAGED = "{STAGED_MARK}"\n')
    git(world.worktree, "add", "vextrus/rates/table.py")
    branch = world.worktree / "vextrus" / "rates" / "branch_change.py"
    branch.write_text(branch.read_text() + f'\nUNSTAGED = "{UNSTAGED_MARK}"\n')
    (world.worktree / "vextrus" / "rates" / "new.py").write_text(f'NEW = "{UNTRACKED_MARK}"\n')
    ran = world.run()
    seen = given(world)
    assert len(seen) == 2, ran.text
    for text in seen:
        for mark in (BRANCH_MARK, STAGED_MARK, UNSTAGED_MARK, UNTRACKED_MARK):
            assert mark in text, mark


def test_the_lenses_carry_no_write_grant(world: World) -> None:
    from scripts.factory import review_self

    ran = world.run()
    calls = world.calls()
    assert len(calls) == 2, ran.text
    for call in calls:
        argv = call["argv"]
        allowed = argv[argv.index("--allowedTools") + 1].split(",")
        denied = argv[argv.index("--disallowedTools") + 1].split(",")
        assert not [tool for tool in allowed if tool.startswith(("Edit", "Write", "NotebookEdit"))]
        assert {"Edit", "Write", "NotebookEdit"} <= set(denied)
    assert all(not lens.writes for lens in review_self.SELF_LENSES)


def test_a_hung_fetch_falls_back_to_the_refs_here_without_a_traceback(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_REVIEW_SELF_FETCH_TIMEOUT", "2")
    real = shutil.which("git")
    script(
        world.bin / "git",
        f'#!/bin/sh\ncase " $* " in *" fetch "*) exec sleep 600;; esac\nexec {real} "$@"\n',
    )
    start = time.monotonic()
    ran = world.run()
    assert time.monotonic() - start < 120
    assert ran.code == 0, ran.text
    assert "Traceback" not in ran.text
    assert "timed out" in ran.stderr
    assert len(world.calls()) == 2


FIX_MARK = "FIX_ROUND_MARK_6F"
LATER_MARK = "LATER_MAIN_MARK_8H"


def fix_round(world: World) -> str:
    """A fix round on the previous head: merge origin/main (it gained a commit since), then the fix."""
    previous = git(world.worktree, "rev-parse", "HEAD").strip()
    git(world.worktree, "merge", "-q", "--no-edit", "origin/main")
    commit(world.worktree, {"vextrus/rates/fix.py": f'FIX = "{FIX_MARK}"\n'}, "the fix round")
    return previous


def test_a_fix_rounds_diff_leaves_out_the_main_it_merged(world: World) -> None:
    previous = fix_round(world)
    ran = world.run("--base", previous)
    seen = given(world)
    assert len(seen) == 2, ran.text
    for text in seen:
        assert FIX_MARK in text
        assert MAIN_MARK not in text  # main's commit is not the fix
        assert "main moves on after the cut" not in text
        assert BRANCH_MARK not in text  # the previous rounds are not this round's change


def test_a_main_fetched_after_the_merge_does_not_show_as_removed(world: World) -> None:
    previous = fix_round(world)
    clone = world.tmp / "other"
    git(world.tmp, "clone", "-q", str(world.origin), str(clone))
    for name, value in (("user.name", "T"), ("user.email", "t@example.invalid")):
        git(clone, "config", name, value)
    (clone / "later.py").write_text(f'LATER = "{LATER_MARK}"\n')
    git(clone, "add", "later.py")
    git(clone, "commit", "-q", "-m", "later")
    git(clone, "push", "-q", "origin", "main")
    git(world.worktree, "fetch", "-q", "origin")  # origin/main is now past what the head holds
    ran = world.run("--base", previous)
    seen = given(world)
    assert len(seen) == 2, ran.text
    for text in seen:
        assert FIX_MARK in text
        assert LATER_MARK not in text  # as an addition or as a removal


def test_a_base_that_is_not_an_ancestor_keeps_the_three_dot_diff(world: World) -> None:
    ran = world.run("--base", "origin/main")
    seen = given(world)
    assert len(seen) == 2, ran.text
    for text in seen:
        assert BRANCH_MARK in text
        assert MAIN_MARK not in text


HANGING_CLAUDE = """#!{python}
import sys, time
from pathlib import Path
sys.stdin.read()
Path({marker!r}).write_text("up")
time.sleep(600)
"""


def cmdlines() -> list[bytes]:
    found: list[bytes] = []
    for entry in Path("/proc").glob("[0-9]*"):
        try:
            found.append((entry / "cmdline").read_bytes())
        except OSError:
            continue
    return found


def test_ctrl_c_kills_the_lenses_and_ends_the_run(world: World) -> None:
    """The lenses run in their own sessions and never see Ctrl-C: review self kills them itself."""
    marker = world.tmp / "lens-up"
    fake = world.bin / "claude"
    script(fake, HANGING_CLAUDE.format(python=sys.executable, marker=str(marker)))
    env = {
        name: value
        for name, value in os.environ.items()
        if name not in ("CLAUDE_PROJECT_DIR", "VEXTRUS_DB_NAME", "GIT_DIR", "GIT_WORK_TREE")
    }
    env["PATH"] = f"{world.bin}{os.pathsep}{env.get('PATH', '')}"
    env["PYTHONPATH"] = str(REPO)
    env["VEXTRUS_REVIEW_LENS_TIMEOUT"] = str(HANG)
    run = subprocess.Popen(
        [sys.executable, "-m", "scripts.factory.review_self"],
        cwd=world.worktree,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        deadline = time.monotonic() + 60
        while not marker.exists() and time.monotonic() < deadline:
            time.sleep(0.1)
        assert marker.exists(), "the lens never started"
        time.sleep(0.5)
        run.send_signal(signal.SIGINT)
        try:
            _, stderr = run.communicate(timeout=30)
        except subprocess.TimeoutExpired:
            pytest.fail("review self did not end within 30 s of Ctrl-C")
        assert run.returncode == 128 + signal.SIGINT, stderr
        assert "Traceback" not in stderr
        time.sleep(0.5)
        assert not [line for line in cmdlines() if str(fake).encode() in line], "a lens is still running"
    finally:
        if run.poll() is None:
            run.kill()
            run.wait()
