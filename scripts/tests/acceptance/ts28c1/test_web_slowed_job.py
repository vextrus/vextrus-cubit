"""S28-C1 part 2: the web's slowed Vitest pass runs as its own job in parallel, and the required `web`
check still fails when it fails.

The ticket: "The slowed web test pass (today serial inside the web workflow) becomes its own parallel job
in `.github/workflows/web.yml`, keeping the required check names (`ci`, `web`, `engine`, `smoke`, ...)
and their meaning: a required check must still fail when the slowed pass fails." The slowed pass is the
`npm test` step that sets `VITE_FAKE_API_LATENCY_MS` (ts26fx11 pins it set once, on that step); the
plain pass is a `npm test` step that does not. A job skipped because a job it needs failed reports
"skipped", which a required check takes as passing; so the `web` check has to run and fail.

Read at the workflow's boundary with S14-C14's reader (`_workflows`: the file parsed, GitHub's
expressions evaluated). A READY pull request whose changes concern the web: `changes` succeeded with
`web` and `ready` 'true'; each other job the `web` check needs ended as the case says. The `web` check
"fails" when it runs and a `run:` step of it that reads a needed job's result exits non-zero under
`bash -e -o pipefail` (the steps that read no `needs.` are not run here: they cannot see the passes).
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest

from tools.lint.tests.acceptance.ts14c14 import _workflows as wf

WEB_YML = wf.WORKFLOWS / "web.yml"
KEY = "VITE_FAKE_API_LATENCY_MS"
CHECK = "web"
GATE = "changes"
SEPARATE = "web.yml runs the slowed pass inside the web check's own job"


def _flow() -> dict[str, Any]:
    return wf.load(WEB_YML)


def _runs_npm_test(step: dict[str, Any]) -> bool:
    return str(step.get("run", "")).strip() == "npm test"


def _slowed(step: dict[str, Any]) -> bool:
    return KEY in (step.get("env") or {})


def _jobs_with(flow: dict[str, Any], *, slowed: bool) -> list[str]:
    return [
        job_id
        for job_id, job in wf.jobs(flow).items()
        if any(_runs_npm_test(step) and _slowed(step) == slowed for step in job.get("steps") or [])
    ]


def _check_job(flow: dict[str, Any]) -> str:
    named = [job_id for job_id, job in wf.jobs(flow).items() if job.get("name", job_id) == CHECK]
    assert named == [CHECK], f"web.yml's check {CHECK!r} comes from {named}, not one job {CHECK!r}"
    return CHECK


def _passes(flow: dict[str, Any]) -> tuple[str, str]:
    """(the slowed pass's job, the plain pass's job); each one job, neither the `web` check's own."""
    slowed, plain = _jobs_with(flow, slowed=True), _jobs_with(flow, slowed=False)
    check = _check_job(flow)
    assert len(slowed) == 1, f"web.yml runs the slowed pass in {slowed}, not one job"
    assert len(plain) == 1, f"web.yml runs the plain pass in {plain}, not one job"
    assert check not in slowed, SEPARATE
    assert slowed != plain, "web.yml runs the slowed pass in the same job as the plain pass"
    return slowed[0], plain[0]


def _ancestors(flow: dict[str, Any], job_id: str) -> set[str]:
    jobs, seen, todo = wf.jobs(flow), set(), list(wf.needs(wf.jobs(flow)[job_id]))
    while todo:
        need = todo.pop()
        if need not in seen:
            seen.add(need)
            todo.extend(wf.needs(jobs[need]))
    return seen


def _context(flow: dict[str, Any], results: dict[str, str], web: str, ready: str) -> dict[str, Any]:
    context = wf.pull_request_context("web", 41, "s99-widget", "a" * 40, 1001)
    jobs = wf.jobs(flow)
    context["needs"] = {
        need: {
            "result": results.get(need, "success"),
            "outputs": {"web": web, "ready": ready} if need == GATE else {},
        }
        for need in wf.needs(jobs[CHECK])
    }
    statuses = {entry["result"] for entry in context["needs"].values()}
    context["__status__"] = "failure" if statuses & {"failure", "cancelled"} else "success"
    return context


def _web_check(flow: dict[str, Any], results: dict[str, str], tmp_path: Path) -> tuple[bool, list[int]]:
    """Whether the `web` check runs on a READY web change with these results, and the exit code of
    each of its `run:` steps that reads a needed job's result."""
    job = wf.jobs(flow)[CHECK]
    context = _context(flow, results, "true", "true")
    if not wf.condition(job, context):
        return False, []
    bash = shutil.which("bash")
    assert bash
    codes: list[int] = []
    for at, step in enumerate(job.get("steps") or []):
        env = step.get("env") or {}
        body = f"{step.get('run', '')}\n" + "\n".join(str(value) for value in env.values())
        if "run" not in step or not re.search(r"\bneeds\.[\w-]+\.result\b", body):
            continue
        if "if" in step and not wf.condition(step, context):
            continue
        script = tmp_path / f"web-{at}.sh"
        script.write_text(str(wf.interpolate(step["run"], context)))
        done = subprocess.run(
            [bash, "--noprofile", "--norc", "-e", "-o", "pipefail", str(script)],
            env={"PATH": "/usr/bin:/bin"}
            | {str(key): str(wf.interpolate(value, context)) for key, value in env.items()},
            capture_output=True,
            text=True,
            check=False,
        )
        codes.append(done.returncode)
    return True, codes


def test_the_slowed_pass_is_a_job_of_its_own() -> None:
    flow = _flow()
    slowed, plain = _passes(flow)
    assert slowed not in (CHECK, plain), SEPARATE


def test_the_slowed_and_the_plain_pass_run_in_parallel() -> None:
    flow = _flow()
    slowed, plain = _passes(flow)
    assert plain not in _ancestors(flow, slowed), f"{slowed} waits for {plain}"
    assert slowed not in _ancestors(flow, plain), f"{plain} waits for {slowed}"


@pytest.mark.parametrize("which", ["slowed", "plain"])
@pytest.mark.parametrize("outcome", ["failure", "cancelled"])
def test_the_web_check_fails_when_a_pass_does_not_pass(which: str, outcome: str, tmp_path: Path) -> None:
    flow = _flow()
    slowed, plain = _passes(flow)
    failed = slowed if which == "slowed" else plain
    assert failed in wf.needs(wf.jobs(flow)[CHECK]), f"the web check does not need {failed}"
    runs, codes = _web_check(flow, {failed: outcome}, tmp_path)
    assert runs, f"the web check is skipped when {failed} ends {outcome}: a skipped check passes"
    assert any(code != 0 for code in codes), f"the web check passes when {failed} ends {outcome}"


def test_the_web_check_passes_when_both_passes_pass(tmp_path: Path) -> None:
    flow = _flow()
    _passes(flow)
    runs, codes = _web_check(flow, {}, tmp_path)
    assert runs, "the web check does not run on a READY web change"
    assert codes, "no step of the web check reads the passes' results"
    assert all(code == 0 for code in codes), f"the web check fails when both passes pass: {codes}"


@pytest.mark.parametrize(("web", "ready"), [("true", "false"), ("false", "true")])
def test_the_slowed_pass_runs_only_on_a_ready_web_change(web: str, ready: str) -> None:
    flow = _flow()
    slowed, _ = _passes(flow)
    job = wf.jobs(flow)[slowed]
    assert GATE in _ancestors(flow, slowed), f"{slowed} does not wait for {GATE}"
    needed = {
        need: {"result": "success", "outputs": {"web": web, "ready": ready} if need == GATE else {}}
        for need in wf.needs(job)
    }
    context = wf.pull_request_context("web", 41, "s99-widget", "a" * 40, 1001) | {"needs": needed}
    assert not wf.condition(job, context), f"{slowed} runs with web={web} ready={ready}"
    go = {need: {**entry, "outputs": {"web": "true", "ready": "true"}} for need, entry in needed.items()}
    assert wf.condition(job, context | {"needs": go}), f"{slowed} does not run on a READY web change"
