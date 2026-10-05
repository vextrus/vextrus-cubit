"""Ticket f4, T6: the workflow-script lint and the `/review-pr` workflow's static shape
(docs/specs/factory.md 3.8). A workflow script under `.claude/workflows/` must be deterministic (no
`Date.now()`, `Math.random()`, no-argument `new Date()`), import nothing at run time, parse under
`node --check`, and not take the name of a built-in command or alias.

Seam: `tools.lint.workflows_js.problems(root) -> list[str]` and `main`. The text is read comments
included, so the lint errs towards failing (like `tools/lint/workflows.py`).
"""

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
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

    assert REVIEW_PR.is_file()
    assert problems(REPO) == []
    monkeypatch.chdir(REPO)
    assert main([]) == 0


def _first_statement(text: str) -> str:
    """The text from the first line that is not blank or a comment."""
    return re.sub(r"\A(?:\s|//[^\n]*\n|/\*.*?\*/)*", "", text, flags=re.DOTALL)


def test_review_pr_has_the_specs_static_shape() -> None:
    text = REVIEW_PR.read_text()
    first = _first_statement(text)
    assert first.startswith("export const meta")
    meta = first[: first.index("}") + 1]
    assert re.search(r"""name:\s*['"]review-pr['"]""", meta)
    calls = [found.start() for found in re.finditer(r"\bagent\(", text)]
    assert len(calls) >= 2
    assert len(calls) == len(re.findall(r"""model:\s*['"]opus['"]""", text))
    check = re.search(r"scripts\.ledger check|scripts/ledger\.py check", text)
    assert check, "stage 0 runs the ledger's round check"
    assert check.start() < calls[1], "the round check runs before any reviewer"
    assert "ledger record" in text
    for banned in ("Date.now", "Math.random", "import("):
        assert banned not in text
