"""S29-F1 (docs/plans/factory-s29.md item 1): "`tools/lint/tests` in parallel". On main, `ci.yml`'s
`rest-engine-lint` shard runs `tools/lint/tests` in a pytest of its own with no `-n` ("serial (no -n
until issue 585 is fixed)"): 173 to 301 s of the shard's wall. Issue #585 is closed (fixed by #614),
so the run holding `tools/lint/tests` carries the 4 workers every other shard's test run carries.

S17-F1's acceptance tests (ts17f1) pinned six shards, the three beside `rest` running what they ran,
and no `-n` on `tools/lint/tests`; this plan item supersedes those, so that file is withdrawn and its
other promises are carried here unchanged: every other shard's test run carries `-n 4`, the engine's
toolchain job `-n 3`, and no workflow asks for `-n auto`. Its readers are carried in `_ci_reader`.

The required checks keep their names: `ci`, `web` and `engine` are the jobs that roll each workflow
up, run whatever came before (`if: always()`), and `ci` still needs the shards' test job.
"""

import re

from tools.lint.ci_shards import jobs, needs
from tools.lint.tests.acceptance.ts29f1._ci_reader import (
    ENGINE,
    LINT_TESTS,
    N_AUTO,
    ROOT,
    TOOLCHAIN_JOB,
    WORKFLOWS,
    holds_lint_tests,
    invocations,
    job_lines,
    shard_names,
    shard_runs,
    shard_test_runs,
    steps,
)


def test_every_run_holding_tools_lint_tests_carries_four_workers() -> None:
    holding = [
        (shard, run) for shard in shard_names() for run in shard_runs(shard) if holds_lint_tests(run)
    ]
    assert holding, f"no shard runs {LINT_TESTS}"
    for shard, run in holding:
        assert run.workers() == ["4"], (
            f"shard {shard!r}: pytest {' '.join(run.argv)} runs {LINT_TESTS} with -n"
            f" {run.workers() or 'none'}, not -n 4 (#585 is closed)"
        )


def test_every_other_shards_test_run_carries_four_workers() -> None:
    checked = 0
    for shard in shard_names():
        for run in shard_test_runs(shard):
            if holds_lint_tests(run):
                continue
            checked += 1
            workers = run.workers()
            assert workers == ["4"], (
                f"shard {shard!r}: pytest {' '.join(run.argv)} carries -n {workers or 'none'}, not -n 4"
            )
    assert checked, "no shard's test run was found in the python job"


def test_the_engine_toolchain_job_runs_pytest_with_n_3() -> None:
    job = job_lines((ROOT / ENGINE).read_text(), TOOLCHAIN_JOB)
    runs = [run for item in steps(job) for run in invocations(item.run)]
    assert runs, f"{ENGINE}: the {TOOLCHAIN_JOB} job runs no pytest"
    for run in runs:
        workers = run.workers()
        assert workers == ["3"], (
            f"{ENGINE} {TOOLCHAIN_JOB}: pytest {' '.join(run.argv)} carries -n"
            f" {workers or 'none'}, not -n 3"
        )


def test_no_workflow_asks_for_n_auto() -> None:
    files = sorted([*(ROOT / WORKFLOWS).glob("*.yml"), *(ROOT / WORKFLOWS).glob("*.yaml")])
    assert files
    for path in files:
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            code = "" if line.lstrip().startswith("#") else re.sub(r"\s#\s.*$", "", line)
            assert not N_AUTO.search(code), f"{path.relative_to(ROOT)}:{number}: {line.strip()}"


def test_the_required_checks_keep_their_names_and_roll_up_their_workflow() -> None:
    for workflow, check in (("ci.yml", "ci"), ("web.yml", "web"), ("engine.yml", "engine")):
        every = jobs((ROOT / ".github" / "workflows" / workflow).read_text())
        assert check in every, f"{workflow} has no {check!r} job"
        assert needs(every[check]), f"{workflow}: the {check!r} job needs no job"
        assert any(line.strip().startswith("if: always()") for line in every[check]), (
            f"{workflow}: the {check!r} job does not run if: always()..."
        )
    assert "python" in needs(jobs((ROOT / ".github" / "workflows" / "ci.yml").read_text())["ci"])
