"""Ticket f7, obligation A: `tools.lint.docs_paths`'s path rule (factory spec §3.1, §10; ticket f7 §3).

The rule pinned. The scan set is `CLAUDE.md`, `.claude/rules/*.md`, `.claude/skills/**/*.md`,
`docs/sdlc.md`, `docs/architecture.md` and `docs/agents/*.md`. A repo path is an inline-code token
(single backticks, outside fenced blocks) with no whitespace and none of `< > * { } $`, holding a
`/`, whose first segment is a top-level entry of the repository, once a trailing `:N` or `:N-M` and
a trailing `/` are stripped. It must exist: in `git ls-files --cached --others --exclude-standard`,
or as a directory prefix of one, or (in a skill file) relative to that skill's own folder. Exempt:
the slug `vextrus/vextrus-cubit`; anything starting `.private/`, `~`, `/` or `http`; a path
`git check-ignore` matches; a bare file name. A glob token (`*`) whose first segment is a top-level
entry, and a glob in a rules file's `paths:` frontmatter, must match at least one listed file.

Each case runs the CLI on a throwaway `git init` repository; the last runs it on this repository.
"""

import re
from pathlib import Path

import pytest

from tools.lint.tests.acceptance.f7.support import lint, make_repo, report

# Top-level entries every fixture has, so a missing path below them is a repo path that must exist:
# `scripts/` exists and `scripts/score/` does not.
BASE = {
    "vextrus/foo.py": "",
    "scripts/run.py": "",
    "web/package.json": "{}\n",
    "docs/intent.md": "# Intent\n",
    ".private/keep.txt": "",
}

FAULT = "Line one.\nLine two.\nThe scorer lives in `scripts/score/` today.\n"


def repo(tmp_path: Path, files: dict[str, str]) -> Path:
    return make_repo(tmp_path / "repo", {**BASE, **files})


def test_a_clean_tree_passes(tmp_path: Path) -> None:
    done = lint(repo(tmp_path, {"CLAUDE.md": "# V\n\nThe code is in `vextrus/foo.py`.\n"}))
    assert done.returncode == 0, report(done)
    assert done.stdout.strip() == "", report(done)


def test_a_missing_path_in_claude_md_fails_naming_the_file_line_and_path(tmp_path: Path) -> None:
    done = lint(repo(tmp_path, {"CLAUDE.md": FAULT}))
    assert done.returncode == 1, report(done)
    assert "CLAUDE.md:3:" in done.stdout, report(done)
    assert "scripts/score/" in done.stdout, report(done)


@pytest.mark.parametrize(
    "name",
    [
        ".claude/skills/x/SKILL.md",
        ".claude/rules/r.md",
        "docs/sdlc.md",
        "docs/architecture.md",
        "docs/agents/issue-tracker.md",
    ],
)
def test_the_scan_set_is_checked(tmp_path: Path, name: str) -> None:
    done = lint(repo(tmp_path, {name: FAULT}))
    assert done.returncode == 1, report(done)
    assert f"{name}:3:" in done.stdout, report(done)
    assert "scripts/score/" in done.stdout, report(done)


@pytest.mark.parametrize("name", ["docs/handoff/session-01-prompt.md", "docs/intent.md"])
def test_files_outside_the_scan_set_are_history_and_not_checked(tmp_path: Path, name: str) -> None:
    done = lint(repo(tmp_path, {name: FAULT}))
    assert done.returncode == 0, report(done)


EXEMPT = [
    pytest.param(".private/work/x", {}, id="private"),
    pytest.param("~/reference/", {}, id="home"),
    pytest.param("/opt/vextrus", {}, id="absolute"),
    pytest.param("http://127.0.0.1:8000/api/", {}, id="url"),
    pytest.param("vextrus/vextrus-cubit", {}, id="the-repo-slug"),
    pytest.param("docs/<ticket>/x.md", {}, id="placeholder"),
    pytest.param(
        "web/src/api/schema.gen.ts", {".gitignore": "web/src/api/schema.gen.ts\n"}, id="git-ignored"
    ),
    pytest.param("README.md", {}, id="bare-file-name"),
    pytest.param("scripts/x.sh:12-20", {"scripts/x.sh": ""}, id="line-range"),
    pytest.param("scripts/x.sh:12", {"scripts/x.sh": ""}, id="line"),
    pytest.param("vextrus/", {}, id="directory"),
    pytest.param("vextrus/**", {}, id="glob-that-matches"),
]


@pytest.mark.parametrize(("token", "extra"), EXEMPT)
def test_exempt_and_existing_tokens_pass(tmp_path: Path, token: str, extra: dict[str, str]) -> None:
    done = lint(repo(tmp_path, {"CLAUDE.md": f"# V\n\nSee `{token}` here.\n", **extra}))
    assert done.returncode == 0, report(done)


def test_a_skill_may_name_a_path_under_its_own_folder(tmp_path: Path) -> None:
    files = {
        ".claude/skills/x/SKILL.md": "# X\n\nRun `scripts/helper.sh` first.\n",
        ".claude/skills/x/scripts/helper.sh": "",
    }
    done = lint(repo(tmp_path, files))
    assert done.returncode == 0, report(done)


def test_a_skills_own_path_does_not_excuse_another_file(tmp_path: Path) -> None:
    files = {
        ".claude/skills/x/scripts/helper.sh": "",
        "CLAUDE.md": "# V\n\nRun `scripts/helper.sh` first.\n",
    }
    done = lint(repo(tmp_path, files))
    assert done.returncode == 1, report(done)
    assert "CLAUDE.md:3:" in done.stdout, report(done)
    assert "scripts/helper.sh" in done.stdout, report(done)


def test_a_fenced_block_is_a_command_not_a_claim(tmp_path: Path) -> None:
    text = "# V\n\n```bash\nls `scripts/score/`\nls scripts/score/\n```\n"
    done = lint(repo(tmp_path, {"CLAUDE.md": text}))
    assert done.returncode == 0, report(done)


def test_the_same_path_in_inline_code_fails(tmp_path: Path) -> None:
    text = "# V\n\n```bash\nls `vextrus/foo.py`\n```\n\nThen `scripts/score/`.\n"
    done = lint(repo(tmp_path, {"CLAUDE.md": text}))
    assert done.returncode == 1, report(done)
    assert "CLAUDE.md:7:" in done.stdout, report(done)
    assert "scripts/score/" in done.stdout, report(done)


def test_a_glob_that_matches_nothing_fails(tmp_path: Path) -> None:
    done = lint(repo(tmp_path, {"CLAUDE.md": "# V\n\nEdits under `vextrus/nodir/**` load it.\n"}))
    assert done.returncode == 1, report(done)
    assert "CLAUDE.md:3:" in done.stdout, report(done)
    assert "vextrus/nodir/**" in done.stdout, report(done)


RULES_LIST = '---\npaths:\n  - "vextrus/**"\n  - "{glob}"\n---\n# Rules\n'
RULES_COMMA = "---\npaths: vextrus/**, {glob}\n---\n# Rules\n"


@pytest.mark.parametrize("form", [RULES_LIST, RULES_COMMA], ids=["yaml-list", "comma-line"])
def test_a_rules_glob_that_matches_no_file_fails(tmp_path: Path, form: str) -> None:
    done = lint(repo(tmp_path, {".claude/rules/r.md": form.format(glob="nodir/**")}))
    assert done.returncode == 1, report(done)
    assert ".claude/rules/r.md:" in done.stdout, report(done)
    assert "nodir/**" in done.stdout, report(done)


@pytest.mark.parametrize("form", [RULES_LIST, RULES_COMMA], ids=["yaml-list", "comma-line"])
def test_a_rules_glob_that_matches_passes(tmp_path: Path, form: str) -> None:
    done = lint(repo(tmp_path, {".claude/rules/r.md": form.format(glob="web/**")}))
    assert done.returncode == 0, report(done)


def test_the_output_is_one_file_line_what_line_per_problem(tmp_path: Path) -> None:
    text = (
        "# V\n"
        "The scorer lives in `scripts/score/` today.\n"
        "\n"
        "The launcher sits in `scripts/gone.py` now.\n"
    )
    done = lint(repo(tmp_path, {"CLAUDE.md": text}))
    assert done.returncode == 1, report(done)
    lines = [line for line in done.stdout.splitlines() if line.strip()]
    assert len(lines) == 2, report(done)
    for line in lines:
        assert re.fullmatch(r"[^\s:]+:\d+: \S.*", line), report(done)
    assert lines[0].startswith("CLAUDE.md:2: "), report(done)
    assert "scripts/score/" in lines[0], report(done)
    assert lines[1].startswith("CLAUDE.md:4: "), report(done)
    assert "scripts/gone.py" in lines[1], report(done)
    # The source line is not echoed: no prose from it reaches the output.
    assert "lives in" not in done.stdout, report(done)
    assert "sits in" not in done.stdout, report(done)


def test_the_repos_own_docs_are_clean() -> None:
    done = lint()
    assert done.returncode == 0, report(done)
