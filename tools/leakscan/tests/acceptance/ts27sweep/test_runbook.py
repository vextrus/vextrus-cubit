"""S27-SWEEP (issue #836): the runbook names the sweep, to be run "at each session close".

The orchestrator's runbook (`.claude/skills/orchestrate-wave/commands.md`) holds its commands; its
`## Housekeeping` section names the sweep's command line.
"""

from __future__ import annotations

from tools.leakscan.tests.acceptance._leak import REPO

COMMAND = "uv run python -m tools.leakscan sweep-remote"


def test_the_runbook_housekeeping_names_the_sweep_command() -> None:
    text = (REPO / ".claude/skills/orchestrate-wave/commands.md").read_text(encoding="utf-8")
    start = text.find("\n## Housekeeping")
    assert start >= 0, "the runbook has no Housekeeping section"
    end = text.find("\n## ", start + 1)
    section = text[start : end if end >= 0 else len(text)]
    assert COMMAND in section, f"the runbook's Housekeeping does not name `{COMMAND}`"
