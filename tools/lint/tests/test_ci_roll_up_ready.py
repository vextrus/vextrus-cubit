"""The `ci` and `engine` roll-ups never pass a head that is not READY (issue #466).

On such a head the heavy jobs are skipped, which the roll-ups count as passing; so the light job's
`ready` output makes them fail instead, with a message that says what to push, when the PR's changes
need a heavy job (the `changes` path outputs). A head whose changes need none (a brief, an ADR, a
docs edit) passes whatever its trailer says. The roll-up steps run under bash with the results GitHub
would give them (the reader is the acceptance tests' own).
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from tools.lint.tests.acceptance.ts14c14 import _workflows as wf

ROLL_UPS = (("ci.yml", "ci"), ("engine.yml", "engine"))
HEAVY = {"python-checks", "python", "toolchain", "check-sandbox"}


def _run(
    name: str, job_id: str, ready: str, heavy: str, tmp_path: Path, paths: str = "true"
) -> subprocess.CompletedProcess[str]:
    flow = wf.load(wf.WORKFLOWS / name)
    job = wf.jobs(flow)[job_id]
    context = wf.pull_request_context(str(flow.get("name", name)), 41, "s99-widget", "a" * 40, 1001)
    context["needs"] = {
        need: {
            "result": heavy if need in HEAVY else "success",
            "outputs": (
                {"ready": ready, "python": paths, "engine": paths, "check": paths}
                if need == "changes"
                else {}
            ),
        }
        for need in wf.needs(job)
    }
    (step,) = job["steps"]
    env = {key: str(wf.interpolate(value, context)) for key, value in (step.get("env") or {}).items()}
    script = tmp_path / f"{job_id}.sh"
    script.write_text(str(wf.interpolate(step["run"], context)))
    bash = shutil.which("bash")
    assert bash
    return subprocess.run(
        [bash, "--noprofile", "--norc", "-e", "-o", "pipefail", str(script)],
        env={"PATH": "/usr/bin:/bin", **env},
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_not_ready_head_concludes_failure_with_the_reason(
    name: str, job_id: str, tmp_path: Path
) -> None:
    done = _run(name, job_id, "false", "skipped", tmp_path)
    assert done.returncode != 0
    assert "head is not Factory-State: READY" in done.stdout


@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_ready_head_whose_heavy_jobs_ran_or_were_not_concerned_succeeds(
    name: str, job_id: str, tmp_path: Path
) -> None:
    assert _run(name, job_id, "true", "success", tmp_path).returncode == 0
    assert _run(name, job_id, "true", "skipped", tmp_path).returncode == 0


@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_ready_head_with_a_failed_heavy_job_still_fails(
    name: str, job_id: str, tmp_path: Path
) -> None:
    assert _run(name, job_id, "true", "failure", tmp_path).returncode != 0


@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_not_ready_head_whose_changes_need_no_heavy_job_still_passes(
    name: str, job_id: str, tmp_path: Path
) -> None:
    """A docs-only PR (no path concerns a heavy job) with no trailer: its light checks still run."""
    done = _run(name, job_id, "false", "skipped", tmp_path, paths="false")
    assert done.returncode == 0, done.stdout


@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_ready_head_that_changes_code_runs_the_heavy_jobs(name: str, job_id: str) -> None:
    flow = wf.load(wf.WORKFLOWS / name)
    heavy = [job for job_id_, job in wf.jobs(flow).items() if job_id_ in HEAVY]
    assert heavy
    for job in heavy:
        context = wf.pull_request_context(str(flow.get("name", name)), 41, "s99-widget", "a" * 40, 1001)
        context["needs"] = {
            need: {
                "result": "success",
                "outputs": {"ready": "true", "python": "true", "engine": "true", "check": "true"},
            }
            for need in wf.needs(job)
        }
        assert wf.condition(job, context) is True
