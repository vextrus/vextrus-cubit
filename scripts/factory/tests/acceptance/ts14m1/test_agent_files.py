"""Ticket S14-M1, the agent files: every `.claude/agents/*.md` sets its model and its effort, as the
model and effort map says (session 14 factory plan 3, approved by the owner 5 Oct 2026 as Q1: "set
model and effort explicitly in every launch and agent file; never rely on defaults").

The map's rows pinned here: acceptance-writer Opus 5.5 high; refuter Sonnet 5.5 high; builder one of
its two rows (ordinary Sonnet 5.5 medium or high, hard Opus 5.5 high: one file serves both, the launch
names the model). A model is the alias (`opus`, `sonnet`) or the full id; either passes.
The builder file carries the two Sonnet 5.5 paragraphs the plan names, "keep working until everything
asked is done" and "run a real check", pinned by those stable phrases only.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
AGENTS = REPO / ".claude" / "agents"
OPUS = {"opus", "claude-opus-5-5"}
SONNET = {"sonnet", "claude-sonnet-5-5"}


def frontmatter(path: Path) -> dict[str, str]:
    """The `key: value` lines between the file's opening `---` and the next `---`."""
    lines = path.read_text().splitlines()
    assert lines, f"{path.name} is empty"
    assert lines[0].strip() == "---", f"{path.name} has no frontmatter"
    found: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return found
        key, sep, value = line.partition(":")
        if sep and not line.startswith((" ", "\t")):
            found[key.strip()] = value.strip().strip("'\"")
    raise AssertionError(f"{path.name}'s frontmatter is not closed")


def prose(path: Path) -> str:
    """The file's text with markdown emphasis dropped and every run of whitespace one space."""
    return re.sub(r"\s+", " ", re.sub(r"[*_`]", "", path.read_text())).lower()


def test_every_agent_file_sets_its_model_and_its_effort() -> None:
    files = sorted(AGENTS.glob("*.md"))
    assert files, f"no agent files under {AGENTS}"
    missing = {
        path.name: sorted({"model", "effort"} - {k for k, v in frontmatter(path).items() if v})
        for path in files
    }
    assert {name: keys for name, keys in missing.items() if keys} == {}


def test_the_acceptance_writer_runs_on_opus_at_high() -> None:
    front = frontmatter(AGENTS / "acceptance-writer.md")
    assert front.get("model") in OPUS, front
    assert front.get("effort") == "high", front


def test_the_refuter_runs_on_sonnet_at_high() -> None:
    front = frontmatter(AGENTS / "refuter.md")
    assert front.get("model") in SONNET, front
    assert front.get("effort") == "high", front


def test_the_builder_file_names_a_builder_row_of_the_map() -> None:
    front = frontmatter(AGENTS / "builder.md")
    pair = (front.get("model"), front.get("effort"))
    assert (pair[0] in SONNET and pair[1] in {"medium", "high"}) or (
        pair[0] in OPUS and pair[1] == "high"
    ), front


def test_the_builder_is_told_to_keep_working_until_everything_asked_is_done() -> None:
    assert "keep working until everything" in prose(AGENTS / "builder.md")


def test_the_builder_is_told_to_run_a_real_check() -> None:
    assert "run a real check" in prose(AGENTS / "builder.md")
