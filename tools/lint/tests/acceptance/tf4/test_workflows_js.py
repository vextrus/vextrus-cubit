"""Ticket f4, T6: the workflow-script lint (docs/specs/factory.md 3.8). A workflow script under
`.claude/workflows/` must be deterministic (no `Date.now()`, `Math.random()`, no-argument `new Date()`),
import nothing at run time, parse under `node --check`, and not take the name of a built-in command or
alias.

This file also pinned the `/review-pr` workflow's static shape. S14-R3 deletes `review-pr.js` (ADR 0043:
"`/review-pr` stays only until S14-R3 retires it"), so that test went with the file it read, and the
repository check reads `real-set-walk.js`, the workflow left.

Seam: `tools.lint.workflows_js.problems(root) -> list[str]` and `main`. The text is read comments
included, so the lint errs towards failing (like `tools/lint/workflows.py`).
"""

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
REAL_SET_WALK = REPO / ".claude/workflows/real-set-walk.js"
REVIEW_PR = REPO / ".claude/workflows/review-pr.js"
VALID = """export const meta = {
  name: 'ok',
  description: 'A valid workflow script',
}

const result = await agent('Say hello', { label: 'hello', model: 'opus' })
log(result)
"""


def problems(root: Path) -> list[str]:
    from tools.lint.workflows_js import problems as found

    return found(root)


def workflow(root: Path, name: str, text: str) -> Path:
    folder = root / ".claude" / "workflows"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name
    path.write_text(text)
    return path


def test_a_valid_script_and_a_root_with_no_workflows_pass(tmp_path: Path) -> None:
    assert problems(tmp_path) == []
    workflow(tmp_path, "ok.js", VALID)
    assert problems(tmp_path) == []


@pytest.mark.parametrize(
    "line",
    [
        "const stamp = Date.now()",
        "const pick = Math.random()",
        "const today = new Date()",
        "// a comment that calls Date.now() still fails",
        "const mod = await import('./other.js')",
    ],
    ids=["date-now", "math-random", "new-date", "in-a-comment", "dynamic-import"],
)
def test_a_nondeterministic_call_or_an_import_is_named_by_file_and_line(
    tmp_path: Path, line: str
) -> None:
    workflow(tmp_path, "bad.js", VALID + line + "\n")
    at = VALID.count("\n") + 1
    found = problems(tmp_path)
    assert found
    assert any(f"bad.js:{at}" in problem for problem in found)


def test_a_date_from_the_arguments_is_fine(tmp_path: Path) -> None:
    workflow(tmp_path, "ok.js", VALID + "const now = new Date(args.now)\n")
    assert problems(tmp_path) == []


def test_a_syntax_error_fails(tmp_path: Path) -> None:
    workflow(tmp_path, "broken.js", VALID + "const x = {\n")
    found = problems(tmp_path)
    assert any("broken.js" in problem for problem in found)


@pytest.mark.parametrize(
    "name", ["review.js", "help.js", "run.js", "ultrareview.js", "stats.js", "new.js"]
)
def test_a_script_named_like_a_built_in_command_or_alias_fails(tmp_path: Path, name: str) -> None:
    workflow(tmp_path, name, VALID)
    found = problems(tmp_path)
    assert any(name in problem for problem in found)


def test_review_pr_is_not_a_built_in_name(tmp_path: Path) -> None:
    workflow(tmp_path, "review-pr.js", VALID)
    assert problems(tmp_path) == []


def test_the_repositorys_workflows_pass_and_main_agrees(monkeypatch: pytest.MonkeyPatch) -> None:
    from tools.lint.workflows_js import main

    assert REAL_SET_WALK.is_file()
    assert problems(REPO) == []
    monkeypatch.chdir(REPO)
    assert main([]) == 0


def test_the_review_pr_workflow_whose_shape_this_file_pinned_is_gone() -> None:
    assert not REVIEW_PR.exists(), "review-pr.js is still in .claude/workflows (S14-R3 deletes it)"
