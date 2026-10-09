"""The documents that state the review bar say strict is the default (S18-F6, PR #624 round 1).

Strict is the default: a file is lax only when it matches a `[lax]` glob and no `[strict]` carve-out of
`scripts/factory/review_tiers.toml`. PR #624's round-1 finding (score 50): the reviewer's prompt, the
SDLC and the ledger-record contract still said a strict path was one listed under `[strict]` ("security
walls, migrations, money, readers"), so a reader would file a 60 on the backend instead of fixing it.
This fails on that class: an old definition anywhere the bar is stated, or a bar document that does not
name the default rule."""

import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
# The documents that define the bar for a reader: each must name the default rule.
BAR_DOCS = (
    ".claude/agents/pr-reviewer.md",
    ".claude/agents/builder.md",
    "docs/sdlc.md",
    "docs/specs/factory/contracts/ledger-record.schema.json",
)
DEFAULT_RULE = "no `[strict]` carve-out"
# "`[strict]` in `scripts/factory/review_tiers.toml`", "`[strict] paths` of scripts/...": a strict path
# defined as one the `[strict]` list names.
OLD_DEFINITION = re.compile(
    r"`\[strict\](?: paths)?`\s+(?:in|of)\s+`?scripts/factory/review_tiers\.toml", re.IGNORECASE
)
# History and quotes of the owner's ruling, kept as written; this file and the acceptance tests.
NOT_SCANNED = ("docs/adr/", "docs/handoff/", "docs/research/", "docs/knowledge/lessons.md")


def flat(name: str) -> str:
    """The file's text with every whitespace run one blank (the rule may wrap across lines)."""
    return " ".join((ROOT / name).read_text().split())


def scanned() -> list[str]:
    done = subprocess.run(
        ["git", "ls-files", "-z", "--", "*.md", "*.json", "*.toml", "*.py", "*.mjs"],
        cwd=ROOT, capture_output=True, check=True,
    )  # fmt: skip
    names = [name for name in done.stdout.decode().split("\0") if name]
    return [
        name
        for name in names
        if not name.startswith(NOT_SCANNED)
        and "/acceptance/" not in name
        and name != "scripts/tests/test_bar_docs.py"
    ]


@pytest.mark.parametrize("name", BAR_DOCS)
def test_each_bar_document_names_strict_as_the_default(name: str) -> None:
    assert DEFAULT_RULE in flat(name), f"{name} does not say a file is strict unless lax"


def test_no_file_defines_a_strict_path_as_one_listed_under_strict() -> None:
    found = [name for name in scanned() if OLD_DEFINITION.search(flat(name))]
    assert found == []


def test_the_old_definition_is_caught() -> None:
    for text in (
        "on a strict path (`[strict]` in `scripts/factory/review_tiers.toml`: security walls",
        "on a strict path, `[strict] paths` of scripts/factory/review_tiers.toml (ADR 0041",
    ):
        assert OLD_DEFINITION.search(text)
    assert not OLD_DEFINITION.search(f"strict unless it matches a `[lax]` glob and {DEFAULT_RULE}")
