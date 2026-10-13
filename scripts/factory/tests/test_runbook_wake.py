"""S26-FX2, review round 2 of PR #794: the mod's wake replaces only the event-log Monitor. The
runbook keeps the orchestrator's `notify_when_idle` to each local builder it launches (session 26's
brief, row FX2), and no runbook file still tells it to Monitor events.log."""

from __future__ import annotations

import re
from pathlib import Path

RUNBOOK = Path(__file__).resolve().parents[3] / ".claude/skills/orchestrate-wave"


def test_step_4_keeps_notify_when_idle_for_local_builders() -> None:
    skill = (RUNBOOK / "SKILL.md").read_text()
    step = skill[skill.index("4. **Watch.**") : skill.index("5. **Review")]
    assert "notify_when_idle" in step, step
    assert re.search(r"local builder", step), step


def test_no_runbook_file_tells_the_orchestrator_to_monitor_events_log() -> None:
    for path in sorted(RUNBOOK.glob("*.md")):
        text = " ".join(path.read_text().split())  # a wrapped line reads as one
        found = re.search(r"(?<!no )Monitor (on|the) (the )?`?events\.log", text)
        assert found is None, f"{path.name}: {found[0] if found else ''}"
