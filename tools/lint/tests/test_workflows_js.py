"""The workflow-script lint parses a script the way the runner runs it: `export const meta` first,
then a body with top-level `await` and `return`."""

from pathlib import Path

from tools.lint.workflows_js import problems, scripts

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


def test_the_real_workflow_scripts_pass() -> None:
    root = Path(__file__).resolve().parents[3]
    assert {path.name for path in scripts(root)} >= {"review-pr.js", "real-set-walk.js"}
    assert problems(root) == []


def test_the_harness_job_runs_both_lints() -> None:
    ci = Path(__file__).resolve().parents[3] / ".github/workflows/ci.yml"
    harness = ci.read_text().split("\n  harness:\n", 1)[1].split("\n  shards:\n", 1)[0]
    for command in ("python3 -m tools.lint.workflows_js", "python3 -m tools.lint.time_bombs"):
        assert f"        run: {command}\n" in harness
    assert harness.index("actions/setup-node") < harness.index("tools.lint.workflows_js")
