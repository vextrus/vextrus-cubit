"""The workflow-script lint parses a script the way the runner runs it: `export const meta` first,
then a body with top-level `await` and `return`."""

from pathlib import Path

from tools.lint.workflows_js import problems

BODY = "export const meta = { name: 'x', description: 'y' }\nconst r = await agent('a')\nreturn r\n"


def test_a_top_level_return_parses(tmp_path: Path) -> None:
    (tmp_path / ".claude/workflows").mkdir(parents=True)
    (tmp_path / ".claude/workflows/x.js").write_text(BODY)
    assert problems(tmp_path) == []


def test_a_banned_call_names_its_line(tmp_path: Path) -> None:
    (tmp_path / ".claude/workflows").mkdir(parents=True)
    (tmp_path / ".claude/workflows/x.js").write_text(BODY + "const t = Date . now()\n")
    assert problems(tmp_path) == [
        ".claude/workflows/x.js:4: Date.now() reads the clock: pass the time in args"
    ]
