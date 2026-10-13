"""Ticket S26-FX6, issue #759: `python -m scripts.factory.publish <branch>` runs merge_ready's Cut check
on the PR body it builds and refuses, before pushing and before opening the PR, when that check would
fail, naming why. A body that passes is published as today.

The authority:
- Session 26's brief, "The factory fixes", FX6: "`scripts.factory.publish` runs merge_ready's Cut check
  on the body it builds and refuses before opening the PR (#759)".
- Issue #759: merge_ready's Cut check (`scripts/merge_ready.py` `cut_problems`) refused #755 and #757
  twice each at land time (a wrapped item's second line, notes after "Nothing cut."; S26-FX8 later
  ruled "Nothing cut." an empty Cut, so notes after it are published); "Owed check:
  scripts.factory.publish runs the same cut_problems on the body it builds and refuses before opening
  the PR".
- The orchestrator's ticket: refused means nothing pushed and no `gh pr create`; the check is the same
  as merge_ready's, so a body merge_ready accepts is accepted.

Pinned at the boundary: the exit code, what origin holds after, the `gh` calls a fake `gh` saw, and that
the refusal carries merge_ready's own words for the problem (`cut_problems`' strings). The issue's state
is read as merge_ready reads it (`gh issue view <n> --repo vextrus/vextrus-cubit --json state,url`,
answered by the fake from a file). Not pinned: publish's own words around the problem, whether the
check runs before or after the range scan, or the footer (no refusal here depends on it; the accepted
body puts a heading after its Cut item).

The world (a temporary origin, the main checkout, a builder's clone, a fake leak corpus, a fake `gh`)
is S14-P7's (`scripts/tests/acceptance/ts14p7/_world.py`), with `gh issue view` answered too.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.merge_ready import cut_problems
from scripts.tests.acceptance.ts14p7._world import (
    ATTRIBUTION,
    GH,
    World,
    show,
    stub,
    write_verify_record,
)

BRANCH = "s99-x6"
REFUSED = "scripts.factory.publish did not refuse a body merge_ready's Cut check refuses"

# Answers `gh issue view <n> ... --json state,url` from `issues.json` beside the fake's log: a number
# maps to OPEN, CLOSED or PR (a pull request: OPEN, with a pull URL, as GitHub answers); a number not
# there is not found (exit 1). Every other call falls through to S14-P7's fake.
ISSUE_VIEW = r"""
_args = sys.argv[1:]
if _args[:2] == ["issue", "view"]:
    _folder = os.environ["GH_STUB_DIR"]
    with open(os.path.join(_folder, "gh.log"), "a") as _handle:
        _handle.write(json.dumps({"argv": _args, "body": None, "body_sha256": None}) + "\n")
    _picked = []
    _skip = False
    for _a in _args[2:]:
        if _skip:
            _skip = False
            continue
        if _a in ("--repo", "-R", "--json", "-q", "--jq", "-t", "--template"):
            _skip = True
            continue
        if not _a.startswith("-"):
            _picked.append(_a)
    try:
        with open(os.path.join(_folder, "issues.json")) as _handle:
            _issues = json.load(_handle)
    except FileNotFoundError:
        _issues = {}
    _kind = _issues.get(_picked[0].lstrip("#")) if _picked else None
    if _kind is None:
        sys.stderr.write("GraphQL: Could not resolve to an issue or pull request\n")
        sys.exit(1)
    _where = "pull" if _kind == "PR" else "issues"
    _number = _picked[0].lstrip("#")
    sys.stdout.write(
        json.dumps(
            {
                "state": "OPEN" if _kind == "PR" else _kind,
                "url": "https://github.com/vextrus/vextrus-cubit/" + _where + "/" + _number,
            }
        )
        + "\n"
    )
    sys.exit(0)
"""


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    stub(made.stubs / "gh", ISSUE_VIEW + GH)
    made.leak.build()
    return made


def set_issues(world: World, issues: dict[int, str]) -> None:
    (world.gh_dir / "issues.json").write_text(json.dumps({str(n): s for n, s in issues.items()}))


def message(tree: str, sections: str) -> str:
    """A READY commit message (trailers.md 1) whose body holds `sections`. Synthetic words only."""
    return (
        "S99-X6: the widget's export step\n"
        "\n"
        "Closes #999. The widget exports in one step.\n"
        "\n"
        f"{sections.strip()}\n"
        "\n"
        f"Factory-State: READY\nFactory-Verify: {tree} ok\n"
        "\n"
        f"{ATTRIBUTION}"
    )


def commit_ready_with(world: World, sections: str) -> str:
    """A READY tip on BRANCH whose message holds `sections`, with its tree's green verify record."""
    world.commit(BRANCH, {"docs/plan.md": "a clean line\n"}, "wip: the widget\n")
    tree = world.git(world.work, "rev-parse", "HEAD^{tree}")
    text = world.tmp / "ready.txt"
    text.write_text(message(tree, sections))
    world.git(world.work, "commit", "-q", "--amend", "-F", str(text))
    write_verify_record(world, tree)
    return world.git(world.work, "rev-parse", "HEAD")


def assert_refused(world: World, done_out: tuple[int, str], why: str, before: dict[str, str]) -> None:
    code, output = done_out
    assert code != 0, f"{REFUSED}: exit {code}\n{output}"
    assert why in output, f"the refusal does not name merge_ready's problem {why!r}:\n{output}"
    assert world.origin_refs() == before, "a body the Cut check refuses was pushed"
    assert world.prs_created() == [], world.prs_created()
    assert world.gh_writes() == [], world.gh_writes()


@pytest.mark.parametrize(
    ("heading", "section"),
    [("## Cut", "cut"), ("## Not done", "not done"), ("## Deferred", "deferred")],
)
def test_a_cut_item_linking_no_issue_is_refused_and_nothing_is_pushed_or_opened(
    world: World, heading: str, section: str
) -> None:
    set_issues(world, {})
    commit_ready_with(world, f"{heading}\n- the tier 2 export\n\n## Notes\nA synthetic note.\n")
    world.to_main(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert_refused(
        world,
        (done.returncode, done.stdout + done.stderr),
        f"'{section}' item 1 links no issue",
        before,
    )
    assert f"refs/heads/{BRANCH}" not in world.origin_refs()


def test_a_cloud_builders_branch_already_on_origin_is_refused_before_the_pr_is_opened(
    world: World,
) -> None:
    set_issues(world, {})
    commit_ready_with(world, "## Cut\n- the tier 2 export\n")
    world.to_origin(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert_refused(
        world, (done.returncode, done.stdout + done.stderr), "'cut' item 1 links no issue", before
    )


def test_notes_after_nothing_cut_are_published_as_merge_ready_accepts_them(world: World) -> None:
    # Amended by S26-FX8 (the orchestrator's ruling, 13 Oct 2026): "Nothing cut." is an empty Cut and,
    # as after "None.", prose after it is not a Cut item. This test pinned the defect before.
    set_issues(world, {})
    head = commit_ready_with(
        world, "## Cut\nNothing cut.\nThe tier 2 export waits for the owner.\n\n## Notes\nA note.\n"
    )
    world.to_main(BRANCH)

    done = world.publish(BRANCH)

    assert done.returncode == 0, f"publish refused notes after an empty Cut: {show(done)}"
    assert world.origin_refs().get(f"refs/heads/{BRANCH}") == head, show(done)
    assert len(world.prs_created()) == 1, world.gh_calls()


def test_a_wrapped_cut_items_second_line_is_refused_as_merge_ready_refuses_it(world: World) -> None:
    set_issues(world, {12: "OPEN"})
    commit_ready_with(
        world,
        "## Cut\n- the tier 2 export, filed as #12,\n  waits for the owner's walk\n"
        "\n## Notes\nA note.\n",
    )
    world.to_main(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert_refused(
        world, (done.returncode, done.stdout + done.stderr), "'cut' item 2 links no issue", before
    )


@pytest.mark.parametrize("state", ["CLOSED", "PR"])
def test_a_cut_item_linking_a_closed_issue_or_a_pull_request_is_refused(
    world: World, state: str
) -> None:
    set_issues(world, {12: state})
    commit_ready_with(world, "## Cut\n- the tier 2 export (#12)\n\n## Notes\nA note.\n")
    world.to_main(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert_refused(
        world, (done.returncode, done.stdout + done.stderr), "'cut' item 1 links no open issue", before
    )


def test_a_cut_item_whose_issue_state_cannot_be_read_is_refused(world: World) -> None:
    set_issues(world, {})  # #12 is not found: gh issue view exits 1
    commit_ready_with(world, "## Cut\n- the tier 2 export (#12)\n\n## Notes\nA note.\n")
    world.to_main(BRANCH)
    before = world.origin_refs()

    done = world.publish(BRANCH)

    assert_refused(
        world,
        (done.returncode, done.stdout + done.stderr),
        "'cut' item 1: its issue's state cannot be read",
        before,
    )


def test_a_cut_of_none_is_published_as_today(world: World) -> None:
    set_issues(world, {})
    head = commit_ready_with(world, "## Cut\nNone.\n")
    world.to_main(BRANCH)

    done = world.publish(BRANCH)

    assert done.returncode == 0, show(done)
    assert world.origin_refs().get(f"refs/heads/{BRANCH}") == head, show(done)
    assert len(world.prs_created()) == 1, world.gh_calls()


def test_a_cut_item_linking_an_open_issue_is_published_and_merge_ready_accepts_its_body(
    world: World,
) -> None:
    issues = {12: "OPEN"}
    set_issues(world, issues)
    head = commit_ready_with(world, "## Cut\n- the tier 2 export (#12)\n\n## Notes\nA note.\n")
    world.to_main(BRANCH)

    done = world.publish(BRANCH)

    assert done.returncode == 0, show(done)
    assert world.origin_refs().get(f"refs/heads/{BRANCH}") == head, show(done)
    created = world.prs_created()
    assert len(created) == 1, world.gh_calls()
    body = created[0]["body"]
    assert isinstance(body, str), "the --body-file could not be read when gh ran"
    assert "- the tier 2 export (#12)" in body
    assert cut_problems(body, lambda n: issues.get(n) == "OPEN") == []
