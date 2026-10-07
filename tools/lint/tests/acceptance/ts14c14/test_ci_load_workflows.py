"""S14-C14: less CI load, read from the committed workflow files (issue #466, part A).

The authority: factory-next.md section 8 row 15, "CI load: cancel superseded runs, heavy jobs only on
READY heads, path filters inside the always-running `ci` job", acceptance check "a non-READY push starts
no
heavy workflow; a second push cancels the first run; `ci` still reports on a docs-only PR"; section 7,
F14 #466, "Risk: a path-filtered required check stays pending, so keep the required `ci` job always
running and filter inside it". The required checks are `ci`, `web`, `engine`, `real-drawings` and
`design-gate` (merge_ready.py; real-drawings-na.yml).

The heavy jobs (named from the files): ci.yml's `python` (the test shards' matrix) and `python-checks`
(each a PostgreSQL service and the locked install), engine.yml's `toolchain` and `check-sandbox` (the
toolchain installs), web.yml's `web` (npm, Chromium, Vitest, the build) and e2e.yml's `smoke` (the whole
stack). The light ones (`changes`, `markets`, `harness`, `shards`, `design-docs`, the `ci` and `engine`
roll-ups, the not-applicable poster) are not gated.

The READY gate is `python3 -m scripts.factory.ci_gate` (test_ci_gate.py names it): a heavy job runs
only when an output of a job it needs, fed by a step that runs the gate, says so. No workflow is run
and nothing is fetched: the files are parsed (`_workflows.load`) and their expressions evaluated
(`_workflows.evaluate`); the `ci` and `engine` roll-ups' own shell steps run under bash with the
results GitHub would give them.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest

from tools.lint.tests.acceptance.ts14c14 import _workflows as wf

HEAVY = (
    ("ci.yml", "python-checks"),
    ("ci.yml", "python"),
    ("engine.yml", "toolchain"),
    ("engine.yml", "check-sandbox"),
    ("web.yml", "web"),
    ("e2e.yml", "smoke"),
)
REQUIRED_JOBS = (("ci.yml", "ci"), ("web.yml", "web"), ("engine.yml", "engine"))
ROLL_UPS = (("ci.yml", "ci"), ("engine.yml", "engine"))
GATE = re.compile(r"scripts[./]factory[./]ci_gate\b")
PR_EVENTS = ("pull_request", "pull_request_target")
STEP_OUTPUT = re.compile(r"\bsteps\.([A-Za-z0-9_-]+)\.outputs\b")
NEEDS_OUTPUT = re.compile(r"\bneeds\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)")


@pytest.fixture(scope="module")
def files() -> dict[str, dict[str, Any]]:
    return wf.workflows()


def _pr_workflows(files: dict[str, dict[str, Any]]) -> list[str]:
    return [name for name, flow in files.items() if set(wf.triggers(flow)) & set(PR_EVENTS)]


def _text(value: Any) -> str:
    if isinstance(value, dict):
        return "\n".join(f"{key}: {_text(item)}" for key, item in value.items())
    if isinstance(value, list):
        return "\n".join(_text(item) for item in value)
    return "" if value is None else str(value)


def _carrier_steps(job: dict[str, Any]) -> set[str]:
    """The ids of the job's steps that run the gate or read a step that does (in order)."""
    carriers: set[str] = set()
    for step in job.get("steps") or []:
        body = _text({key: step.get(key) for key in ("run", "env", "with")})
        reads = set(STEP_OUTPUT.findall(body)) & carriers
        if GATE.search(body) or reads:
            carriers.add(str(step.get("id", f"<step {len(carriers)}>")))
    return carriers


def _carrier_outputs(job: dict[str, Any]) -> set[str]:
    """The job's outputs whose value comes from a step that carries the gate."""
    carriers = _carrier_steps(job)
    outputs = job.get("outputs") or {}
    return {
        str(key) for key, value in outputs.items() if set(STEP_OUTPUT.findall(str(value))) & carriers
    }


def _context(name: str, flow: dict[str, Any], job: dict[str, Any], gate_value: str) -> dict[str, Any]:
    """A pull_request run in which every job the heavy job needs succeeded, every output that carries
    the gate is `gate_value` and every other output (a path filter) is 'true'."""
    context = wf.pull_request_context(str(flow.get("name", name)), 41, "s99-widget", "a" * 40, 1001)
    jobs = wf.jobs(flow)
    context["needs"] = {
        need: {
            "result": "success",
            "outputs": {
                str(key): gate_value if key in _carrier_outputs(jobs[need]) else "true"
                for key in (jobs[need].get("outputs") or {})
            },
        }
        for need in wf.needs(job)
    }
    return context


# --------------------------------------------------------------- a second push cancels the first run


def _group(flow: dict[str, Any], context: dict[str, Any]) -> tuple[str, Any]:
    concurrency = flow.get("concurrency")
    assert concurrency is not None, "no workflow-level concurrency"
    if isinstance(concurrency, str):
        return str(wf.interpolate(concurrency, context)), False
    group = str(wf.interpolate(concurrency.get("group", ""), context))
    cancel = wf.interpolate(concurrency.get("cancel-in-progress", False), context)
    return group, cancel


def _push_of(
    flow: dict[str, Any], name: str, number: int, branch: str, sha: str, run: int
) -> dict[str, Any]:
    events = set(wf.triggers(flow)) & set(PR_EVENTS)
    context = wf.pull_request_context(str(flow.get("name", name)), number, branch, sha, run)
    if "pull_request" not in events:
        context["github"]["event_name"] = "pull_request_target"
        context["github"]["ref"] = "refs/heads/main"
    return context


def test_a_second_push_to_a_pr_cancels_the_first_run_of_every_pr_workflow(
    files: dict[str, dict[str, Any]],
) -> None:
    for name in _pr_workflows(files):
        flow = files[name]
        first, _ = _group(flow, _push_of(flow, name, 41, "s99-widget", "a" * 40, 1001))
        second, cancel = _group(flow, _push_of(flow, name, 41, "s99-widget", "c" * 40, 1002))
        assert first, f"{name}: an empty concurrency group"
        assert first == second, f"{name}: two pushes to one PR fall in groups {first!r}, {second!r}"
        assert wf.truthy(cancel), f"{name}: cancel-in-progress is {cancel!r} on a pull_request run"
        assert str(cancel).lower() != "false", f"{name}: cancel-in-progress is the string {cancel!r}"


def test_two_prs_never_cancel_each_other(files: dict[str, dict[str, Any]]) -> None:
    for name in _pr_workflows(files):
        flow = files[name]
        one, _ = _group(flow, _push_of(flow, name, 41, "s99-widget", "a" * 40, 1001))
        other, _ = _group(flow, _push_of(flow, name, 42, "s98-gadget", "d" * 40, 1003))
        assert one != other, f"{name}: PRs 41 and 42 share the concurrency group {one!r}"


def test_no_two_workflows_share_a_concurrency_group_on_one_pr(files: dict[str, dict[str, Any]]) -> None:
    groups: dict[str, str] = {}
    for name in _pr_workflows(files):
        flow = files[name]
        group, _ = _group(flow, _push_of(flow, name, 41, "s99-widget", "a" * 40, 1001))
        assert group not in groups, f"{name} and {groups[group]} share {group!r}: one cancels the other"
        groups[group] = name


# --------------------------------------------------------- a non-READY push starts no heavy workflow


def test_a_push_to_any_branch_but_main_starts_no_workflow_by_its_push(
    files: dict[str, dict[str, Any]],
) -> None:
    """A builder's push reaches CI only as its PR's pull_request run, which the READY gate guards."""
    for name, flow in files.items():
        triggers = wf.triggers(flow)
        if "push" not in triggers:
            continue
        settings = triggers["push"] or {}
        branches = settings.get("branches")
        assert branches is not None, f"{name}: push runs on every branch"
        assert {str(branch) for branch in branches} <= {"main"}, (
            f"{name}: push runs on branches {branches!r}, not main's alone"
        )
        assert "branches-ignore" not in settings, f"{name}: push {settings!r}"
        assert "tags" not in settings, f"{name}: push {settings!r}"


@pytest.mark.parametrize(("name", "job_id"), HEAVY, ids=[f"{n}:{j}" for n, j in HEAVY])
def test_a_heavy_job_runs_on_a_pr_only_when_the_ready_gate_says_ready(
    files: dict[str, dict[str, Any]], name: str, job_id: str
) -> None:
    flow = files[name]
    assert job_id in wf.jobs(flow), f"{name} has no job {job_id!r}"
    if not set(wf.triggers(flow)) & set(PR_EVENTS):
        return  # e2e.yml runs on main and nightly only: no PR push starts it
    job = wf.jobs(flow)[job_id]
    jobs = wf.jobs(flow)
    carried = {need: _carrier_outputs(jobs[need]) for need in wf.needs(job)}
    read = {(need, key) for need, key in NEEDS_OUTPUT.findall(str(job.get("if", "")))}
    gated = {(need, key) for need, keys in carried.items() for key in keys} & read
    assert gated, (
        f"{name}:{job_id} runs whatever the head says: its `if:` ({job.get('if')!r}) reads no output "
        "of a needed job fed by `python3 -m scripts.factory.ci_gate`"
    )
    assert wf.condition(job, _context(name, flow, job, "false")) is False, (
        f"{name}:{job_id} still runs on a pull_request whose head is not READY"
    )
    assert wf.condition(job, _context(name, flow, job, "true")) is True, (
        f"{name}:{job_id} does not run on a READY head whose paths concern it"
    )


def test_every_job_that_starts_a_database_service_is_a_gated_heavy_job(
    files: dict[str, dict[str, Any]],
) -> None:
    for name in _pr_workflows(files):
        for job_id, job in wf.jobs(files[name]).items():
            if job.get("services"):
                assert (name, job_id) in HEAVY, (
                    f"{name}:{job_id} starts a service but is not READY-gated"
                )


def test_the_ready_gate_runs_on_every_pr_run_in_a_light_job(files: dict[str, dict[str, Any]]) -> None:
    for name in sorted({n for n, _ in HEAVY} & set(_pr_workflows(files))):
        gates = [
            (job_id, job)
            for job_id, job in wf.jobs(files[name]).items()
            if any(GATE.search(_text(step.get("run"))) for step in job.get("steps") or [])
        ]
        assert gates, f"{name}: no job runs `python3 -m scripts.factory.ci_gate`"
        for job_id, job in gates:
            assert job.get("if") is None, f"{name}:{job_id} runs the gate only `if: {job.get('if')}`"
            assert not job.get("services"), f"{name}:{job_id} runs the gate beside a service"
            assert (name, job_id) not in HEAVY, f"{name}:{job_id} is a heavy job"


# ----------------------------------------------------------------- `ci` still reports on a docs-only PR


@pytest.mark.parametrize(("name", "job_id"), REQUIRED_JOBS, ids=[f"{n}:{j}" for n, j in REQUIRED_JOBS])
def test_the_required_check_names_are_unchanged(
    files: dict[str, dict[str, Any]], name: str, job_id: str
) -> None:
    jobs = wf.jobs(files[name])
    assert job_id in jobs, (
        f"{name} has no job {job_id!r}: the required check {job_id!r} would never report"
    )
    assert jobs[job_id].get("name") in (None, job_id), (
        f"{name}:{job_id} is named {jobs[job_id]['name']!r}"
    )
    assert "strategy" not in jobs[job_id], f"{name}:{job_id} is a matrix: its check names would change"


def test_the_not_applicable_statuses_still_post_on_every_pr_push(
    files: dict[str, dict[str, Any]],
) -> None:
    flow = files["real-drawings-na.yml"]
    target = wf.triggers(flow).get("pull_request_target") or {}
    assert {"opened", "synchronize", "reopened"} <= set(target.get("types") or ())
    text = (wf.WORKFLOWS / "real-drawings-na.yml").read_text()
    assert "real-drawings" in text
    assert "design-gate" in text
    assert not GATE.search(text), "the not-applicable statuses must not wait for READY"


@pytest.mark.parametrize("name", ["ci.yml", "web.yml", "engine.yml"])
def test_a_required_workflow_has_no_workflow_level_path_filter(
    files: dict[str, dict[str, Any]], name: str
) -> None:
    triggers = wf.triggers(files[name])
    assert "pull_request" in triggers, f"{name} no longer runs on pull_request"
    for event in ("pull_request", "push"):
        settings = triggers.get(event) or {}
        assert not ({"paths", "paths-ignore"} & set(settings)), (
            f"{name}: `{event}` filters by path at the workflow level; a skipped workflow leaves the "
            "required check pending"
        )
    types = (triggers["pull_request"] or {}).get("types")
    assert types is None or {"opened", "synchronize", "reopened"} <= set(types), (
        f"{name}: types {types!r}"
    )


def _roll_up(name: str, job_id: str, results: dict[str, str], tmp_path: Path) -> tuple[bool, int]:
    """(whether the roll-up job runs, its steps' exit) for these results of its needs."""
    flow = wf.load(wf.WORKFLOWS / name)
    job = wf.jobs(flow)[job_id]
    context = wf.pull_request_context(str(flow.get("name", name)), 41, "s99-widget", "a" * 40, 1001)
    context["needs"] = {need: {"result": results[need], "outputs": {}} for need in wf.needs(job)}
    worst = (
        "failure"
        if "failure" in results.values()
        else ("cancelled" if "cancelled" in results.values() else "success")
    )
    context["__status__"] = worst
    runs = wf.condition(job, context)
    bash = shutil.which("bash")
    assert bash, "bash is not on PATH"
    for at, step in enumerate(job.get("steps") or []):
        assert "uses" not in step, (
            f"{name}:{job_id} step {at} uses an action: its verdict is not its needs'"
        )
        env = {
            key: str(wf.interpolate(value, context)) for key, value in (step.get("env") or {}).items()
        }
        script = tmp_path / f"{job_id}-{at}.sh"
        script.write_text(str(wf.interpolate(step.get("run", ""), context)))
        done = subprocess.run(
            [bash, "--noprofile", "--norc", "-e", "-o", "pipefail", str(script)],
            env={"PATH": "/usr/bin:/bin", **env},
            capture_output=True,
            text=True,
            check=False,
        )
        if done.returncode != 0:
            return runs, done.returncode
    return runs, 0


def _results(name: str, job_id: str, heavy: str) -> dict[str, str]:
    job = wf.jobs(wf.load(wf.WORKFLOWS / name))[job_id]
    return {need: heavy if (name, need) in HEAVY else "success" for need in wf.needs(job)}


@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS, ids=[f"{n}:{j}" for n, j in ROLL_UPS])
def test_a_roll_up_check_passes_when_its_heavy_jobs_were_skipped(
    name: str, job_id: str, tmp_path: Path
) -> None:
    """A docs-only PR (no path concerns the heavy jobs) or a head that is not READY: they are skipped."""
    needs = _results(name, job_id, "skipped")
    assert any((name, need) in HEAVY for need in needs), (
        f"{name}:{job_id} no longer needs its heavy jobs"
    )
    runs, exit_code = _roll_up(name, job_id, needs, tmp_path)
    assert runs, (
        f"{name}:{job_id} does not run when its heavy jobs were skipped: the check stays pending"
    )
    assert exit_code == 0, f"{name}:{job_id} fails when its heavy jobs were skipped (exit {exit_code})"


@pytest.mark.parametrize("outcome", ["failure", "cancelled"])
@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS, ids=[f"{n}:{j}" for n, j in ROLL_UPS])
def test_a_roll_up_check_reports_failure_when_a_heavy_job_did_not_pass(
    name: str, job_id: str, outcome: str, tmp_path: Path
) -> None:
    runs, exit_code = _roll_up(name, job_id, _results(name, job_id, outcome), tmp_path)
    assert runs, f"{name}:{job_id} does not run when a heavy job was {outcome}: the check stays pending"
    assert exit_code != 0, f"{name}:{job_id} passes although a heavy job was {outcome}"
