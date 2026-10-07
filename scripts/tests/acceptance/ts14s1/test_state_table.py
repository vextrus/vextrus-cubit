"""Ticket S14-S1, issue #449: `python -m scripts.factory.state` prints the open-work table from tools.

The authority:
- issue #449, "Fix": "`scripts/factory/state.py`: rebuilds the open-work table from tools, not memory.
  For each PR and branch it lists the head, the last ledger verdict, the `Factory-State` of the branch
  head, the real-drawing lock holder and the review slots."
- issue #449, "Acceptance check": "A fixture repo with one READY branch and no PR lists it as 'READY, no
  PR'. A fixture ledger with a verdict for an older head marks the newer head as unreviewed."
- factory-next.md 8 row 8: "`state.py`: open-work table from `gh`, `git`, ledger, rdlock, slots, `claude
  agents --json`".
- the orchestrator's brief for S14-S1: one row per ticket branch with its head sha, Factory-State read by
  the shared reader, PR number and state, last ledger round and verdict, live session (if any) and the
  next action; a PASS with green CI "reads ready to land"; a FIX verdict reads "fix round n"; a dead
  builder session with a non-READY head reads that it needs a resume, with the session id; the table
  comes only from tools, never from a hand-kept file.

Pinned at the command's boundary (its stdout and exit 0): a ticket branch is one line naming it, and
the words above in that line. "READY, no PR" is matched exactly; "ready to land", "fix round <n>",
"unreviewed", "resume" and the PR state "open" in any case. A head is matched by its first 7 hex
characters (a short or a full sha). `n` in "fix round n" is the round of the FIX verdict (the fix the
builder makes after review round n; session 13's commits are titled `r1` so).

Not pinned: the table's layout, its columns' order and headers, other words, the order of rows, whether
`main` or a `review/*` branch has a row, the review slots (their layout is S14-R1's, not yet merged), and
a cloud builder's session (`claude agents` lists local sessions only).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14s1._world import (
    World,
    blocked,
    plain,
    ready,
    ready_no_verify,
    row,
    rows,
)


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def has(line: str, words: str) -> bool:
    return words.lower() in line.lower()


def test_a_ready_branch_with_no_pr_is_listed_ready_no_pr(world: World) -> None:
    head = world.push("s99-alpha", ready)

    line = row(world.table(), "s99-alpha")

    assert head[:7] in line, line
    assert "READY, no PR" in line, line


def test_every_ticket_branch_is_one_row_with_its_own_head(world: World) -> None:
    world.push("s99-charlie", plain)  # an earlier head: the row shows the branch's newest
    heads = {
        "s99-alpha": world.push("s99-alpha", ready),
        "s99-bravo": world.push("s99-bravo", plain),
        "s99-charlie": world.push("s99-charlie", blocked),
    }

    table = world.table()

    for branch, head in heads.items():
        assert head[:7] in row(table, branch), table


def test_the_factory_state_is_the_shared_readers_reading_of_the_head(world: World) -> None:
    world.push("s99-alpha", ready)  # the T-W317 shape: READY, factory block before the attribution
    world.push("s99-bravo", ready_no_verify)
    world.push("s99-charlie", blocked)

    table = world.table()

    assert "READY, no PR" in row(table, "s99-alpha"), table
    malformed = row(table, "s99-bravo")
    assert "READY-NO-VERIFY" in malformed, malformed
    assert "READY, no PR" not in malformed, malformed
    stopped = row(table, "s99-charlie")
    assert "BLOCKED" in stopped, stopped
    assert "READY, no PR" not in stopped, stopped


def test_a_pr_passed_on_its_head_with_green_ci_reads_ready_to_land(world: World) -> None:
    head = world.push("s99-delta", ready)
    world.pr(4711, "s99-delta", head)
    world.verdict(4711, head, 1, "PASS")

    line = row(world.table(), "s99-delta")

    assert head[:7] in line, line
    assert re.search(r"(?<![\w])4711(?![\w])", line), line
    assert has(line, "open"), line
    assert "PASS" in line, line
    assert has(line, "ready to land"), line
    assert "READY, no PR" not in line, line


def test_a_passed_pr_whose_ci_is_red_is_not_ready_to_land(world: World) -> None:
    head = world.push("s99-delta", ready)
    world.pr(4711, "s99-delta", head, ci="FAILURE")
    world.verdict(4711, head, 1, "PASS")

    line = row(world.table(), "s99-delta")

    assert not has(line, "ready to land"), line


def test_a_fix_verdict_reads_fix_round_n(world: World) -> None:
    first = world.push("s99-echo", ready)
    world.pr(4712, "s99-echo", first)
    world.verdict(4712, first, 1, "FIX")
    older = world.push("s99-foxtrot", ready)
    world.verdict(4713, older, 1, "FIX")
    second = world.push("s99-foxtrot", ready)
    world.pr(4713, "s99-foxtrot", second)
    world.verdict(4713, second, 2, "FIX")

    table = world.table()

    one = row(table, "s99-echo")
    assert "FIX" in one, one
    assert has(one, "fix round 1"), one
    assert not has(one, "ready to land"), one
    two = row(table, "s99-foxtrot")
    assert has(two, "fix round 2"), two
    assert not has(two, "fix round 1"), two


def test_a_verdict_for_an_older_head_marks_the_newer_head_unreviewed(world: World) -> None:
    older = world.push("s99-golf", ready)
    world.verdict(4714, older, 1, "PASS")
    newer = world.push("s99-golf", ready)
    world.pr(4714, "s99-golf", newer)

    line = row(world.table(), "s99-golf")

    assert newer[:7] in line, line
    assert has(line, "unreviewed"), line
    assert not has(line, "ready to land"), line


def test_a_dead_local_builder_with_a_non_ready_head_needs_a_resume_with_its_session_id(
    world: World,
) -> None:
    name, session = world.launch_local("s99h", "s99-hotel")
    world.push("s99-hotel", plain)  # the launch tip on origin
    head = world.commit_local("s99-hotel", plain)  # its last commit, never pushed
    world.ended(name, session)

    line = row(world.table(), "s99-hotel")

    assert head[:7] in line, line
    assert has(line, "resume"), line
    assert session in line, line


def test_a_live_local_builder_is_shown_and_needs_no_resume(world: World) -> None:
    name, session = world.launch_local("s99i", "s99-india")
    world.push("s99-india", plain)
    world.commit_local("s99-india", plain)
    world.live(name, session)

    line = row(world.table(), "s99-india")

    assert session in line or name in line, line
    assert not has(line, "resume"), line


def test_a_dead_builder_whose_head_is_ready_needs_no_resume(world: World) -> None:
    name, session = world.launch_local("s99j", "s99-juliet")
    world.push("s99-juliet", plain)
    world.commit_local("s99-juliet", ready)
    world.ended(name, session)

    line = row(world.table(), "s99-juliet")

    assert "READY, no PR" in line, line
    assert not has(line, "resume"), line


def test_a_branch_whose_pr_is_merged_is_not_open_work(world: World) -> None:
    head = world.push("s99-kilo", ready)
    world.pr(4715, "s99-kilo", head, state="MERGED")
    world.verdict(4715, head, 1, "PASS")
    world.push("s99-alpha", ready)

    table = world.table()

    assert rows(table, "s99-kilo") == [], table
    assert "READY, no PR" in row(table, "s99-alpha"), table


def test_hand_kept_state_files_are_never_read(world: World) -> None:
    world.push("s99-alpha", plain)
    hand = (
        "# RESUME\n\n| branch | state |\n|---|---|\n"
        "| s99-ghost | READY, no PR |\n| s99-alpha | READY, no PR |\n"
    )
    for folder in (world.main, world.factory, world.factory.parent):
        (folder / "RESUME.md").write_text(hand)
        (folder / "STATE.md").write_text(hand)

    table = world.table()

    assert rows(table, "s99-ghost") == [], table
    assert "READY, no PR" not in row(table, "s99-alpha"), table


def test_the_real_drawing_lock_holder_is_listed(world: World) -> None:
    head = world.push("s99-lima", plain)
    world.lock("s99l", head)

    table = world.table()

    held = [line for line in table.splitlines() if has(line, "lock") and head[:7] in line]
    assert held, table


def test_an_unreadable_ledger_record_never_reads_ready_to_land(world: World) -> None:
    head = world.push("s99-mike", ready)
    world.pr(4716, "s99-mike", head)
    folder = world.factory / "ledger"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"4716-{head}.json").write_text('{"pr": 4716, "head": "' + head + '", "verdict": "PA')

    world.push("s99-alpha", ready)

    table = world.table()  # one bad record does not hide the rest of the open work

    assert not has(row(table, "s99-mike"), "ready to land"), table
    assert "READY, no PR" in row(table, "s99-alpha"), table


def test_a_pass_recorded_for_another_pr_does_not_land_this_one(world: World) -> None:
    head = world.push("s99-november", ready)
    world.pr(4717, "s99-november", head)
    world.verdict(4799, head, 1, "PASS")  # the same head, another PR's record

    line = row(world.table(), "s99-november")

    assert not has(line, "ready to land"), line
