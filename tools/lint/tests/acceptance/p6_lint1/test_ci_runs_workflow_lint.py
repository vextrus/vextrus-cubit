"""Ticket T-LINT-1, section 3 A: the workflow-script lint (`tools/lint/workflows_js.py`) holds on the
repo's real `.claude/workflows/*.js`, catches a clock read planted in a copy of them, and CI's `harness`
job runs it, and the time-bomb lint, on every change, after Node is set up (the script runs
`node --check`).

A1 and A2 are green on the base by design (pins); A3 is red until `ci.yml` gains both steps.
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from tools.lint.workflows_js import problems, scripts

REPO = Path(__file__).resolve().parents[5]
CI = REPO / ".github" / "workflows" / "ci.yml"
SETUP_NODE = "actions/setup-node"


def harness_job() -> str:
    """The `harness` job's text in ci.yml: from `  harness:` to the next two-space job key."""
    text = CI.read_text()
    start = re.search(r"^  harness:[ \t]*$", text, re.MULTILINE)
    assert start is not None, "ci.yml has no `harness` job"
    after = re.search(r"^  [A-Za-z0-9_-]+:", text[start.end() :], re.MULTILINE)
    return text[start.start() : start.end() + after.start()] if after else text[start.start() :]


def steps(job: str) -> list[str]:
    """Each step of the job, as text: split at the `      - ` lines under `steps:`."""
    body = job.split("    steps:\n", 1)
    assert len(body) == 2, "the harness job has no `steps:`"
    return [part for part in re.split(r"^(?=      - )", body[1], flags=re.MULTILINE) if part.strip()]


def step_running(job: str, command: str) -> tuple[int, str]:
    """The index and text of the one step whose `run:` is exactly the command."""
    run = re.compile(rf"^      (?:- |  )run: {re.escape(command)}[ \t]*$", re.MULTILINE)
    found = [(index, step) for index, step in enumerate(steps(job)) if run.search(step)]
    assert len(found) == 1, f"the harness job has {len(found)} steps whose run: is {command!r}"
    return found[0]


def assert_runs_on_every_change_after_node(command: str) -> None:
    job = harness_job()
    head = job.split("    steps:\n", 1)[0]
    assert not re.search(r"^    if:", head, re.MULTILINE), "the harness job must run on every change"
    index, step = step_running(job, command)
    assert not re.search(r"^        if:", step, re.MULTILINE), f"the {command!r} step has an if:"
    node = [number for number, text in enumerate(steps(job)) if SETUP_NODE in text]
    assert node, f"the harness job does not use {SETUP_NODE}"
    assert node[0] < index, f"{SETUP_NODE} must come before the {command!r} step"


def test_the_real_workflow_scripts_pass_the_workflow_script_lint() -> None:
    names = {path.name for path in scripts(REPO)}
    assert {"review-pr.js", "real-set-walk.js"} <= names
    assert problems(REPO) == []


def test_a_clock_read_planted_in_a_copy_of_the_real_scripts_is_refused(tmp_path: Path) -> None:
    folder = tmp_path / ".claude" / "workflows"
    folder.mkdir(parents=True)
    for path in scripts(REPO):
        shutil.copyfile(path, folder / path.name)
    target = folder / "review-pr.js"
    text = target.read_text()
    text = (text if text.endswith("\n") else text + "\n") + "const t = Date.now()\n"
    target.write_text(text)
    line = len(text.splitlines())
    expected = (
        f".claude/workflows/review-pr.js:{line}: Date.now() reads the clock: pass the time in args"
    )

    assert problems(tmp_path) == [expected]

    done = subprocess.run(
        [sys.executable, "-m", "tools.lint.workflows_js", str(tmp_path)],
        cwd=REPO,
        env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 1, done.stdout + done.stderr
    assert expected in done.stdout.splitlines()


def test_the_harness_job_runs_the_workflow_script_lint_after_setting_up_node() -> None:
    assert_runs_on_every_change_after_node("python3 -m tools.lint.workflows_js")


def test_the_harness_job_runs_the_time_bomb_lint_after_setting_up_node() -> None:
    assert_runs_on_every_change_after_node("python3 -m tools.lint.time_bombs")
