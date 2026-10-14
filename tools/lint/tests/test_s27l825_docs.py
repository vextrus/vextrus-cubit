"""S27-L825 (#825): the living docs do not say the lander lands a PR "as it stands" (it refuses a head
that does not contain main's tip, ADR 0041, Amended 14 Oct 2026)."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DOCS = ("docs/sdlc.md", "docs/specs/factory.md", ".claude/skills/orchestrate-wave/SKILL.md")
STALE = re.compile(r"lander[^.\n]{0,80}as it stands|lands (?:it|each|a PR)[^.\n]{0,20}as it stands")


def test_no_living_doc_says_the_lander_lands_a_pr_as_it_stands() -> None:
    hits = [
        f"{name}:{number}"
        for name in DOCS
        for number, line in enumerate((ROOT / name).read_text().splitlines(), 1)
        if STALE.search(line)
    ]
    assert hits == []
