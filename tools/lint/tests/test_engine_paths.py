"""The engine paths (the M0 plan, Labels): which changed files make a PR an engine PR, a UI PR, or
neither. The not-applicable workflow runs main's copy of this on the PR's changed-file list."""

import io
import sys
from pathlib import Path

import pytest

from tools.lint.engine_paths import main, matching, read_patterns

ENGINE_PATHS = Path(__file__).resolve().parents[3] / ".github" / "engine-paths.txt"


def engine_patterns() -> list[str]:
    return read_patterns(ENGINE_PATHS.read_text())


def test_a_docs_only_change_touches_no_engine_path() -> None:
    changed = ["docs/plans/M0.md", "CLAUDE.md", "docs/adr/0030-real-drawing-check.md"]

    assert matching(changed, engine_patterns()) == []


def test_an_engine_change_is_an_engine_pr() -> None:
    changed = ["docs/plans/M0.md", "engine/read/anchor.py"]

    assert matching(changed, engine_patterns()) == ["engine/read/anchor.py"]


@pytest.mark.parametrize(
    "path",
    [
        "engine/read/tests/test_toolchain.py",
        "tools/acadsharp-dump/Program.cs",
        "toolchain/libredwg.version",
        "uv.lock",
        "pyproject.toml",
        ".python-version",
    ],
)
def test_until_21c_the_engine_paths_are_what_the_harness_executes(path: str) -> None:
    assert matching([path], engine_patterns()) == [path]


@pytest.mark.parametrize(
    "path",
    [
        "vextrus/drawings/models.py",  # joins at 21c
        "web/src/main.tsx",
        "engine-notes.md",
        "docs/engine/read.md",
        "tools/lint/uv.lock",
        ".github/workflows/engine.yml",
    ],
)
def test_near_misses_are_not_engine_paths(path: str) -> None:
    assert matching([path], engine_patterns()) == []


def test_the_web_pattern_marks_a_ui_pr() -> None:
    assert matching(["docs/x.md", "web/src/ui/Kbd.tsx"], ["web/**"]) == ["web/src/ui/Kbd.tsx"]
    assert matching(["docs/x.md", "webby/a.ts"], ["web/**"]) == []


def test_comments_and_blank_lines_are_not_patterns() -> None:
    text = "# the engine\n\nengine/**   \n  uv.lock # the lock\n"

    assert read_patterns(text) == ["engine/**", "uv.lock"]


def test_the_command_prints_the_matching_paths(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "stdin", io.StringIO("docs/a.md\nengine/x.py\n\nuv.lock\n"))

    assert main(["--patterns", str(ENGINE_PATHS)]) == 0
    assert capsys.readouterr().out == "engine/x.py\nuv.lock\n"


def test_the_command_takes_one_pattern(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "stdin", io.StringIO("docs/a.md\n"))

    assert main(["--pattern", "web/**"]) == 0
    assert capsys.readouterr().out == ""
