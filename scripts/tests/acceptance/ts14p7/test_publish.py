"""Ticket S14-P7, issue #457: `python -m scripts.factory.publish <branch>` scans, stamps, pushes and
opens a PR in one call.

The authority:
- factory-next.md 8, row 14: "`publish.py` (scan, stamp, push, open PR)"; its acceptance check: "a head
  with a hit is refused; a clean head pushes and opens a PR with a scanned body".
- Issue #457, "Fix": publish "range-scans from the main checkout ..., stamps, pushes that exact head,
  scans the body, and opens or updates the PR"; "Acceptance check": "`publish` pushes only a
  range-scanned, stamped head and opens a PR with a scanned body; a head with a hit is refused and
  nothing is pushed."
- The orchestrator's brief (session 14): the range is `<merge-base>..<head>` with `--ref <branch>`;
  the body is "the READY commit's message (minus trailers) plus a footer", scanned with `tools.leakscan
  file`, then `gh pr create --body-file`; a refusal names "file:line of the hit, never the hit's text";
  "re-running on a branch with an open PR updates nothing and says so".
- PR #498's round 2 review (confirmed at 50): publish pushes a local builder's READY head from Python,
  out of the guard's sight; the guard's main-checkout push gate (READY_UNVERIFIED) also needs a green
  verify record for the head's tree at `<git-common-dir>/vextrus/verify-<tree>.json`
  (verify-record.schema.json), so publish refuses a READY head with no green record for its tree, as
  the guard does, naming the missing record.

Pinned at the boundary: the exit code, what origin holds after, the scanner's own stamps (read with
`tools.leakscan verify-stamp`: publish never writes one itself), and the `gh` calls a fake `gh` saw.
Not pinned: the words of publish's lines (the authority gives none, beyond the hit's location and the
PR's number), the footer, the title, where the body file is written, or whether publish fetches first.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14p7._world import (
    BRAMBLE,
    World,
    assert_no_text,
    commit_ready,
    flag,
    hit_file,
    show,
    write_verify_record,
)

BRANCH = "s99-x1"


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    return made


def test_a_head_with_a_hit_is_refused_naming_its_file_and_line_and_nothing_is_pushed(
    world: World,
) -> None:
    head = commit_ready(world, BRANCH, {"docs/plan.md": hit_file(3)})
    world.to_main(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode != 0, show(done)
    assert "docs/plan.md:3" in done.stdout + done.stderr, show(done)
    assert world.origin_refs() == before, "a refused head pushed something"
    assert f"refs/heads/{BRANCH}" not in world.origin_refs()
    assert world.gh_writes() == [], world.gh_writes()
    assert not world.leak.stamp_valid(world.main, head)


def test_a_hit_in_an_earlier_commit_of_the_range_is_refused_though_the_tip_removed_it(
    world: World,
) -> None:
    world.commit(BRANCH, {"docs/plan.md": hit_file(2)}, "wip: a first draft\n")
    commit_ready(world, BRANCH, {"docs/plan.md": hit_file(2).replace(BRAMBLE, "an invented stand-in")})
    world.to_main(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode != 0, show(done)
    assert "docs/plan.md:2" in done.stdout + done.stderr, show(done)
    assert world.origin_refs() == before, "a range with a hit pushed something"
    assert world.gh_writes() == [], world.gh_writes()


def test_with_no_corpus_to_scan_against_publish_refuses_and_pushes_nothing(world: World) -> None:
    commit_ready(world, BRANCH, {"docs/plan.md": "a clean line\n"})
    world.to_main(BRANCH)
    (world.leak.home / "corpus").unlink()
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert done.returncode != 0, show(done)
    assert world.origin_refs() == before, "an unscanned head was pushed"
    assert world.gh_writes() == [], world.gh_writes()


def test_a_clean_head_is_range_scanned_stamped_and_pushed_exactly(world: World) -> None:
    head = commit_ready(world, BRANCH, {"docs/plan.md": "a clean line\n"})
    world.to_main(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert done.returncode == 0, show(done)
    after = world.origin_refs()
    assert after.get(f"refs/heads/{BRANCH}") == head, show(done)
    assert {k: v for k, v in after.items() if k != f"refs/heads/{BRANCH}"} == before, (
        "publish pushed more than the branch's head"
    )
    assert world.leak.stamp_valid(world.main, head), "the pushed head has no valid range stamp"


def test_a_clean_head_opens_one_pr_whose_body_is_the_ready_message_minus_trailers_and_scanned(
    world: World,
) -> None:
    commit_ready(world, BRANCH, {"docs/plan.md": "a clean line\n"})
    world.to_main(BRANCH)

    done = world.publish(BRANCH)

    assert done.returncode == 0, show(done)
    created = world.prs_created()
    assert len(created) == 1, world.gh_calls()
    argv = created[0]["argv"]
    assert flag(argv, "--head", "-H") == BRANCH, argv
    assert flag(argv, "--body-file", "-F") is not None, f"the PR is not opened with --body-file: {argv}"
    body = created[0]["body"]
    assert isinstance(body, str), "the --body-file could not be read when gh ran"
    assert "widget-body-marker-5e1" in body, "the body is not built from the READY commit's message"
    assert "Closes #999." in body
    lines = [line.strip() for line in body.splitlines()]
    assert not any(line.lower().startswith("factory-") for line in lines), (
        "the body carries the factory trailers"
    )
    assert world.leak.stamp_valid(world.main, created[0]["body_sha256"]), (
        "the body gh was given was not scanned (no valid stamp for its sha256)"
    )


def test_a_rerun_on_a_branch_with_an_open_pr_updates_nothing_and_says_so(world: World) -> None:
    commit_ready(world, BRANCH, {"docs/plan.md": "a clean line\n"})
    world.to_main(BRANCH)
    first = world.publish(BRANCH)
    assert first.returncode == 0, show(first)
    created = world.prs_created()
    assert len(created) == 1, world.gh_calls()
    writes, refs = len(world.gh_writes()), world.origin_refs()

    again = world.publish(BRANCH)

    assert len(world.gh_writes()) == writes, world.gh_writes()[writes:]
    assert world.origin_refs() == refs
    assert "501" in again.stdout + again.stderr, (
        f"the rerun does not name the open PR (#501):\n{show(again)}"
    )


def test_a_ready_head_whose_tree_has_no_verify_record_is_refused_naming_it_and_nothing_is_pushed(
    world: World,
) -> None:
    head = commit_ready(world, BRANCH, {"docs/plan.md": "a clean line\n"}, verified=False)
    world.to_main(BRANCH)
    tree = world.tree(head)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert done.returncode != 0, show(done)
    assert tree in done.stdout + done.stderr, (
        f"the refusal does not name the missing verify record (tree {tree}):\n{show(done)}"
    )
    assert world.origin_refs() == before, "a READY head with no verify record was pushed"
    assert f"refs/heads/{BRANCH}" not in world.origin_refs()
    assert world.gh_writes() == [], world.gh_writes()


def test_a_ready_head_whose_verify_record_is_not_green_is_refused_and_nothing_is_pushed(
    world: World,
) -> None:
    head = commit_ready(world, BRANCH, {"docs/plan.md": "a clean line\n"}, verified=False)
    world.to_main(BRANCH)
    write_verify_record(world, world.tree(head), exit_code=1)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert done.returncode != 0, show(done)
    assert world.origin_refs() == before, "a READY head whose verify record failed was pushed"
    assert f"refs/heads/{BRANCH}" not in world.origin_refs()
    assert world.gh_writes() == [], world.gh_writes()
