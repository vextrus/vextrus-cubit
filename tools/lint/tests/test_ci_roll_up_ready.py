"""The `ci` and `engine` roll-ups never pass a head that is not READY when its changes need a heavy job.

On a head that is not READY the heavy jobs are skipped, which GitHub counts as passing; so the light
job's `ready` output makes the roll-up fail instead, with a message that says what to push. One rule:
a roll-up fails when a heavy job its paths need was skipped for want of READY (the `changes` path
outputs say what is needed), and passes when none was needed or every needed one ran and passed. A head
whose changes need no heavy job (a brief, an ADR, a docs edit) passes whatever its trailer says. `ci`
also answers for the web: web.yml's `web` check is itself the skipped heavy job (the acceptance tests
pin `web` as a gated job, so it cannot be a roll-up), so `ci` carries the web's paths. The roll-up
steps run under bash with the results GitHub would give them (the reader is the acceptance tests' own).
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

from tools.lint.tests.acceptance.ts14c14 import _workflows as wf

ROLL_UPS = (("ci.yml", "ci"), ("engine.yml", "engine"))
HEAVY = {"python-checks", "python", "toolchain", "check-sandbox"}
NO_PATHS = {"python": "false", "web": "false", "engine": "false", "check": "false"}
PATHS = {
    "docs only": NO_PATHS,
    "python only": NO_PATHS | {"python": "true"},
    "web only": NO_PATHS | {"web": "true"},
    "engine only": NO_PATHS | {"engine": "true"},
    "sandbox check only": NO_PATHS | {"check": "true"},
}
# Which roll-up answers for which change: `ci` for the backend and the web, `engine` for the engine.
FAILS = {
    "docs only": set(),
    "python only": {"ci"},
    "web only": {"ci"},
    "engine only": {"engine"},
    "sandbox check only": {"engine"},
}


def _run(
    name: str,
    job_id: str,
    ready: str,
    heavy: str,
    tmp_path: Path,
    paths: dict[str, str],
) -> subprocess.CompletedProcess[str]:
    flow = wf.load(wf.WORKFLOWS / name)
    job = wf.jobs(flow)[job_id]
    context = wf.pull_request_context(str(flow.get("name", name)), 41, "s99-widget", "a" * 40, 1001)
    context["needs"] = {
        need: {
            "result": heavy if need in HEAVY else "success",
            "outputs": {"ready": ready} | paths if need == "changes" else {},
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


@pytest.mark.parametrize("change", PATHS)
@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_head_without_the_trailer_fails_only_the_check_its_changes_need(
    name: str, job_id: str, change: str, tmp_path: Path
) -> None:
    done = _run(name, job_id, "false", "skipped", tmp_path, PATHS[change])
    if job_id in FAILS[change]:
        assert done.returncode != 0, f"{job_id} passes a {change} head with no trailer"
        assert "head is not Factory-State: READY" in done.stdout
    else:
        assert done.returncode == 0, f"{job_id} fails a {change} head with no trailer:\n{done.stdout}"


@pytest.mark.parametrize("change", PATHS)
@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_ready_head_whose_heavy_jobs_ran_or_were_not_concerned_succeeds(
    name: str, job_id: str, change: str, tmp_path: Path
) -> None:
    assert _run(name, job_id, "true", "success", tmp_path, PATHS[change]).returncode == 0
    assert _run(name, job_id, "true", "skipped", tmp_path, PATHS[change]).returncode == 0


@pytest.mark.parametrize("outcome", ["failure", "cancelled"])
@pytest.mark.parametrize(("name", "job_id"), ROLL_UPS)
def test_a_ready_head_with_a_heavy_job_that_did_not_pass_still_fails(
    name: str, job_id: str, outcome: str, tmp_path: Path
) -> None:
    done = _run(name, job_id, "true", outcome, tmp_path, PATHS["python only"])
    assert done.returncode != 0


@pytest.mark.parametrize("name", ["ci.yml", "engine.yml"])
def test_a_ready_head_that_changes_code_runs_the_heavy_jobs(name: str) -> None:
    flow = wf.load(wf.WORKFLOWS / name)
    heavy = [job for job_id, job in wf.jobs(flow).items() if job_id in HEAVY]
    assert heavy
    outputs = {"ready": "true"} | dict.fromkeys(("python", "web", "engine", "check"), "true")
    for job in heavy:
        context = wf.pull_request_context(str(flow.get("name", name)), 41, "s99-widget", "a" * 40, 1001)
        context["needs"] = {need: {"result": "success", "outputs": outputs} for need in wf.needs(job)}
        assert wf.condition(job, context) is True


def test_ci_reads_the_same_web_paths_as_web_yml() -> None:
    pattern = re.compile(r"grep -E '(\^\(web/[^']*)'")
    found = [pattern.findall((wf.WORKFLOWS / name).read_text()) for name in ("ci.yml", "web.yml")]
    assert found[0] == found[1] != [], found
