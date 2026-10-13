"""S26-FX1 fix round 3 (PR #786): the one-time re-read after the PARSER bump walks back under a head
whatever the stored outcome is, so a state an earlier parser wrote for a status reply on a BLOCKED (or
READY) commit reads it with its reason after the upgrade."""

from __future__ import annotations

from typing import Any

import pytest

from scripts.factory import watch
from scripts.factory.tests.test_fx1_fix_round import Builder, git, track_once
from scripts.factory.tests.test_fx1_fix_round2 import (  # noqa: F401
    BLOCKED,
    blocked,
    blocked_events,
    builder,
)


def stale_state(head: str, outcome: str | None) -> dict[str, Any]:
    """What an earlier parser wrote for `head`: it saw no outcome (or a wrong one) on a status reply."""
    return {
        "schema": 1,
        "alarms": {},
        "parser": watch.PARSER - 1,
        "tickets": {
            "tu": {
                "branch": "s99-x1",
                "head": head,
                "last_push_at": "2026-10-13T15:55:00Z",
                "outcome": outcome,
                "outcome_at": "2026-10-13T15:55:00Z",
            }
        },
    }


def test_the_reread_walks_back_under_a_reply_on_blocked_whatever_the_stored_outcome(
    builder: Builder,  # noqa: F811
) -> None:
    assert "waiting on a ruling" in BLOCKED
    blocked(builder)
    head = builder.reply("answering")
    state = stale_state(head, None)
    step, item = track_once(state, head, builder.main)
    seen = state["tickets"]["tu"]
    assert (seen["outcome"], seen["reason"]) == ("BLOCKED", "waiting on a ruling")
    assert item["state"] == "blocked"
    assert len(blocked_events(step)) == 1
    assert seen["blocked_commit"] == git(builder.path, "rev-parse", f"{head}^")

    state["parser"] = watch.PARSER  # run_pass marks the state read
    step, item = track_once(state, head, builder.main)  # no second event
    assert (item["state"], blocked_events(step)) == ("blocked", [])


def test_the_reread_walks_back_under_a_reply_on_ready_whatever_the_stored_outcome(
    builder: Builder,  # noqa: F811
) -> None:
    ready = builder.ready()
    head = builder.reply()
    state = stale_state(head, None)
    step, item = track_once(state, head, builder.main)
    seen = state["tickets"]["tu"]
    assert (seen["outcome"], seen["ready_commit"], seen["ready_head"]) == ("READY", ready, head)
    assert item["state"] == "ready"
    assert [e for e in step.events if e[0] == "READY"] == [("READY", "tu", ready[:8])]


def test_the_reread_keeps_a_reply_on_a_head_that_is_not_settled_working(
    builder: Builder,  # noqa: F811
) -> None:
    git(builder.path, "commit", "-q", "--allow-empty", "-m", "wip: not done")
    head = builder.reply()
    state = stale_state(head, None)
    step, item = track_once(state, head, builder.main)
    assert (item["state"], state["tickets"]["tu"]["outcome"]) == ("working", None)
    assert [e for e in step.events if e[0] in ("READY", "BLOCKED")] == []


@pytest.mark.parametrize("stored", ["READY", "BLOCKED"])
def test_a_matching_stored_outcome_is_kept_without_a_new_event(
    builder: Builder,  # noqa: F811
    stored: str,
) -> None:
    if stored == "READY":
        builder.ready()
    else:
        blocked(builder)
    head = builder.reply()
    state = stale_state(head, stored)
    step, _ = track_once(state, head, builder.main)
    assert state["tickets"]["tu"]["outcome"] == stored
    assert [e for e in step.events if e[0] in ("READY", "BLOCKED")] == []
