"""Ticket T-DOCS-RUNBOOK, acceptance A: `tools.lint.docs_paths` judges the commands the docs name.

Pinned (the ticket's section 3, A1-A4). The CLI stays `python -m tools.lint.docs_paths --root DIR`:
one line per problem on stdout, `<doc>:<line>: <reason>`, exit 1 on any, 0 when clean;
`docs_paths.problems(root)` stays the in-process seam.

A1, the module rule: a line `python -m <module>` whose module's first dotted segment is a top-level
entry of the tree must name a module on the tree (`<a/b>.py` or `<a/b>/__main__.py`), else "does not
exist"; the bare word after it, when the module's `--help` usage has a `{a,b}` choice group, must be
one of the group (the problem lists them), and when it has none the word is a problem naming the
module and the word. A placeholder, quote, digit or flag after the module is never judged. Fenced
lines are judged too.

A2, the `gh` rule (per inline-code span and per fenced line, in a skill, a `.claude/agents/` file, a
`.claude/rules/` file, `docs/agents/*.md`, `CLAUDE.md` and `docs/sdlc.md`): `gh issue|pr view <arg>`
with no `--json`, any `--comments`, any `gh pr edit`, an inline `--body "..."` on `gh issue
create|comment` and a `<<` heredoc after `--body` each give one problem on their line.

Each case runs the CLI on a throwaway `git init` repository; A3 runs the seam on this repository.
"""

import os
import subprocess
import sys
from pathlib import Path

from tools.lint import docs_paths

REPO = Path(__file__).resolve().parents[5]

# A stub lander with no choice group in its usage, as `scripts/land.py`
# (`python -m scripts.land <PR> ...`).
LAND = """import argparse

parser = argparse.ArgumentParser(prog="python -m scripts.land")
parser.add_argument("pr", nargs="+", metavar="PR")
parser.parse_args()
"""

# A stub with two subcommands: its usage reads `python -m scripts.stub [-h] {go,stop} ...`.
STUB = """import argparse

parser = argparse.ArgumentParser(prog="python -m scripts.stub")
sub = parser.add_subparsers(dest="command", required=True)
sub.add_parser("go")
sub.add_parser("stop")
parser.parse_args()
"""

BASE = {
    "scripts/__init__.py": "",
    "scripts/land.py": LAND,
    "scripts/stub.py": STUB,
    "CLAUDE.md": "# V\n\nThe map.\n",
    ".claude/skills/demo/SKILL.md": "---\nname: demo\ndescription: d\n---\n# Demo\n",
}


def clean_env() -> dict[str, str]:
    return {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}


def tree(root: Path, files: dict[str, str]) -> Path:
    """A `git init` repository at `root` holding BASE and `files` (path -> text), all `git add`ed."""
    every = {**BASE, **files}
    root.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init", "-q"], cwd=root, env=clean_env(), check=True)
    for name, text in every.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(text)
    subprocess.run(["git", "add", "--", *every], cwd=root, env=clean_env(), check=True)
    return root


def lint(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.docs_paths", "--root", str(root)],
        cwd=REPO,
        env=clean_env(),
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )


def report(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\nstdout:\n{done.stdout}\nstderr:\n{done.stderr}"


def on(done: subprocess.CompletedProcess[str], doc: str, line: int) -> list[str]:
    """The problems the CLI printed for `doc` at `line` (each line's text after `<doc>:<line>: `)."""
    prefix = f"{doc}:{line}: "
    return [row[len(prefix) :] for row in done.stdout.splitlines() if row.startswith(prefix)]


def skill(*lines: str) -> str:
    return BASE[".claude/skills/demo/SKILL.md"] + "".join(f"{line}\n" for line in lines)


SKILL = ".claude/skills/demo/SKILL.md"
HEAD = len(BASE[SKILL].splitlines())  # the skill's lines before the ones a case adds


# ------------------------------------------------------------------------------------- A1: modules


def test_a_word_after_a_module_without_subcommands_is_a_problem_naming_both(tmp_path: Path) -> None:
    root = tree(tmp_path / "r", {SKILL: skill("Order them with `uv run python -m scripts.land order`.")})
    done = lint(root)
    assert done.returncode == 1, report(done)
    found = on(done, SKILL, HEAD + 1)
    assert len(found) == 1, report(done)
    assert "scripts.land" in found[0], report(done)
    assert "order" in found[0], report(done)


def test_a_module_not_on_the_tree_does_not_exist(tmp_path: Path) -> None:
    root = tree(tmp_path / "r", {SKILL: skill("Then `uv run python -m scripts.nope`.")})
    done = lint(root)
    assert done.returncode == 1, report(done)
    found = on(done, SKILL, HEAD + 1)
    assert len(found) == 1, report(done)
    assert "scripts.nope" in found[0], report(done)
    assert "does not exist" in found[0], report(done)


def test_a_known_subcommand_passes_and_an_unknown_one_lists_the_choices(tmp_path: Path) -> None:
    root = tree(
        tmp_path / "r",
        {
            SKILL: skill(
                "Start: `uv run python -m scripts.stub go`.", "Then `python -m scripts.stub fly`."
            )
        },
    )
    done = lint(root)
    assert done.returncode == 1, report(done)
    assert on(done, SKILL, HEAD + 1) == [], report(done)
    found = on(done, SKILL, HEAD + 2)
    assert len(found) == 1, report(done)
    assert "fly" in found[0], report(done)
    assert "go, stop" in found[0], report(done)
    assert len(done.stdout.splitlines()) == 1, report(done)


def test_a_placeholder_quote_digit_or_flag_after_the_module_is_never_judged(tmp_path: Path) -> None:
    lines = [
        "Land: `uv run python -m scripts.land <PR>`.",
        "Land: `uv run python -m scripts.land 12 13`.",
        'Go: `python -m scripts.stub "text"`.',
        "Go: `python -m scripts.stub <command>`.",
        "Go: `python -m scripts.stub --x`.",
        "Help: `python -m scripts.land --help`.",
        "Then `python -m scripts.land order`.",
    ]
    root = tree(tmp_path / "r", {SKILL: skill(*lines)})
    done = lint(root)
    assert done.returncode == 1, report(done)
    # Only the last line, a bare word after a module with no subcommands, is judged.
    assert [row.split(": ", 1)[0] for row in done.stdout.splitlines()] == [f"{SKILL}:{HEAD + 7}"], (
        report(done)
    )


def test_a_fenced_line_is_judged_too(tmp_path: Path) -> None:
    root = tree(
        tmp_path / "r",
        {
            SKILL: skill(
                "Run:",
                "",
                "```",
                "uv run python -m scripts.stub go",
                "python -m scripts.stub fly",
                "```",
            )
        },
    )
    done = lint(root)
    assert done.returncode == 1, report(done)
    assert on(done, SKILL, HEAD + 4) == [], report(done)
    found = on(done, SKILL, HEAD + 5)
    assert len(found) == 1, report(done)
    assert "go, stop" in found[0], report(done)


def test_a_module_outside_the_tree_such_as_pytest_is_ignored(tmp_path: Path) -> None:
    lines = [
        "Test: `uv run python -m pytest -rf scripts`.",
        "Or `python3 -m json.tool data.json`.",
        "But `python -m scripts.stub fly`.",
    ]
    root = tree(tmp_path / "r", {SKILL: skill(*lines)})
    done = lint(root)
    assert done.returncode == 1, report(done)
    assert [row.split(": ", 1)[0] for row in done.stdout.splitlines()] == [f"{SKILL}:{HEAD + 3}"], (
        report(done)
    )


# ------------------------------------------------------------------------------------- A2: gh forms

# Each line below is one problem on its own line, in every doc of the command scan set.
BAD = [
    "Read `gh issue view 5` first.",
    "Read `gh pr view <n>` first.",
    "Read `gh issue view 5 --json title --comments` first.",
    "Label it: `gh pr edit 5 --add-label cloud`.",
    'File it: `gh issue create --title "t" --body "x"`.',
    'Answer: `gh issue comment 5 --body "x"`.',
]

# None of these is a problem.
CLEAN = [
    "Then `gh pr view <PR> --json statusCheckRollup`.",
    "Then, wrapped, `gh pr view <PR> --json",
    "statusCheckRollup` again.",
    "Read `gh issue view 5 --json title,body,labels,comments`.",
    "Resolve with `gh pr view` first.",
    'File it: `gh issue create --title "t" --body-file <f>`.',
    "Set a body: `gh api -X PATCH repos/vextrus/vextrus-cubit/pulls/5 -F body=@<f>`.",
]

DOCS = [
    SKILL,
    ".claude/agents/demo.md",
    ".claude/rules/demo.md",
    "docs/agents/demo.md",
    "CLAUDE.md",
    "docs/sdlc.md",
]


def gh_doc(name: str, lines: list[str]) -> str:
    head = BASE.get(name, "# Doc\n")
    return head + "".join(f"{line}\n" for line in lines)


def test_each_failing_or_refused_gh_form_is_one_problem_on_its_line_in_every_doc(tmp_path: Path) -> None:
    lines = [*BAD, "", *CLEAN]
    root = tree(tmp_path / "r", {name: gh_doc(name, lines) for name in DOCS})
    done = lint(root)
    assert done.returncode == 1, report(done)
    for name in DOCS:
        head = len(BASE.get(name, "# Doc\n").splitlines())
        for k, line in enumerate(BAD, start=1):
            assert len(on(done, name, head + k)) == 1, f"{name}: {line}\n{report(done)}"
        for k in range(len(BAD) + 1, len(lines) + 1):
            assert on(done, name, head + k) == [], f"{name}:{head + k}\n{report(done)}"
    assert len(done.stdout.splitlines()) == len(BAD) * len(DOCS), report(done)


def test_a_fenced_gh_line_and_a_heredoc_body_are_judged(tmp_path: Path) -> None:
    fence = [
        "```",
        "gh pr view 5",
        'gh issue create --title "t" --body "$(cat <<\'EOF\'',
        "gh pr view 5 --json state",
        "```",
    ]
    root = tree(tmp_path / "r", {"docs/agents/demo.md": gh_doc("docs/agents/demo.md", fence)})
    done = lint(root)
    assert done.returncode == 1, report(done)
    doc = "docs/agents/demo.md"
    assert len(on(done, doc, 3)) == 1, report(done)
    assert len(on(done, doc, 4)) >= 1, report(done)
    assert on(done, doc, 5) == [], report(done)


# ----------------------------------------------------------------------------- A3: the real tree


def test_the_real_tree_is_clean() -> None:
    assert docs_paths.problems(REPO) == []


# --------------------------------------------------------------------- A4: the old rules still hold


def test_the_path_rule_still_reports_a_missing_path(tmp_path: Path) -> None:
    root = tree(tmp_path / "r", {"CLAUDE.md": "# V\n\nThe scorer is `scripts/score/` now.\n"})
    done = lint(root)
    assert done.returncode == 1, report(done)
    assert done.stdout.splitlines() == ["CLAUDE.md:3: `scripts/score/` does not exist"], report(done)


def test_the_claude_md_length_rule_still_holds(tmp_path: Path) -> None:
    root = tree(tmp_path / "r", {"CLAUDE.md": "".join(f"line {n}\n" for n in range(91))})
    done = lint(root)
    assert done.returncode == 1, report(done)
    assert done.stdout.splitlines() == ["CLAUDE.md:91: 91 lines; at most 90"], report(done)


def test_the_lesson_rule_still_holds(tmp_path: Path) -> None:
    lessons = (
        "# Lessons\n\n## Session 9: x\n- **One.** It cost.\n"
        "- **Two.** It cost. Check: `scripts/stub.py`.\n"
    )
    root = tree(tmp_path / "r", {"docs/knowledge/lessons.md": lessons})
    done = lint(root)
    assert done.returncode == 1, report(done)
    assert done.stdout.splitlines() == [
        "docs/knowledge/lessons.md:4: a lesson without `Check:` and a path, or `No check:` and a reason"
    ], report(done)
