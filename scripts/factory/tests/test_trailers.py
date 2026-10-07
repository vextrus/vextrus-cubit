"""The one trailer reading (trailers.md 1) in its two languages: scripts/factory/trailers.py (the
watcher's) and .claude/hooks/trailers.mjs (the stop gate's, and byte for byte the guard's) agree on every
message of one table and of a seeded random corpus built from the characters the readers treat
specially."""

from __future__ import annotations

import json
import random
import shutil
import subprocess
from pathlib import Path

import pytest

from scripts.factory import trailers

REPO = Path(__file__).resolve().parents[3]
MODULE = REPO / ".claude" / "hooks" / "trailers.mjs"
TREE = "a" * 40
OTHER = "b" * 40
ATTRIBUTION = "Co-Authored-By: x <x@example.invalid>\nClaude-Session: https://example.invalid/s"
READY = f"Factory-State: READY\nFactory-Verify: {TREE} ok"

TABLE: list[tuple[str, str | None, str | None]] = [
    # (message, outcome, why)
    (f"feat: x\n\nBody.\n\n{READY}\n", "READY", None),
    (f"feat: x\n\nBody.\n\n{READY}\n\n{ATTRIBUTION}\n", "READY", None),
    (f"feat: x\n\n{READY}\n{ATTRIBUTION}\n", "READY", None),
    (f"feat: x\r\n\r\n{READY}\r\n", "READY", None),
    (f"feat: x\n\n{READY}\n\nprose\n\n{ATTRIBUTION}\n", "READY-NO-VERIFY", trailers.OUTSIDE),
    (
        f"feat: x\n\nFactory-State: BLOCKED\n\nprose\n\n{ATTRIBUTION}",
        "READY-NO-VERIFY",
        trailers.OUTSIDE,
    ),
    (f"feat: x\n\n{READY}\n\n{READY}\n", "READY-NO-VERIFY", trailers.OUTSIDE),
    ("Factory-State: READY\n\nbody\n\nend\n", "READY-NO-VERIFY", trailers.OUTSIDE),
    ("feat: x\n\nFactory-State: BLOCKED\nFactory-Reason: r\n\n" + ATTRIBUTION, "BLOCKED", None),
    (
        "feat: x\n\nFactory-State: BLOCKED\nFactory-Reason: r\nfactory_state: ready\n",
        "READY-NO-VERIFY",
        None,
    ),
    ("feat: x\n\nbody\n\nFactory State: READY\n", "READY-NO-VERIFY", trailers.LOOSE),
    ("feat: x\n\n  Factory-State: READY\n", "READY-NO-VERIFY", trailers.LOOSE),
    ("feat: x\n\n\xa0Factory-State: ready\n", "READY-NO-VERIFY", trailers.LOOSE),
    ("feat: x\n\nFactory-\u017ftate: READY\n", None, None),  # ASCII case folding only, as JS's /i
    ("feat: x\n\nFactory-State: READY\n", "READY-NO-VERIFY", "no Factory-Verify"),
    (f"feat: x\n\nFactory-State: READY\nFactory-Verify: {OTHER} ok\n", "READY-NO-VERIFY", None),
    (f"feat: x\n\nFactory-State: READY \t\nFactory-Verify: {TREE} ok\xa0\n", "READY-NO-VERIFY", None),
    ("feat: x\n\nFactory-State: BLOCKED\nFactory-Reason: " + "\U0001f600" * 200 + "\n", "BLOCKED", None),
    ("feat: x\n\nFactory-State: BLOCKED\nFactory-Reason: " + "\U0001f600" * 201 + "\n", None, None),
    ("feat: x\n\nFactory-State: BLOCKED\n", None, "BLOCKED without a one-line Factory-Reason"),
    ("feat: x\n\nFactory-Mood: fine\n", None, "an unknown factory trailer"),
    ("feat: x\n\nSigned-off-by: someone\n", None, None),
    ("", None, None),
    ("\n \n\t\n", None, None),
]


def node_read(messages: list[str]) -> list[dict[str, str | None]]:
    found = shutil.which("node")
    assert found, "node is not on PATH: the gates are node hooks"
    script = (
        f"import {{ readTrailers }} from {json.dumps(MODULE.as_uri())};\n"
        "let text = ''; process.stdin.on('data', (c) => (text += c));\n"
        "process.stdin.on('end', () => { const rows = JSON.parse(text);\n"
        "  process.stdout.write(JSON.stringify(rows.map(([m, t]) => readTrailers(m, t)))); });\n"
    )
    done = subprocess.run(
        [found, "--input-type=module", "-e", script],
        input=json.dumps([[m, TREE] for m in messages]),
        capture_output=True,
        text=True,
        timeout=60,
        check=True,
    )
    loaded: list[dict[str, str | None]] = json.loads(done.stdout)
    return loaded


@pytest.mark.parametrize(("message", "outcome", "why"), TABLE)
def test_the_python_reader_follows_the_table(message: str, outcome: str | None, why: str | None) -> None:
    read = trailers.read(message, TREE)
    assert read.outcome == outcome
    if why is not None:
        assert read.why == why


def test_the_node_reader_agrees_with_the_python_reader_on_the_table() -> None:
    messages = [message for message, _outcome, _why in TABLE]
    for message, got in zip(messages, node_read(messages), strict=True):
        read = trailers.read(message, TREE)
        assert (got["outcome"], got["why"], got["reason"]) == (read.outcome, read.why, read.reason), (
            message
        )


@pytest.mark.parametrize(
    ("message", "gated"),
    [
        (f"feat: x\n\nBody.\n\n{READY}\n\n{ATTRIBUTION}\n", True),
        ("feat: x\n\nFactory-State: READY\n", True),
        ("feat: x\n\nFactory-State: Ready\n\n" + ATTRIBUTION, True),
        ("feat: x\n\nfactory state : not ready\n", True),
        ("feat: x\n\nFactory-State: BLOCKED\nFactory-Reason: r\n", False),
        # Prose quoting the trailer further back is alarmed by the watcher but never gates a push
        # (guard-stamp-ready.test.mjs pins the guard's side).
        ("docs: x\n\nFactory-State: READY is what a builder writes.\n\nMore.\n\n" + ATTRIBUTION, False),
    ],
)
def test_the_gates_treat_a_ready_looking_line_in_the_last_two_paragraphs_as_ready(
    message: str, gated: bool
) -> None:
    assert trailers.read(message, TREE).gated is gated


PIECES = [
    "Factory-State: READY",
    "Factory-State: BLOCKED",
    "factory_state: Ready",
    "FACTORY STATE : not ready",
    f"Factory-Verify: {TREE} ok",
    f"Factory-Verify: {OTHER} ok",
    "Factory-Reason: a reason",
    "Factory-Mood: x",
    "Co-Authored-By: x",
    "prose line",
    "",
    " ",
    "\t",
    "\r",
    "\xa0",
    "\u2028",
    "\u0085",
    "\ufeff",
    "\x0b",
    "\u017f",
    "\U0001f600",
]


def test_the_two_readers_agree_on_a_seeded_random_corpus() -> None:
    rng = random.Random(448)
    messages = []
    for _ in range(3000):
        parts = [rng.choice(PIECES) for _ in range(rng.randint(0, 12))]
        joined = ""
        for part in parts:
            joined += part + rng.choice(["\n", "\n\n", "\n \n", "", " "])
        messages.append(joined)
    for message, got in zip(messages, node_read(messages), strict=True):
        read = trailers.read(message, TREE)
        assert (got["outcome"], got["why"], got["reason"]) == (read.outcome, read.why, read.reason), (
            repr(message)
        )
