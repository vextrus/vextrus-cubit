"""Ticket f7, tier 2 (cut fourth): CLAUDE.md to one page, detail moved to `.claude/rules/*.md`, and
`docs_paths.py`'s length rule (factory spec §3.1 "one page"; ticket f7 §3 C).

The spec's words: "<= 90 lines: the laws and a map. Detail moves to `.claude/rules/*.md` with
`paths:` frontmatter ... **Every law stays in CLAUDE.md.**" If this item is cut, this whole file is
deleted by a later `acceptance:` commit.
"""

from pathlib import Path

import pytest

from tools.lint.tests.acceptance.f7.support import LAWS, REPO, lint, make_repo, normalise, report

RULES = REPO / ".claude/rules"

# The spec's globs (§3.1), exactly.
GLOBS = {
    "backend": ["vextrus/**", "engine/**", "scripts/**", "tools/**"],
    "web": ["web/**"],
    "real-drawings": ["engine/**", "vextrus/takeoff/**", "scripts/real_drawings/**", "tools/scorer/**"],
    "factory": ["scripts/factory/**", ".claude/**"],
}

# Each rules file's detail that moved out of CLAUDE.md, one marker each.
CARRIES = {
    "backend": ["uv run pytest"],
    "web": ["npm --prefix web"],
    "real-drawings": ["scripts/real-drawings"],
    "factory": ["guard.mjs"],
    "machine": ["127.0.0.1", "vextrus_app"],
}


def frontmatter(text: str) -> list[str]:
    """The lines between a leading `---` and the next `---`; empty when there is none."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []
    for end, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return lines[1:end]
    return []


def unquote(item: str) -> str:
    return item.strip().strip("\"'")


def paths_of(text: str) -> list[str] | None:
    """The `paths:` list of a rules file's frontmatter, in YAML list form or as one comma line (with or
    without brackets); None when there is no `paths:` key."""
    lines = frontmatter(text)
    for i, line in enumerate(lines):
        if not line.startswith("paths:"):
            continue
        rest = line[len("paths:") :].strip()
        if rest:
            return [unquote(item) for item in rest.strip("[]").split(",") if unquote(item)]
        items = []
        for following in lines[i + 1 :]:
            if not following.strip().startswith("- "):
                break
            items.append(unquote(following.strip()[2:]))
        return items
    return None


def numbered(n: int) -> str:
    return "".join(f"Line {i}.\n" for i in range(1, n + 1))


def test_a_claude_md_of_91_lines_fails_naming_the_limit(tmp_path: Path) -> None:
    done = lint(make_repo(tmp_path / "repo", {"CLAUDE.md": numbered(91)}))
    assert done.returncode == 1, report(done)
    assert "CLAUDE.md" in done.stdout, report(done)
    assert "90" in done.stdout, report(done)


def test_a_claude_md_of_90_lines_passes(tmp_path: Path) -> None:
    done = lint(make_repo(tmp_path / "repo", {"CLAUDE.md": numbered(90)}))
    assert done.returncode == 0, report(done)


def test_the_repos_claude_md_is_one_page() -> None:
    count = len((REPO / "CLAUDE.md").read_text().splitlines())
    assert count <= 90, f"CLAUDE.md has {count} lines; at most 90"


@pytest.mark.parametrize("name", sorted(GLOBS))
def test_the_rules_file_loads_on_the_specs_globs(name: str) -> None:
    path = RULES / f"{name}.md"
    assert path.is_file(), f"{path.relative_to(REPO)} is missing"
    assert sorted(paths_of(path.read_text()) or []) == sorted(GLOBS[name])


def test_the_machine_rules_load_always() -> None:
    path = RULES / "machine.md"
    assert path.is_file(), f"{path.relative_to(REPO)} is missing"
    assert paths_of(path.read_text()) is None, "machine.md has no paths: (always loaded)"


@pytest.mark.parametrize("name", sorted(CARRIES))
def test_the_rules_file_carries_its_detail(name: str) -> None:
    path = RULES / f"{name}.md"
    assert path.is_file(), f"{path.relative_to(REPO)} is missing"
    text = path.read_text()
    missing = [marker for marker in CARRIES[name] if marker not in text]
    assert not missing, f"{name}.md lacks {missing}"


def test_every_law_stays_in_claude_md() -> None:
    text = (REPO / "CLAUDE.md").read_text()
    flat = normalise(text)
    markers = [
        "TYPESAFE_API_KEY",
        "AGPL-3.0",
        "public",
        "post-status",
        ".claude/rules/",
        "docs/handoff/",
    ]
    missing = [marker for marker in markers if marker not in text]
    missing += [law for law in LAWS if normalise(law) not in flat]
    assert not missing, f"CLAUDE.md lost {missing}"
