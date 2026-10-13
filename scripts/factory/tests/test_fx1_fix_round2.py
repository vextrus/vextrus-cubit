"""S26-FX1 fix round 2 (PR #786): publish reads READY only under CLEAN merges of main and checks the tree
it pushes; a status reply on a BLOCKED head keeps BLOCKED and its reason; the watcher, ci_gate and
publish walk back to the same depth."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from scripts.factory import ci_gate, publish, watch
from scripts.factory.tests.test_fx1_fix_round import (
    Builder,
    fresh_state,
    git,
    readies,
    track_once,
)


@pytest.fixture
def builder(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Builder:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(watch, "leak_scan", lambda head, main: {"result": "clean"})
    return Builder(tmp_path)


def main_commit(b: Builder, name: str = "m.txt", text: str = "main\n") -> str:
    """A new commit on main; returns main's tip, leaving the builder's branch checked out."""
    git(b.path, "checkout", "-q", "main")
    (b.path / name).write_text(text)
    git(b.path, "add", name)
    git(b.path, "commit", "-q", "-m", f"main: {name}")
    tip = git(b.path, "rev-parse", "HEAD")
    git(b.path, "checkout", "-q", "s99-x1")
    return tip


def clean_merge(b: Builder) -> str:
    main_commit(b)
    git(b.path, "merge", "-q", "--no-ff", "-m", "Merge main", "main")
    return b.head()


def merge_with_an_extra_file(b: Builder) -> str:
    main_commit(b)
    git(b.path, "merge", "-q", "--no-ff", "--no-commit", "main")
    (b.path / "smuggled.txt").write_text("not in either parent\n")
    git(b.path, "add", "smuggled.txt")
    git(b.path, "commit", "-q", "-m", "Merge main")
    return b.head()


def git_try(b: Builder, *args: str) -> int:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_AUTHOR_NAME="t",
        GIT_AUTHOR_EMAIL="t@example.invalid",
        GIT_COMMITTER_NAME="t",
        GIT_COMMITTER_EMAIL="t@example.invalid",
    )
    return subprocess.run(
        ["git", "-C", str(b.path), *args], capture_output=True, text=True, env=env, check=False
    ).returncode


def record(b: Builder, tree: str, exit_code: int = 0) -> None:
    folder = b.path / ".git" / "vextrus"
    folder.mkdir(exist_ok=True)
    (folder / f"verify-{tree}.json").write_text(
        json.dumps(
            {"schema_version": 1, "tree": tree, "checks": [{"name": "x", "exit_code": exit_code}]}
        )
    )


# --- publish: only a clean merge of main keeps READY (60)


def test_publish_takes_a_clean_merge_of_main_after_ready(builder: Builder) -> None:
    ready = builder.ready()
    head = clean_merge(builder)
    assert publish.ready_source(builder.path, head) == ready


def test_publish_refuses_a_file_added_inside_a_merge_after_ready(builder: Builder) -> None:
    builder.ready()
    head = merge_with_an_extra_file(builder)
    with pytest.raises(publish.Refused, match="not a clean merge of main"):
        publish.ready_source(builder.path, head)
    assert ci_gate.ready_commit(head, builder.path) is not None  # CI's gate stays lenient


def test_publish_refuses_a_hand_resolved_conflict_after_ready(builder: Builder) -> None:
    (builder.path / "c.txt").write_text("builder\n")
    git(builder.path, "add", "c.txt")
    git(builder.path, "commit", "-q", "-m", "wip: c")
    builder.ready()
    git(builder.path, "checkout", "-q", "main")
    (builder.path / "c.txt").write_text("main\n")
    git(builder.path, "add", "c.txt")
    git(builder.path, "commit", "-q", "-m", "main: c")
    git(builder.path, "checkout", "-q", "s99-x1")
    assert git_try(builder, "merge", "--no-ff", "-m", "Merge main", "main") != 0
    (builder.path / "c.txt").write_text("a hand-made line\n")
    git(builder.path, "add", "c.txt")
    git(builder.path, "commit", "-q", "-m", "Merge main")
    with pytest.raises(publish.Refused, match="not a clean merge of main"):
        publish.ready_source(builder.path, builder.head())


def test_a_clean_merge_after_ready_needs_a_verify_record_for_the_tree_pushed(
    builder: Builder, monkeypatch: pytest.MonkeyPatch
) -> None:
    ready = builder.ready()
    record(builder, git(builder.path, "rev-parse", f"{ready}^{{tree}}"))
    head = clean_merge(builder)
    assert git(builder.path, "rev-parse", f"{head}^{{tree}}") != git(
        builder.path, "rev-parse", f"{ready}^{{tree}}"
    )
    with pytest.raises(publish.Refused, match="no readable verify record"):
        publish.push(builder.path, "s99-x1", head, ready)

    record(builder, git(builder.path, "rev-parse", f"{head}^{{tree}}"), exit_code=1)
    with pytest.raises(publish.Refused, match="did not pass"):
        publish.push(builder.path, "s99-x1", head, ready)

    record(builder, git(builder.path, "rev-parse", f"{head}^{{tree}}"))
    with pytest.raises(publish.Refused, match="git push failed"):  # past the gate; no origin here
        publish.push(builder.path, "s99-x1", head, ready)


def test_a_status_reply_needs_no_second_verify_record(builder: Builder) -> None:
    ready = builder.ready()
    record(builder, git(builder.path, "rev-parse", f"{ready}^{{tree}}"))
    head = builder.reply()
    with pytest.raises(publish.Refused, match="git push failed"):  # the gate passed on READY's record
        publish.push(builder.path, "s99-x1", head, ready)


# --- BLOCKED under a status reply (50)


BLOCKED = "S99-X1: stuck\n\nFactory-State: BLOCKED\nFactory-Reason: waiting on a ruling\n"


def blocked(b: Builder) -> str:
    git(b.path, "commit", "-q", "--allow-empty", "-m", BLOCKED)
    return b.head()


def blocked_events(step: watch.Pass) -> list[tuple[str, str | None, str]]:
    return [e for e in step.events if e[0] == "BLOCKED"]


def test_a_status_reply_on_a_blocked_head_keeps_blocked_and_its_reason(builder: Builder) -> None:
    first = blocked(builder)
    state = fresh_state()
    step, item = track_once(state, first, builder.main)
    assert item["state"] == "blocked"
    assert len(blocked_events(step)) == 1

    reply = builder.reply("answering")
    step, item = track_once(state, reply, builder.main)
    assert item["state"] == "blocked"
    assert state["tickets"]["tu"]["outcome"] == "BLOCKED"
    assert state["tickets"]["tu"]["reason"] == "waiting on a ruling"
    assert blocked_events(step) == []  # not a second BLOCKED
    assert not [a for a in step.alarms.values() if a[0] == "BUILDER-QUIET"]


def test_a_blocked_commit_and_its_reply_in_one_pass_are_one_blocked_event(builder: Builder) -> None:
    first = blocked(builder)
    reply = builder.reply()
    step, item = track_once(fresh_state(), reply, builder.main)
    assert item["state"] == "blocked"
    assert [e[2] for e in blocked_events(step)] == [f"{first[:8]} waiting on a ruling"]


def test_inherits_outcome_reads_blocked_and_ready_under_replies(builder: Builder) -> None:
    blocked(builder)
    reply = builder.reply()
    assert watch.inherits_outcome(reply, builder.main) == "BLOCKED"
    git(builder.path, "checkout", "-q", "-b", "other", "main")
    builder.ready()
    assert watch.inherits_outcome(builder.reply(), builder.main) == "READY"


# --- one walk-back depth (45)


def test_the_watcher_ci_gate_and_publish_read_one_ready_under_the_same_deep_chain(
    builder: Builder,
) -> None:
    ready = builder.ready()
    for n in range(25):
        head = builder.reply(f"reply {n}")
    assert ci_gate.ready_commit(head, builder.path) == ready
    assert publish.ready_source(builder.path, head) == ready
    step, item = track_once(fresh_state(), head, builder.main)
    assert item["state"] == "ready"
    assert readies(step) == [("READY", "tu", ready[:8])]


def test_a_deep_chain_of_clean_merges_and_replies_is_ready_for_all_three(builder: Builder) -> None:
    ready = builder.ready()
    for n in range(12):
        builder.reply(f"reply {n}")
        head = clean_merge_numbered(builder, n)
    main = git(builder.path, "rev-parse", "main")
    assert ci_gate.ready_commit(head, builder.path, clean_merges=True) == ready
    assert publish.ready_source(builder.path, head) == ready
    assert watch.settled_under(head, main) is not None
    step, item = track_once(fresh_state(), head, main)
    assert item["state"] == "ready"
    assert readies(step) == [("READY", "tu", ready[:8])]


def clean_merge_numbered(b: Builder, n: int) -> str:
    main_commit(b, f"m{n}.txt", f"main {n}\n")
    git(b.path, "merge", "-q", "--no-ff", "-m", "Merge main", "main")
    return b.head()


def test_the_watchers_walk_has_no_depth_constant() -> None:
    assert not hasattr(watch, "MERGE_DEPTH")
