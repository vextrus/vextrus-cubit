"""PR #512 review round 1: the allowlist batch is resumable. A step that fails leaves nothing a rerun
cannot finish: a push rejected once is pushed by the rerun, and a PR that `gh` failed to open after a
good push is opened by the rerun without a second push.

Built on ticket S14-P7's acceptance world (`scripts/tests/acceptance/ts14p7/_world.py`, imported, never
changed): a temporary origin (here with a `pre-receive` hook that counts and can reject pushes), an
invented corpus, a fake `gh` (here behind a wrapper that can fail `pr create` once).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14p7._world import (
    BRAMBLE,
    World,
    assert_no_text,
    hit_file,
    normalise,
    sha256_text,
    show,
    stub,
)

ALLOWLIST = "tools/leakscan/allowlist.txt"


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    made.commit("s99-a1", {"docs/plan.md": hit_file(2, BRAMBLE)}, "feat: the plan\n")
    made.to_origin("s99-a1")
    hook = made.origin / "hooks" / "pre-receive"
    stub(
        hook,
        f"marks = {str(made.tmp)!r}\n"
        "lines = [line.split() for line in sys.stdin.read().splitlines() if line.strip()]\n"
        "if any(ref.startswith('refs/heads/allowlist-') for _, _, ref in lines):\n"
        "    with open(os.path.join(marks, 'allowlist-pushes.log'), 'a') as handle:\n"
        "        handle.write('push\\n')\n"
        "    reject = os.path.join(marks, 'reject-once')\n"
        "    if os.path.exists(reject):\n"
        "        os.remove(reject)\n"
        "        sys.exit(1)\n",
    )
    wrapper = made.tmp / "gh-wrapper"
    wrapper.mkdir()
    stub(
        wrapper / "gh",
        f"marks = {str(made.tmp)!r}\n"
        f"real = {str(made.stubs / 'gh')!r}\n"
        "fail = os.path.join(marks, 'gh-fail-once')\n"
        "if sys.argv[1:3] == ['pr', 'create'] and os.path.exists(fail):\n"
        "    os.remove(fail)\n"
        "    sys.exit(1)\n"
        "os.execv(real, [real, *sys.argv[1:]])\n",
    )
    return made


def batch(world: World) -> subprocess.CompletedProcess[str]:
    hits = world.tmp / "hits.txt"
    hits.write_text("s99-a1:docs/plan.md:2\n")
    env = world.env()
    env["PATH"] = f"{world.tmp / 'gh-wrapper'}{os.pathsep}{env['PATH']}"
    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.allowlist", "batch", "--from", str(hits)],
        cwd=world.main,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=600,
        check=False,
    )
    assert_no_text(done.stdout, done.stderr)
    return done


def allowlist_refs(world: World) -> dict[str, str]:
    return {k: v for k, v in world.origin_refs().items() if k.startswith("refs/heads/allowlist-")}


def pushes(world: World) -> int:
    log = world.tmp / "allowlist-pushes.log"
    return len(log.read_text().splitlines()) if log.exists() else 0


def added(world: World, head: str) -> set[str]:
    world.git(world.main, "fetch", "-q", "origin")
    diff = world.git(world.main, "diff", "--unified=0", "origin/main", head, "--", ALLOWLIST)
    return {line[1:] for line in diff.splitlines() if line.startswith("+") and line[:3] != "+++"}


def test_a_push_rejected_once_is_pushed_by_the_rerun_which_opens_the_pr(world: World) -> None:
    (world.tmp / "reject-once").write_text("")

    first = batch(world)

    assert first.returncode != 0, show(first)
    assert allowlist_refs(world) == {}
    assert world.prs_created() == []

    again = batch(world)

    assert again.returncode == 0, show(again)
    [(ref, head)] = allowlist_refs(world).items()
    assert added(world, head) == {sha256_text(normalise(BRAMBLE))}
    [created] = world.prs_created()
    assert created["argv"][created["argv"].index("--head") + 1] == ref.removeprefix("refs/heads/")


def test_a_pr_gh_failed_to_open_after_a_good_push_is_opened_by_the_rerun_without_a_second_push(
    world: World,
) -> None:
    (world.tmp / "gh-fail-once").write_text("")

    first = batch(world)

    assert first.returncode != 0, show(first)
    pushed = allowlist_refs(world)
    assert len(pushed) == 1
    assert pushes(world) == 1
    assert world.prs_created() == []

    again = batch(world)

    assert again.returncode == 0, show(again)
    assert allowlist_refs(world) == pushed, "the rerun moved the pushed branch"
    assert pushes(world) == 1, "the rerun pushed again"
    assert len(world.prs_created()) == 1

    third = batch(world)

    assert third.returncode == 0, show(third)
    assert pushes(world) == 1
    assert len(world.prs_created()) == 1, "a rerun with the PR open opened another"


# --- PR #512 review round 2: a commit is reused only on the current origin/main
def land_allowlist_line_on_main(world: World) -> str:
    """Another allowlist line lands on main (appended, where the batch appends too)."""
    world.git(world.work, "fetch", "-q", "origin")
    world.git(world.work, "checkout", "-q", "main")
    world.git(world.work, "merge", "-q", "--ff-only", "origin/main")
    current = world.git(world.work, "show", f"origin/main:{ALLOWLIST}")
    other = sha256_text("ANOTHER JUDGED STRING")
    world.commit("main", {ALLOWLIST: f"{current}\n{other}\n"}, "leakscan: another allowlist line\n")
    world.git(world.work, "push", "-q", "origin", "main")
    world.git(world.main, "fetch", "-q", "origin")
    return world.git(world.main, "rev-parse", "origin/main")


def merges_cleanly(world: World, head: str) -> bool:
    done = subprocess.run(
        ["git", "merge-tree", "--write-tree", "origin/main", head],
        cwd=world.main,
        env=world.git.env(),
        capture_output=True,
        text=True,
        check=False,
    )
    return done.returncode == 0


def opened_head(world: World) -> tuple[str, str]:
    [created] = world.prs_created()
    branch = created["argv"][created["argv"].index("--head") + 1]
    world.git(world.main, "fetch", "-q", "origin")
    return branch, world.origin_refs()[f"refs/heads/{branch}"]


def test_a_rerun_after_main_moved_builds_the_batch_on_main_so_its_pr_merges_cleanly(
    world: World,
) -> None:
    (world.tmp / "reject-once").write_text("")
    assert batch(world).returncode != 0
    main = land_allowlist_line_on_main(world)

    again = batch(world)

    assert again.returncode == 0, show(again)
    _, head = opened_head(world)
    assert world.git(world.main, "rev-parse", f"{head}^") == main, "the PR's head is not on main"
    assert merges_cleanly(world, head), "the PR's head conflicts with main"


def test_a_rerun_with_main_unchanged_reuses_the_batch_commit(world: World) -> None:
    (world.tmp / "reject-once").write_text("")
    assert batch(world).returncode != 0
    [local] = [
        line.split()[0]
        for line in world.git(world.main, "for-each-ref", "refs/heads/allowlist-*").splitlines()
    ]

    again = batch(world)

    assert again.returncode == 0, show(again)
    _, head = opened_head(world)
    assert head == local, "the rerun rebuilt a commit it could reuse"


def test_a_branch_on_origin_built_on_an_older_main_is_rebuilt_under_a_new_name(
    world: World,
) -> None:
    (world.tmp / "gh-fail-once").write_text("")
    assert batch(world).returncode != 0
    [(stale_ref, stale)] = allowlist_refs(world).items()
    main = land_allowlist_line_on_main(world)

    again = batch(world)

    assert again.returncode == 0, show(again)
    branch, head = opened_head(world)
    assert branch == f"{stale_ref.removeprefix('refs/heads/')}-{main[:12]}"
    assert world.git(world.main, "rev-parse", f"{head}^") == main
    assert merges_cleanly(world, head)
    assert world.origin_refs()[stale_ref] == stale, "the stale branch on origin was moved"
