"""S14-F13 (issue #463): the command card's extras, and SKILL.md's size.

The card is `.claude/skills/orchestrate-wave/SKILL.md` and `commands.md` beside it, read together (as
S14-D1's acceptance tests read it, `tools/lint/tests/acceptance/ts14d1/`; these pins add to D1's and
contradict none: D1 pins `review run`, `state`, `recover`, `publish` and `scripts.land update`).

The authority:
- Issue #463, "What happened": "About 11 `--help` or source re-reads of factory tools (... `launch`
  3)"; "The Monitor filter was edited by hand"; "Fix": "A one-page command card of every factory
  command's exact accepted spelling"; "`... --follow --only READY,BLOCKED,LEAK-HIT,BUDGET-PASSED,
  LOCAL-IDLE,CI` as the one documented tail". `events.py` is not on the tree, so the tail's command is
  the builder's choice; its event kinds are pinned (the watcher's own codes, `scripts/factory/watch.py`).
- Issue #462, "Fix": "`sweep.py --old-sessions`": a factory command, so the card spells it.
- The orchestrator's brief (session 14): "keep SKILL.md at most 80 lines".
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
SKILL = REPO / ".claude/skills/orchestrate-wave/SKILL.md"
COMMANDS = REPO / ".claude/skills/orchestrate-wave/commands.md"
TAIL_KINDS = ("READY", "BLOCKED", "LEAK-HIT", "BUDGET-PASSED", "LOCAL-IDLE")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def card() -> str:
    return read(SKILL) + "\n" + read(COMMANDS)


def flat(text: str) -> str:
    return " ".join(text.split())


def test_the_card_spells_launch_say_with_its_arguments() -> None:
    found = re.search(r"python -m scripts\.factory\.launch say ([^`]*)`", flat(card()))
    assert found, "the card gives no `python -m scripts.factory.launch say ...` line in backticks"
    spelled = found.group(1)
    assert not spelled.startswith(("...", "…")), f"the card elides launch say's arguments: {spelled!r}"
    for option in ("--file", "--ticket"):
        assert option in spelled, f"the card's launch say line does not spell {option}: {spelled!r}"


def test_the_card_gives_one_tail_line_naming_each_event_kind_to_watch() -> None:
    lines = [line for line in card().splitlines() if all(kind in line for kind in TAIL_KINDS)]
    assert lines, f"no one line of the card names each of {', '.join(TAIL_KINDS)}"


def test_the_card_names_the_old_sessions_sweep() -> None:
    assert "python -m scripts.factory.sweep --old-sessions" in flat(card()), (
        "the card does not spell `python -m scripts.factory.sweep --old-sessions`"
    )


def test_skill_md_is_at_most_80_lines() -> None:
    count = len(read(SKILL).splitlines())
    assert 0 < count <= 80, f"SKILL.md has {count} lines; the card's extras go in commands.md"
