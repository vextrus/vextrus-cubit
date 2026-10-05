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


def test_choices_skip_an_options_value_group() -> None:
    usage = "usage: x [-h] [--only {storage,worktrees}] [{run,ensure}]"
    assert docs_paths.choices(usage) == ["run", "ensure"]
    assert docs_paths.choices("usage: x --kind {a,b} --head H") is None
    assert docs_paths.choices("usage: x <PR> [<PR> ...]") is None


def test_gh_problem_judges_only_failing_or_refused_forms() -> None:
    assert docs_paths.gh_problem("gh pr view 5") is not None
    assert docs_paths.gh_problem("gh pr view") is None
    assert docs_paths.gh_problem("gh pr view --web") is None
    assert docs_paths.gh_problem("gh pr view 5 --json state") is None
    assert docs_paths.gh_problem('gh issue close 5 --comment "t"') is None
    assert docs_paths.gh_problem("gh issue comment 5 --body-file f") is None
    assert docs_paths.gh_problem('gh issue comment 5 --body="x"') is not None
    assert docs_paths.gh_problem("the high road") is None
    found = docs_paths.gh_problem("gh issue view 5 --comments")
    assert found is not None  # one problem with two reasons
    assert "without `--json`" in found
    assert "`--comments`" in found


def test_a_module_closing_its_span_takes_no_word(tmp_path: Path) -> None:
    t = tree(tmp_path, {"scripts/land.py": ""})
    subprocess.run(["git", "add", "scripts/land.py"], cwd=tmp_path, check=True)
    t = docs_paths.Tree(tmp_path)
    usage = docs_paths.Usage(tmp_path)
    text = "Run `python -m scripts.land` then go.\nAnd `python -m tools.lint.<scan>` too.\n"
    assert list(docs_paths.module_problems(text, t, usage)) == []
    assert usage.seen == {}  # no word to judge, so no --help ran


def test_a_span_wrapped_between_the_module_and_its_word_is_judged(tmp_path: Path) -> None:
    land = 'import argparse\nargparse.ArgumentParser(prog="land").parse_args()\n'
    doc = (
        "Order with `uv run python -m scripts.land\norder` first.\n\n"
        "```\npython -m scripts.land \\\n  order\n```\n"
    )
    tree(tmp_path, {"scripts/__init__.py": "", "scripts/land.py": land, "CLAUDE.md": doc})
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    found = docs_paths.problems(tmp_path)
    assert found == [
        "CLAUDE.md:1: `scripts.land` takes no subcommand, so `order` is wrong",
        "CLAUDE.md:5: `scripts.land` takes no subcommand, so `order` is wrong",
    ]


def test_prose_pairs_spans_over_the_paragraph_not_the_line(tmp_path: Path) -> None:
    land = 'import argparse\nargparse.ArgumentParser(prog="land").parse_args()\n'
    clean = "Use `foo\nbar` then `python -m scripts.land`, `order` next.\n"
    wrapped = "\nThen `uv run python -m scripts.land\norder` here.\n"
    tree(tmp_path, {"scripts/__init__.py": "", "scripts/land.py": land, "CLAUDE.md": clean + wrapped})
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    assert docs_paths.problems(tmp_path) == [
        "CLAUDE.md:4: `scripts.land` takes no subcommand, so `order` is wrong"
    ]


def test_a_lone_backtick_never_shifts_the_pairing_past_its_block(tmp_path: Path) -> None:
    land = 'import argparse\nargparse.ArgumentParser(prog="land").parse_args()\n'
    across_heading = "A lone ` tick.\n## Then `python -m scripts.land`, `order` next\n\n"
    across_items = "- a lone ` here\n- then `python -m scripts.land`, `order` next.\n\n"
    wrapped = "Then `uv run python -m scripts.land\norder` here.\n"
    doc = across_heading + across_items + wrapped
    tree(tmp_path, {"scripts/__init__.py": "", "scripts/land.py": land, "CLAUDE.md": doc})
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    assert docs_paths.problems(tmp_path) == [
        "CLAUDE.md:7: `scripts.land` takes no subcommand, so `order` is wrong"
    ]


def test_one_block_splitter_serves_spans_and_prose(tmp_path: Path) -> None:
    land = 'import argparse\nargparse.ArgumentParser(prog="land").parse_args()\n'
    heading = "## The ` key\nRun `python -m scripts.land` once; then `order` here.\n\n"
    item_span = "- a lone ` tick\n- read it with `gh pr view 5` first\n\n"
    item_prose = "- a lone ` tick\n- never gh pr view 5 bare; see `x`\n"
    doc = heading + item_span + item_prose
    tree(tmp_path, {"scripts/__init__.py": "", "scripts/land.py": land, "CLAUDE.md": doc})
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    found = docs_paths.problems(tmp_path)
    assert [row.split(": ", 1)[0] for row in found] == ["CLAUDE.md:5"], found
    assert "without `--json`" in found[0]


def test_a_heading_is_a_block_by_itself() -> None:
    text = "intro `a\n# H `b` c\nd` e\n"
    assert [[n for n, _ in block] for block in docs_paths.blocks(text)] == [[1], [2], [3]]
