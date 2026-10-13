"""`trailers.status_line`: the `Factory-Status:` line of a builder's status reply (S26-FX1)."""

from __future__ import annotations

import pytest

from scripts.factory import trailers

ATTRIBUTION = "Co-Authored-By: Claude <noreply@example.com>\nClaude-Session: https://example.invalid/s\n"


@pytest.mark.parametrize(
    ("message", "line"),
    [
        ("status: answer\n\nFactory-Status: waiting on web\n", "waiting on web"),
        (f"status: answer\n\nFactory-Status: on test 3\n\n{ATTRIBUTION}", "on test 3"),
        ("status: answer\n\nfactory-status:   spaced  \n", "spaced"),
        ("status: answer\n\nFactory-Status:\n", None),  # no line
        ("status: answer\n\nFactory-Status: x\nFactory-State: READY\n", None),  # another factory trailer
        ("status: answer\n\nFactory-Status: x\nFactory-Status: y\n", None),  # repeated
        (
            "status: answer\n\nFactory-Status: x\n\nA closing.\n\nAnd more.\n",
            None,
        ),  # not in the last two
        ("status: answer\n\nFactory-State: BLOCKED\nFactory-Reason: r\n", None),
        ("status: answer\n\nNo trailer.\n", None),
    ],
)
def test_status_line(message: str, line: str | None) -> None:
    assert trailers.status_line(message) == line
