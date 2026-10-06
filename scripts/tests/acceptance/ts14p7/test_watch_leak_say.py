"""Ticket S14-P7, issue #461 (part B, tooling): on LEAK-HIT the watcher tells the builder itself.

The authority:
- factory-next.md 8, row 14: "watcher auto-`say` on LEAK-HIT with `file:line`"; its acceptance check:
  "a fixture LEAK-HIT produces one `say` with no text".
- Issue #461, "Fix" B: "On `LEAK-HIT` ... `launch say --leak <ticket>` sends the builder the fixed-text
  request ("replace with an invented stand-in, push again"), so the generic case needs no judgement
  call."
- The orchestrator's brief: "a fixture LEAK-HIT event produces exactly one say/message to the
  builder's session carrying `file:line` and no matched text".

The watcher is driven black-box, as `scripts/tests/acceptance/ts14f1/_world.py` drives it (copied in
the parts needed): `python -m scripts.factory.watch run --once` in the main checkout of a temporary
origin, its existing seams (`VEXTRUS_FACTORY_DIR`, `VEXTRUS_NOW`, `VEXTRUS_PRS_FILE`,
`VEXTRUS_AGENTS_FILE`, `VEXTRUS_MEMINFO_FILE`, `VEXTRUS_DF_FILE`, `VEXTRUS_USAGE_FILE`,
`VEXTRUS_JEV_CMD`), and `VEXTRUS_LEAKSCAN_CMD` naming the real scanner over a fake corpus.

The seam assumed for "say": a cloud builder is messaged the one way the launcher messages a cloud
session (`launch say`, launch-cli.md 3): `claude -p "<text>" --cloud <session_id> --output-format
json`, here a fake `claude` first on PATH that logs its argv and replies `{"ok": true}`. A message is
one such call naming the builder's `session_id` from its launch record. Not pinned: the request's
words beyond the location (the authority quotes them only loosely), its `[elapsed]` prefix, and
whether the watcher also writes a `leak-hits/<ticket>.json` file.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14p7._world import (
    KB_PER_GB,
    NOW,
    USAGE,
    World,
    assert_no_text,
    flag,
    hit_file,
    show,
    stub,
)

TICKET = "s99-c1"
BRANCH = "s99-c1-branch"
SESSION = "session_01P7LeakBuilder"


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
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
    launches = made.factory / "launches"
    launches.mkdir(parents=True)
    stamp = NOW.replace("-", "").replace(":", "")
    (launches / f"{TICKET}-{stamp}.json").write_text(json.dumps(record))
    return made


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


def messages_to_builder(world: World) -> list[str]:
    """The text of each message sent to the builder's cloud session."""
    return [
        flag(argv, "-p") or ""
        for argv in world.claude_calls()
        if "--cloud" in argv and flag(argv, "--cloud") == SESSION
    ]


def test_a_leak_hit_on_a_cloud_head_sends_its_builder_one_message_with_file_and_line_and_no_text(
    world: World,
) -> None:
    world.commit(BRANCH, {"docs/intro.md": "a clean line\n"}, "feat: a clean start\n")
    world.to_origin(BRANCH)
    watch_once(world)
    assert messages_to_builder(world) == [], "a clean head was messaged"

    world.commit(BRANCH, {"docs/plan.md": hit_file(2)}, "feat: the plan\n")
    world.to_origin(BRANCH)
    watch_once(world)
    watch_once(world)  # the alarm holds: no second message

    events = (world.factory / "events.log").read_text()
    assert_no_text(events)
    assert len([line for line in events.splitlines() if " LEAK-HIT " in line]) == 1, events
    sent = messages_to_builder(world)
    assert len(sent) == 1, f"{len(sent)} messages to the builder's session, not one"
    assert "docs/plan.md:2" in sent[0], "the message does not name the hit's file:line"
    for argv in world.claude_calls():
        assert_no_text(*argv)
