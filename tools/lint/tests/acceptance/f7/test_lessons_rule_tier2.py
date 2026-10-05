"""Ticket f7, tier 2 (cut third): `docs_paths.py`'s lesson rule (ticket f7 §3 D; the spec's issue title
"factory: lessons.md Check-path lint").

The rule pinned. In `docs/knowledge/lessons.md`, every top-level `- ` bullet (with its continuation
lines) under a `## Session NN` heading with NN >= 8 carries `Check:` followed by a backticked path
that exists, or `No check:` / `No check yet:` and a reason. Older sections and the area sections are
legacy and not held to it. If this item is cut, this whole file is deleted by a later `acceptance:`
commit.
"""

import subprocess
from pathlib import Path

import pytest

from tools.lint.tests.acceptance.f7.support import REPO, lint, make_repo, report

LESSONS = "docs/knowledge/lessons.md"
HEAD = "# Lessons, by area\n\n"


def run(tmp_path: Path, body: str) -> subprocess.CompletedProcess[str]:
    files = {"scripts/check_x.py": "", "vextrus/foo.py": "", LESSONS: HEAD + body}
    return lint(make_repo(tmp_path / "repo", files))


def test_a_session_08_bullet_with_no_check_fails(tmp_path: Path) -> None:
    done = run(tmp_path, "## Session 08 (1 Oct 2026)\n- **A class that cost us.** It cost an hour.\n")
    assert done.returncode == 1, report(done)
    assert f"{LESSONS}:4:" in done.stdout, report(done)


@pytest.mark.parametrize(
    "bullet",
    [
        pytest.param("- **A class.** It cost an hour. Check: `scripts/check_x.py`.\n", id="check"),
        pytest.param(
            "- **A class.** It cost an hour.\n  **Check:** `scripts/check_x.py`.\n",
            id="check-on-continuation",
        ),
        pytest.param(
            "- **A class.** It cost an hour. No check: only the owner sees it.\n", id="no-check"
        ),
        pytest.param(
            "- **A class.** It cost an hour. No check yet: factory: a tracked issue.\n",
            id="no-check-yet",
        ),
    ],
)
def test_a_session_bullet_with_a_check_or_a_stated_debt_passes(tmp_path: Path, bullet: str) -> None:
    done = run(tmp_path, "## Session 12 (4 Oct 2026)\n" + bullet)
    assert done.returncode == 0, report(done)


def test_a_check_naming_a_missing_path_fails(tmp_path: Path) -> None:
    done = run(
        tmp_path,
        "## Session 09 (2 Oct 2026)\n- **A class.** It cost an hour. Check: `scripts/gone.py`.\n",
    )
    assert done.returncode == 1, report(done)
    assert f"{LESSONS}:4:" in done.stdout, report(done)
    assert "scripts/gone.py" in done.stdout, report(done)


@pytest.mark.parametrize("heading", ["## Session 07 (29 Sep 2026)", "## Harness and agents"])
def test_legacy_sections_are_not_held_to_the_rule(tmp_path: Path, heading: str) -> None:
    done = run(tmp_path, f"{heading}\n- **A class that cost us.** It cost an hour.\n")
    assert done.returncode == 0, report(done)


def test_the_repos_lessons_pass_the_rule() -> None:
    text = (REPO / LESSONS).read_text()
    for session in ("08", "09", "10", "11", "12"):
        assert f"\n## Session {session}" in text, f"lessons.md has no ## Session {session}"
    done = lint()
    assert done.returncode == 0, report(done)
    assert f"{LESSONS}:" not in done.stdout, report(done)
