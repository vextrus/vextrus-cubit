"""Ticket S14-S1, issue #449: `--resume-md <path>` writes RESUME.md generated from the same table.

The authority:
- issue #449, "Fix": "`RESUME.md` is generated from it, not hand-written."
- issue #449, "Acceptance check": "The generated resume file contains no hand-written section."
- the orchestrator's brief for S14-S1: "`--resume-md` writes a RESUME.md generated from the same table
  (no hand-written state) to a given path."

Pinned: exit 0; the file at the given path names each ticket branch on one line with the table's words
for it ("READY, no PR"; the PR number); a file already at that path is replaced, so no hand-written line
survives; a second run after the tools' state changed writes the new state. Not pinned: the file's
layout, its headings, and whether the command also prints the table.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14s1._world import World, plain, ready, row, rows


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def written(world: World, path: Path) -> str:
    world.table("--resume-md", str(path))
    assert path.is_file(), f"no file at {path}"
    return path.read_text()


def test_resume_md_lists_each_branch_with_the_tables_words(world: World, tmp_path: Path) -> None:
    head = world.push("s99-alpha", ready)
    world.push("s99-bravo", plain)
    target = tmp_path / "out" / "RESUME.md"
    target.parent.mkdir()

    text = written(world, target)

    line = row(text, "s99-alpha")
    assert "READY, no PR" in line, text
    assert head[:7] in line, text
    assert "READY, no PR" not in row(text, "s99-bravo"), text


def test_resume_md_replaces_a_hand_written_file(world: World, tmp_path: Path) -> None:
    world.push("s99-alpha", ready)
    target = tmp_path / "RESUME.md"
    target.write_text(
        "# RESUME (hand-written)\n\n## Notes\n"
        "- Remember: s99-ghost is READY, no PR; ask the owner about the lock.\n"
    )

    text = written(world, target)

    assert "hand-written" not in text, text
    assert "Remember" not in text, text
    assert rows(text, "s99-ghost") == [], text
    assert "READY, no PR" in row(text, "s99-alpha"), text


def test_resume_md_is_regenerated_from_the_tools_on_each_run(world: World, tmp_path: Path) -> None:
    head = world.push("s99-alpha", ready)
    target = tmp_path / "RESUME.md"
    assert "READY, no PR" in row(written(world, target), "s99-alpha")

    world.pr(4721, "s99-alpha", head)
    text = written(world, target)

    line = row(text, "s99-alpha")
    assert "READY, no PR" not in line, text
    assert re.search(r"(?<![\w])4721(?![\w])", line), text
