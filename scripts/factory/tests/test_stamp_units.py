"""Unit tests of the clock's durations and of status.py's tally."""

from __future__ import annotations

from typing import Any

import pytest

from scripts.factory import stamp, status


@pytest.mark.parametrize(
    ("text", "minutes"), [("90", 90), ("2h", 120), ("45m", 45), ("1h05m", 65), (" 3h ", 180)]
)
def test_durations(text: str, minutes: int) -> None:
    assert stamp.parse_minutes(text) == minutes


@pytest.mark.parametrize("text", ["", "0", "h", "1.5h", "5m3h", "-1"])
def test_bad_durations_are_refused(text: str) -> None:
    with pytest.raises(stamp.Refused):
        stamp.parse_minutes(text)


def test_hmm() -> None:
    assert stamp.hmm(0) == "0:00"
    assert stamp.hmm(665) == "11:05"


def test_the_builder_groups_tally_items_by_where_and_state() -> None:
    items: list[dict[str, Any]] = [
        {"where": "cloud", "state": "quiet", "quiet_minutes": 31},
        {"where": "cloud", "state": "quiet", "quiet_minutes": 45},
        {"where": "cloud", "state": "ready", "quiet_minutes": 2},
        {"where": "local", "state": "working", "quiet_minutes": None},
    ]
    cloud = status.builder_group(items, "cloud")
    assert cloud["quiet"] == 2
    assert cloud["ready"] == 1
    assert cloud["quiet_max_minutes"] == 45
    local = status.builder_group(items, "local")
    assert local["working"] == 1
    assert local["quiet_max_minutes"] is None
