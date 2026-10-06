"""PR #498 review round 1: a merge's own hit in a file whose name holds a corpus string is named as the
scanner names it (`name:<i>:<line>`), never by its path; and a merged line reading "+ ..." (shown as
`+++ ...` in a combined diff) is a line, not a file header.

Built on ticket S14-P7's acceptance world (`scripts/tests/acceptance/ts14p7/_world.py`, imported, never
changed): a temporary origin, an invented corpus, a fake `gh` and `claude`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from scripts.factory import leakwhere
from scripts.factory.tests.test_leak_round1 import BRANCH as CLOUD_BRANCH
from scripts.factory.tests.test_leak_round1 import SESSION, TICKET, sent, watch_once
from scripts.tests.acceptance.ts14p7._world import (
    BRAMBLE,
    NOW,
    World,
    assert_no_text,
    hit_file,
    ready_message,
    show,
    write_verify_record,
)

SCANNER = [sys.executable, "-m", "tools.leakscan"]
NAMED = f"docs/{BRAMBLE}.md"  # a file name holding an invented corpus string


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    return made


def merge_adding(world: World, branch: str, files: dict[str, str], ready: bool = False) -> str:
    """The branch commits a clean file, main moves on, and the branch merges main, its own resolution
    adding `files`. Returns the merge's sha."""
    world.commit(branch, {"docs/clean.md": "a clean line\n"}, "feat: clean\n")
    world.commit("main", {"docs/other.md": "another clean line\n"}, "feat: main moves\n")
    world.git(world.work, "push", "-q", "origin", "main")
    world.git(world.work, "checkout", "-q", branch)
    world.git(world.work, "fetch", "-q", "origin")
    world.git(world.work, "merge", "-q", "--no-ff", "--no-commit", "origin/main")
    for path, content in files.items():
        (world.work / path).parent.mkdir(parents=True, exist_ok=True)
        (world.work / path).write_text(content)
    world.git(world.work, "add", "--", *files)
    tree = world.git(world.work, "write-tree")
    message = world.tmp / "merge-message.txt"
    message.write_text(ready_message(tree, "S99-N1: merge main") if ready else "merge main\n")
    world.git(world.work, "commit", "-q", "-F", str(message))
    return world.git(world.work, "rev-parse", "HEAD")


def attributed(world: World, head: str) -> list[leakwhere.Hit] | None:
    base = world.git(world.work, "merge-base", "origin/main", head)
    return leakwhere.commit_hits(world.work, SCANNER, base, head, world.env())


def test_a_merges_hit_in_a_corpus_named_file_is_named_by_index_never_by_path(world: World) -> None:
    merge = merge_adding(world, "s99-n1", {NAMED: hit_file(2)})

    found = attributed(world, merge)

    assert found is not None
    assert_no_text(json.dumps(found))
    assert (merge, "name:0:2", 1) in found


def test_publish_never_prints_a_corpus_named_merge_file(world: World) -> None:
    merge = merge_adding(world, "s99-n1", {NAMED: hit_file(2)}, ready=True)
    world.to_main("s99-n1")
    # The READY head's green record, as `commit_ready` writes one: only the hit refuses it.
    write_verify_record(world, world.tree(merge))

    done = world.publish("s99-n1")

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode != 0, show(done)
    assert f"{merge[:12]} name:0:2" in done.stderr, show(done)


def test_the_watcher_never_keeps_or_says_a_corpus_named_merge_file(world: World) -> None:
    record = {
        "ticket": TICKET,
        "branch": CLOUD_BRANCH,
        "where": "cloud",
        "role": "builder",
        "budget_minutes": 60,
        "session_id": SESSION,
        "started_at": NOW,
        "judge": {"ok": True, "code": "ok", "reason": "cloned"},
        "stop_sent": False,
    }
    launches = world.factory / "launches"
    launches.mkdir(parents=True)
    (launches / f"{TICKET}-20261006T100000Z.json").write_text(json.dumps(record))
    merge = merge_adding(world, CLOUD_BRANCH, {NAMED: hit_file(2)})
    world.git(world.work, "push", "-q", "origin", CLOUD_BRANCH)
    world.git(world.main, "fetch", "-q", "origin")

    watch_once(world)

    kept = [p.read_text() for p in world.factory.rglob("*") if p.is_file()]
    assert_no_text(*kept)
    for argv in world.claude_calls():
        assert_no_text(*argv)
    [message] = sent(world)
    assert f"name:0:2 (commit {merge[:12]})" in message


def test_a_merged_line_reading_plus_space_is_a_line_not_a_file_header(world: World) -> None:
    merge = merge_adding(
        world, "s99-n2", {"docs/list.md": f"a clean line\n+ bullet the yard is {BRAMBLE} today\n"}
    )

    found = attributed(world, merge)

    assert found is not None
    assert_no_text(json.dumps(found))
    assert [(sha, where) for sha, where, _ in found if sha == merge] == [(merge, "docs/list.md:2")]
