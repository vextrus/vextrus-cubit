"""Ticket f4, tier 2: light look-ups go to Sonnet through a project `Explore` agent, read only; the
drawing analyst is pinned to Opus at high effort (docs/specs/factory.md 3.3)."""

from tools.lint.tests.acceptance.tf4._frontmatter import REPO, as_list, split

AGENTS = REPO / ".claude/agents"


def test_explore_runs_on_sonnet_at_low_effort_and_cannot_write() -> None:
    meta, _ = split(AGENTS / "Explore.md")
    assert meta.get("name") == "Explore"
    assert (meta.get("model"), meta.get("effort")) == ("sonnet", "low")
    assert {"Edit", "Write", "NotebookEdit"} <= set(as_list(meta.get("disallowedTools")))


def test_the_drawing_analyst_runs_on_opus_at_high_effort() -> None:
    meta, _ = split(AGENTS / "drawing-analyst.md")
    assert (meta.get("model"), meta.get("effort")) == ("opus", "high")
