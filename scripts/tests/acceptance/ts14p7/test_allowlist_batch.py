"""Ticket S14-P7, issue #461 (part A, tooling): the allowlist batch tool.

The authority:
- factory-next.md 8, row 14: "allowlist batch tool".
- Issue #461, "Fix" A: "`scripts/factory/allowlist.py batch --from hits.txt`: from a list of
  `branch:file:line`, make the worktree off origin/main, run the main checkout's `leakscan allow`,
  commit, range-scan, publish and open the PR with a standard body (one command for about 8)";
  "Acceptance check": "`test_allowlist.py`: a fixture repo and hits list produce a branch whose diff is
  only hash lines."
- The orchestrator's brief: pin "that it adds only 64-hex lines and refuses anything else".

So `python -m scripts.factory.allowlist batch --from <hits file>`, run in the main checkout. Pinned: the
one branch it puts on origin differs from origin/main only in `tools/leakscan/allowlist.txt`, by added
lines that are each a 64-hex hash, exactly the hashes of the corpus strings on the listed lines (the
scanner's `allow` hashes the normalised string, leakscan-cli.md 1); one PR is opened for it; and a list
holding any line that is not a hit (malformed, no branch, a line with no hit, a path out of the tree) is
refused whole: non-zero, nothing pushed, no PR. The committed allowlist beside this repository's own
scanner is never written. Not pinned: the new branch's name, the PR's title and body words, where the
worktree goes.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14p7._world import (
    BRAMBLE,
    HEX64,
    REPO,
    TAMARIND,
    World,
    assert_no_text,
    flag,
    hit_file,
    normalise,
    sha256_text,
    show,
)

ALLOWLIST = "tools/leakscan/allowlist.txt"
REAL_ALLOWLIST = REPO / ALLOWLIST


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    # Two cloud builders' branches on origin, each with one hit (an invented corpus string).
    made.commit("s99-a1", {"docs/plan.md": hit_file(2, BRAMBLE)}, "feat: the plan\n")
    made.to_origin("s99-a1")
    made.commit("s99-b1", {"src/notes.txt": hit_file(3, TAMARIND)}, "feat: the notes\n")
    made.to_origin("s99-b1")
    return made


def batch(world: World, *lines: str) -> subprocess.CompletedProcess[str]:
    hits = world.tmp / "hits.txt"
    hits.write_text("".join(f"{line}\n" for line in lines))
    return world.run("scripts.factory.allowlist", "batch", "--from", str(hits))


def test_a_batch_puts_one_branch_on_origin_whose_diff_adds_only_the_hits_hashes_and_opens_its_pr(
    world: World,
) -> None:
    real = REAL_ALLOWLIST.read_bytes()
    before = world.origin_refs()

    done = batch(world, "s99-a1:docs/plan.md:2", "s99-b1:src/notes.txt:3")

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode == 0, show(done)
    assert REAL_ALLOWLIST.read_bytes() == real, "the batch wrote this repository's own allowlist"
    after = world.origin_refs()
    new = [name for name in after if name not in before]
    assert len(new) == 1, f"new refs on origin: {new}"
    assert new[0].startswith("refs/heads/"), new
    assert {k: v for k, v in after.items() if k in before} == before, "the batch moved another ref"
    branch = new[0].removeprefix("refs/heads/")
    head = after[new[0]]
    world.git(world.main, "fetch", "-q", "origin")

    changed = world.git(world.main, "diff", "--name-only", "origin/main", head).splitlines()
    assert changed == [ALLOWLIST], f"the batch changed {changed}"
    diff = world.git(world.main, "diff", "--unified=0", "origin/main", head, "--", ALLOWLIST)
    body = [
        line for line in diff.splitlines() if line[:1] in "+-" and not line.startswith(("+++", "---"))
    ]
    removed = [line for line in body if line.startswith("-")]
    added = [line[1:] for line in body if line.startswith("+")]
    assert removed == [], "the batch removed or rewrote an allowlist line"
    assert added, "the batch added no line"
    assert all(HEX64.fullmatch(line) for line in added), (
        "the batch added a line that is not a 64-hex hash"
    )
    assert set(added) == {sha256_text(normalise(BRAMBLE)), sha256_text(normalise(TAMARIND))}

    created = world.prs_created()
    assert len(created) == 1, world.gh_calls()
    assert flag(created[0]["argv"], "--head", "-H") == branch, created[0]["argv"]


@pytest.mark.parametrize(
    "lines",
    [
        pytest.param(("not-a-location",), id="malformed"),
        pytest.param(("docs/plan.md:2",), id="no-branch"),
        pytest.param(("s99-a1:docs/plan.md:0",), id="line-zero"),
        pytest.param(("s99-a1:docs/plan.md:1",), id="a-line-with-no-hit"),
        pytest.param(("s99-a1:../../outside.txt:1",), id="a-path-out-of-the-tree"),
        pytest.param(("s99-zz:docs/plan.md:2",), id="no-such-branch"),
        pytest.param(("s99-a1:docs/plan.md:2", "s99-b1:src/notes.txt:1"), id="one-good-one-not"),
    ],
)
def test_a_batch_holding_any_line_that_is_not_a_hit_is_refused_and_nothing_is_pushed(
    world: World, lines: tuple[str, ...]
) -> None:
    real = REAL_ALLOWLIST.read_bytes()
    before = world.origin_refs()

    done = batch(world, *lines)

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode != 0, show(done)
    assert world.origin_refs() == before, "a refused batch pushed something"
    assert world.gh_writes() == [], world.gh_writes()
    assert REAL_ALLOWLIST.read_bytes() == real
