"""S14-D1 (factory-next.md section 8, row 17): "ADR 0043 superseding ADR 0042's review part"; the owner
approved it on 5 Oct 2026 (Q1). The review command it records is the one factory-next.md section 2 names:
"one background command, `uv run python -m scripts.factory.review run <PR>`".

ADR 0042 is marked at its head the way this repository marks a superseded or amended ADR (ADR 0001's
"**Superseded by ADR 0033**", ADR 0041's "**Amended by ADR 0042**"): within the two paragraphs after its
title. The index, `docs/adr/README.md`, lists every ADR with its status.
"""

import re

from tools.lint.tests.acceptance.ts14d1._repo import REPO, adr_files, flat, paragraphs, read

SUPERSEDES = re.compile(r"supersed", re.IGNORECASE)
REVIEW = re.compile(r"\breview", re.IGNORECASE)


def adr_0043() -> str:
    found = adr_files("0043")
    assert len(found) == 1, f"docs/adr/0043-*.md: {len(found)} files ({[p.name for p in found]})"
    return found[0].read_text(encoding="utf-8")


def test_adr_0043_exists_as_one_file_with_a_title() -> None:
    text = adr_0043()
    assert text.startswith("# "), "ADR 0043 does not open with a `# ` title"


def test_adr_0043_says_it_supersedes_the_review_part_of_adr_0042() -> None:
    text = adr_0043()
    said = [p for p in paragraphs(text) if SUPERSEDES.search(p) and "0042" in p and REVIEW.search(p)]
    assert said, "no paragraph of ADR 0043 says it supersedes ADR 0042's review part"


def test_adr_0043_names_scripts_factory_review_run_as_the_review_command() -> None:
    assert "scripts.factory.review run <PR>" in flat(adr_0043())


def test_adr_0042_is_marked_superseded_in_part_by_adr_0043_at_its_head() -> None:
    found = adr_files("0042")
    assert len(found) == 1, f"docs/adr/0042-*.md: {len(found)} files"
    lines = found[0].read_text(encoding="utf-8").splitlines()
    assert lines, "ADR 0042 is empty"
    assert lines[0].startswith("# "), "ADR 0042 lost its title"
    head = paragraphs("\n".join(lines[1:]))[:2]
    marked = [p for p in head if SUPERSEDES.search(p) and "0043" in p and REVIEW.search(p)]
    assert marked, f"ADR 0042's head does not say its review part is superseded by ADR 0043: {head}"


def test_the_adr_index_lists_0043_and_marks_0042() -> None:
    index = read("docs/adr/README.md")
    rows = [line for line in index.splitlines() if line.startswith("| [")]
    new = [row for row in rows if row.startswith("| [0043](0043-")]
    assert len(new) == 1, "docs/adr/README.md has no row for ADR 0043"
    link = re.search(r"\((0043-[^)]+\.md)\)", new[0])
    assert link, new[0]
    assert (REPO / "docs/adr" / link.group(1)).is_file(), new[0]
    old = [row for row in rows if row.startswith("| [0042](")]
    assert len(old) == 1, "docs/adr/README.md has no row for ADR 0042"
    assert "0043" in old[0], "ADR 0042's index row does not name 0043"
