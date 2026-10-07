"""Ticket S14-M1, the orchestrator's start: `scripts/factory/orchestrator.sh` starts `claude` on Opus 5.5
at `medium`, never `xhigh`, never Ultracode (session 14 factory plan 3: "Orchestrator: Opus 5.5
`medium` for the whole session; never `xhigh`, never Ultracode"; research models.md 4.2: it "must start
`claude --model claude-opus-5-5 --effort medium` and not pass `--effort ultracode`").

Black-box, with ticket f3's harness (`claude` and `uv` stubs first on PATH that record their argv). The
script's own arguments are those before the caller's, which stay last (f3's O1), so a caller's
`--effort high` (the owner's whole-session choice, plan 3) still comes after them.
"""

from __future__ import annotations

from pathlib import Path

from scripts.factory.tests.acceptance.test_orchestrator_sh import CALLER_ARGS, Start, show


def flag(argv: list[str], name: str) -> str | None:
    """The value after the last `name` in argv (or in a `name=value`), None when absent."""
    found = None
    for index, item in enumerate(argv):
        if item == name and index + 1 < len(argv):
            found = argv[index + 1]
        elif item.startswith(name + "="):
            found = item.split("=", 1)[1]
    return found


def test_the_orchestrator_starts_on_opus_at_medium_never_xhigh_or_ultracode(tmp_path: Path) -> None:
    start = Start(tmp_path)
    done = start.run()
    assert done.returncode == 0, show(done)
    [call] = start.calls("claude")
    argv: list[str] = call["argv"]
    assert argv[-len(CALLER_ARGS) :] == CALLER_ARGS, argv
    own = argv[: -len(CALLER_ARGS)]
    assert flag(own, "--model") == "claude-opus-5-5", own
    assert flag(own, "--effort") == "medium", own
    assert not [word for word in ("xhigh", "ultracode") if word in " ".join(own).lower()], own
