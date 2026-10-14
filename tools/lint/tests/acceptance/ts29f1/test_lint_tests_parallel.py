"""S29-F1 (docs/plans/factory-s29.md item 1): "`tools/lint/tests` in parallel". On main, `ci.yml`'s
`rest-engine-lint` shard runs `tools/lint/tests` in a pytest of its own with no `-n` ("serial (no -n
until issue 585 is fixed)"): 173 to 301 s of the shard's wall. Issue #585 is closed (fixed by #614),
so the run holding `tools/lint/tests` carries the 4 workers every other shard's test run carries
(S17-F1).

What a shard runs is read as S17-F1's acceptance tests read it (their readers are imported, not
re-written): the python job's steps per shard, `$(python3 -m tools.lint.ci_shards args "$SHARD")`
expanded. The required checks keep their names: `ci`, `web` and `engine` are the jobs that roll each
workflow up, run whatever came before (`if: always()`), and `ci` still needs the shards' test job.
"""

from tools.lint.ci_shards import jobs, needs
from tools.lint.tests.acceptance.ts17f1.test_ci_parallel import (
    LINT_TESTS,
    ROOT,
    holds_lint_tests,
    shard_names,
    shard_runs,
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


def test_the_required_checks_keep_their_names_and_roll_up_their_workflow() -> None:
    for workflow, check in (("ci.yml", "ci"), ("web.yml", "web"), ("engine.yml", "engine")):
        every = jobs((ROOT / ".github" / "workflows" / workflow).read_text())
        assert check in every, f"{workflow} has no {check!r} job"
        assert needs(every[check]), f"{workflow}: the {check!r} job needs no job"
        assert any(line.strip().startswith("if: always()") for line in every[check]), (
            f"{workflow}: the {check!r} job does not run if: always()..."
        )
    assert "python" in needs(jobs((ROOT / ".github" / "workflows" / "ci.yml").read_text())["ci"])
