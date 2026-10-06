"""PR #483 review round 1: a hit is read in the commit that added it, the watcher's message names that
commit with the pushed-hit remedy, once per set of hits, and goes through `launch say`.

Built on ticket S14-P7's acceptance world (`scripts/tests/acceptance/ts14p7/_world.py`, imported, never
changed): a temporary origin, an invented corpus, a fake `gh` and `claude`.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14p7._world import (
    BRAMBLE,
    KB_PER_GB,
    NOW,
    USAGE,
    World,
    assert_no_text,
    commit_ready,
    flag,
    hit_file,
    normalise,
    sha256_text,
    show,
    stub,
)

ALLOWLIST = "tools/leakscan/allowlist.txt"
TICKET = "s99-r1"
BRANCH = "s99-r1-branch"
SESSION = "session_01R1LeakBuilder"


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    return made


def shifted(world: World, branch: str) -> str:
    """A hit on line 2 in one commit, then line 1 deleted in a READY tip: the tip holds it on line 1,
    the range scan names it `docs/plan.md:2` in the first commit. Returns the first commit's sha."""
    first = world.commit(branch, {"docs/plan.md": hit_file(2)}, "feat: the plan\n")
    rows = hit_file(2).splitlines(keepends=True)[1:]
    commit_ready(world, branch, {"docs/plan.md": "".join(rows)})
    return first


def batch(world: World, *lines: str) -> subprocess.CompletedProcess[str]:
    hits = world.tmp / "hits.txt"
    hits.write_text("".join(f"{line}\n" for line in lines))
    return world.run("scripts.factory.allowlist", "batch", "--from", str(hits))


def added_hashes(world: World) -> set[str]:
    new = [r for r in world.origin_refs() if r.startswith("refs/heads/allowlist-")]
    assert len(new) == 1, world.origin_refs()
    world.git(world.main, "fetch", "-q", "origin")
    diff = world.git(world.main, "diff", "--unified=0", "origin/main", new[0], "--", ALLOWLIST)
    return {
        line[1:] for line in diff.splitlines() if line.startswith("+") and not line.startswith("+++")
    }


def test_publish_names_the_commit_of_each_hit(world: World) -> None:
    first = shifted(world, "s99-p1")
    world.to_main("s99-p1")

    done = world.publish("s99-p1")

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode != 0, show(done)
    assert f"docs/plan.md:2 {first[:12]}" in done.stderr, show(done)


def test_a_hit_whose_line_a_later_commit_moved_is_read_in_its_own_commit(world: World) -> None:
    shifted(world, "s99-a1")
    world.to_origin("s99-a1")

    done = batch(world, "s99-a1:docs/plan.md:2")

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode == 0, show(done)
    assert added_hashes(world) == {sha256_text(normalise(BRAMBLE))}


def test_the_commit_publish_names_can_be_given_on_the_hits_line(world: World) -> None:
    first = shifted(world, "s99-a1")
    world.to_origin("s99-a1")

    done = batch(world, f"s99-a1:docs/plan.md:2 {first[:12]}")

    assert done.returncode == 0, show(done)
    assert added_hashes(world) == {sha256_text(normalise(BRAMBLE))}


def test_a_commit_outside_the_branch_is_refused(world: World) -> None:
    shifted(world, "s99-a1")
    world.to_origin("s99-a1")
    before = world.origin_refs()
    main = before["refs/heads/main"]

    done = batch(world, f"s99-a1:docs/plan.md:2 {main[:12]}")

    assert done.returncode != 0, show(done)
    assert world.origin_refs() == before


# --- the watcher
@pytest.fixture
def cloud(world: World) -> World:
    record = {
        "ticket": TICKET,
        "branch": BRANCH,
        "where": "cloud",
        "role": "builder",
        "effort": "medium",
        "model": "claude-opus-5-5",
        "budget_minutes": 60,
        "session_id": SESSION,
        "cli_version": "2.1.999",
        "started_at": NOW,
        "governor": {"unit": "cloud-session", "ok": True},
        "leak_scan": {"status": "clean", "line": "leakscan: hits=0 scanned=1 corpus=0123456789ab"},
        "judge": {"ok": True, "code": "ok", "reason": "cloned"},
        "stop_sent": False,
        "untestable": None,
        "review": None,
    }
    launches = world.factory / "launches"
    launches.mkdir(parents=True)
    (launches / f"{TICKET}-20261006T100000Z.json").write_text(json.dumps(record))
    return world


def watch_once(world: World) -> None:
    seams = world.tmp / "seams"
    seams.mkdir(exist_ok=True)
    (seams / "meminfo").write_text(
        f"MemTotal: {27 * KB_PER_GB} kB\nMemFree: {KB_PER_GB} kB\n"
        f"MemAvailable: {16 * KB_PER_GB} kB\nSwapTotal: {8 * KB_PER_GB} kB\n"
        f"SwapFree: {8 * KB_PER_GB} kB\n"
    )
    (seams / "df").write_text(f"    Avail\n{60 * KB_PER_GB}\n")
    (seams / "usage").write_text(USAGE)
    (seams / "agents").write_text("[]")
    (seams / "prs").write_text("[]")
    jev = stub(world.tmp / "jev-ok", "print('jev-model ok jev-1.13.0')\n")
    env = world.env()
    env.update(
        VEXTRUS_MEMINFO_FILE=str(seams / "meminfo"),
        VEXTRUS_DF_FILE=str(seams / "df"),
        VEXTRUS_USAGE_FILE=str(seams / "usage"),
        VEXTRUS_AGENTS_FILE=str(seams / "agents"),
        VEXTRUS_PRS_FILE=str(seams / "prs"),
        VEXTRUS_JEV_CMD=str(jev),
    )
    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.watch", "run", "--once"],
        cwd=world.main,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=600,
        check=False,
    )
    assert_no_text(done.stdout, done.stderr)
    assert done.returncode == 0, show(done)


def sent(world: World) -> list[str]:
    return [
        flag(argv, "-p") or ""
        for argv in world.claude_calls()
        if "--cloud" in argv and flag(argv, "--cloud") == SESSION
    ]


def test_the_leak_message_names_the_commit_with_the_pushed_remedy_through_launch_say(
    cloud: World,
) -> None:
    hit = cloud.commit(BRANCH, {"docs/plan.md": hit_file(2)}, "feat: the plan\n")
    cloud.to_origin(BRANCH)

    watch_once(cloud)

    [message] = sent(cloud)
    assert_no_text(message)
    assert message.startswith("[elapsed 0/60 min] "), "not sent through launch say's elapsed prefix"
    assert "docs/plan.md:2" in message
    assert f"commit {hit[:12]} (already pushed)" in message
    assert "start a fresh branch from main" in message
    assert "new commit, and push again" not in message


def test_a_later_push_with_the_same_hits_sends_nothing_and_a_new_hit_sends_one_more(
    cloud: World,
) -> None:
    cloud.commit(BRANCH, {"docs/plan.md": hit_file(2)}, "feat: the plan\n")
    cloud.to_origin(BRANCH)
    watch_once(cloud)
    cloud.commit(BRANCH, {"docs/plan.md": "an invented stand-in\n"}, "fix: the plan\n")
    cloud.to_origin(BRANCH)
    watch_once(cloud)
    watch_once(cloud)
    assert len(sent(cloud)) == 1, "a push that keeps the same hits sent another message"

    cloud.commit(BRANCH, {"docs/other.md": hit_file(3)}, "feat: another\n")
    cloud.to_origin(BRANCH)
    watch_once(cloud)

    assert len(sent(cloud)) == 2
    assert "docs/other.md:3" in sent(cloud)[1]
