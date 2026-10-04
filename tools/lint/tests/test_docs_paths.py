"""The docs' paths lint's own pieces (the acceptance tests under `acceptance/f7/` pin its CLI)."""

import subprocess
from pathlib import Path

from tools.lint import docs_paths


def tree(tmp_path: Path, files: dict[str, str]) -> docs_paths.Tree:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    for name, text in files.items():
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / name).write_text(text)
    return docs_paths.Tree(tmp_path)


def test_inline_tokens_skip_fences_and_number_lines() -> None:
    text = "a `x/y`\n```\n`in/fence`\n```\nb `p/q` and `r/s`\n"
    assert list(docs_paths.inline_tokens(text)) == [(1, "x/y"), (5, "p/q"), (5, "r/s")]


def test_a_span_wrapped_across_lines_keeps_the_pairing() -> None:
    text = "a `wrapped\nspan` then `scripts/score/` here\n\n`x/y`\n"
    assert list(docs_paths.inline_tokens(text)) == [
        (1, "wrapped span"),
        (2, "scripts/score/"),
        (4, "x/y"),
    ]


def test_a_stale_path_after_a_wrapped_span_fails(tmp_path: Path) -> None:
    tree(tmp_path, {"scripts/a.py": "", "CLAUDE.md": "Run `uv run\npytest` and `scripts/score/` now.\n"})
    subprocess.run(["git", "add", "CLAUDE.md", "scripts/a.py"], cwd=tmp_path, check=True)
    assert docs_paths.problems(tmp_path) == ["CLAUDE.md:2: `scripts/score/` does not exist"]


def test_a_candidate_keeps_its_trailing_slash_and_drops_a_line_suffix(tmp_path: Path) -> None:
    t = tree(tmp_path, {"scripts/a.py": ""})
    assert docs_paths.candidate("scripts/score/", t) == "scripts/score/"
    assert docs_paths.candidate("scripts/a.py:3-9", t) == "scripts/a.py"
    assert docs_paths.candidate("other/a.py", t) is None  # not a top-level entry
    assert docs_paths.candidate("a b/c", t) is None
    assert docs_paths.candidate("~/x/y", t) is None


def test_a_directory_matched_only_by_a_directory_ignore_rule_is_exempt(tmp_path: Path) -> None:
    t = tree(tmp_path, {".gitignore": "/.claude/worktrees/\n", ".claude/x.md": ""})
    assert docs_paths.path_problem(".claude/worktrees", "CLAUDE.md", t) is None


def test_frontmatter_paths_in_both_forms_with_line_numbers() -> None:
    listed = '---\nname: x\npaths:\n  - "a/**"\n  - b/**\nother: 1\n---\n- "c/**"\n'
    assert docs_paths.frontmatter_paths(listed) == [(4, "a/**"), (5, "b/**")]
    comma = "---\npaths: [a/**, 'b/**']\n---\n"
    assert docs_paths.frontmatter_paths(comma) == [(2, "a/**"), (2, "b/**")]
    assert docs_paths.frontmatter_paths("# no frontmatter\npaths: a/**\n") == []


def test_a_wrapped_stated_debt_and_a_sub_bullet_belong_to_their_lesson(tmp_path: Path) -> None:
    t = tree(tmp_path, {"scripts/a.py": ""})
    text = (
        "## Session 10: x\n"
        "- **One.** It cost. No\n"
        "  check yet: an issue.\n"
        "  - a sub-bullet with no check\n"
        "- **Two.** It cost. Check: `scripts/a.py`.\n"
        "- **Three.** It cost.\n"
    )
    assert list(docs_paths.lesson_problems(text, t)) == [
        (6, "a lesson without `Check:` and a path, or `No check:` and a reason")
    ]
