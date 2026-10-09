"""S19-F1 (2): verify plans the words lint wherever CI's web job runs it.

The defect, measured in session 19: CI's web job runs `uv run python -m tools.lint.words`
(`.github/workflows/web.yml`, "Words lint"); `scripts/verify.py` did not, so PR #628 verified green and
went red in CI on four "count without a plural" findings. The pin: a change under `web/` (a `.po`
catalogue, or any file under `web/src`) plans a `words-lint` check running
`uv run python -m tools.lint.words`, and so does a change to `tools/lint/words.py` itself.
"""

from pathlib import Path

import pytest

from scripts.verify import plan

WORDS = ("uv", "run", "python", "-m", "tools.lint.words")


def words_lint(paths: list[str], root: Path) -> list[tuple[str, ...]]:
    return [check.argv for check in plan(paths, root=root) if check.name == "words-lint"]


@pytest.mark.parametrize(
    "path",
    [
        "web/src/messages/takeoff/en.po",
        "web/src/drawings/locales/en.po",
    ],
)
def test_a_catalogue_change_plans_the_words_lint(path: str, tmp_path: Path) -> None:
    planned = words_lint([path], tmp_path)
    assert planned, f"no words-lint check planned for {path}"
    assert planned == [WORDS]


def test_a_web_source_change_plans_the_words_lint(tmp_path: Path) -> None:
    planned = words_lint(["web/src/takeoff/ConfirmStoreys.tsx"], tmp_path)
    assert planned, "no words-lint check planned for web/src"
    assert planned == [WORDS]


def test_a_change_to_the_words_lint_itself_plans_it(tmp_path: Path) -> None:
    planned = words_lint(["tools/lint/words.py"], tmp_path)
    assert planned, "no words-lint check planned for tools/lint/words.py"
    assert planned == [WORDS]
