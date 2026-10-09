"""S18-T616 (issue #616): local verify plans the toolchain's tests for an engine change.

Local verify skipped `needs_toolchain` tests (pyproject's addopts deselect them), so an engine PR reached
READY and then failed CI's engine toolchain job on its own acceptance tests. CI's toolchain job
(`.github/workflows/engine.yml`, "The toolchain's and the sandbox's tests") selects them with

    uv run --no-sync pytest -p tools.lint.acceptance_pytest -m "needs_toolchain or needs_bwrap"

Pinned at the plan boundary: `scripts.verify.plan_with_notes(paths, *, have=..., root=...)` returns the
checks (`Check.argv`) and the notes for the checks left out. Whether the toolchain is present is asked
through the existing `have` seam: these tests answer every question yes (present) or no (absent), and
name no tool. The run is found by its argv (`-m` followed by the marker expression), never by its name.

    uv run pytest -rf scripts/tests/acceptance/ts18t616
"""

from pathlib import Path

import pytest

from scripts.verify import Check, plan_with_notes

MARKS = "needs_toolchain or needs_bwrap"
PLUGIN = "tools.lint.acceptance_pytest"

# Any engine/** change: a module's code, the module's own acceptance test (the case of #613), and a
# file that is not Python (the fixture writer's C#).
ENGINE_CHANGES = {
    "code": "engine/read/dwg.py",
    "acceptance-test": "engine/render/tests/acceptance/t99/test_the_promise.py",
    "not-python": "engine/fixtures/dwg/_writer/Program.cs",
}


def present(tool: str) -> bool:
    return True


def absent(tool: str) -> bool:
    return False


def toolchain_runs(checks: list[Check]) -> list[Check]:
    """The planned pytest runs that select by the toolchain's marks."""
    return [
        check
        for check in checks
        if any(
            token == "-m" and index + 1 < len(check.argv) and "needs_toolchain" in check.argv[index + 1]
            for index, token in enumerate(check.argv)
        )
    ]


def the_toolchain_run(checks: list[Check]) -> Check:
    runs = toolchain_runs(checks)
    assert len(runs) == 1, f"no single toolchain run planned: {[check.argv for check in checks]}"
    return runs[0]


def option_value(argv: tuple[str, ...], option: str) -> list[str]:
    return [argv[index + 1] for index, token in enumerate(argv[:-1]) if token == option]


def path_arguments(argv: tuple[str, ...]) -> list[str]:
    """The run's folder or file arguments: tokens that are not options and name a repo path."""
    valued = {"-m", "-p", "-n", "-k", "--ignore", "--junitxml", "-c", "--rootdir"}
    found = []
    for index, token in enumerate(argv):
        if token.startswith("-") or (index > 0 and argv[index - 1] in valued):
            continue
        if token == "." or "/" in token:
            found.append(token)
    return found


def covers(folder: str, path: str) -> bool:
    folder = folder.rstrip("/")
    return folder in (".", "") or path == folder or path.startswith(folder + "/")


@pytest.mark.parametrize("path", ENGINE_CHANGES.values(), ids=ENGINE_CHANGES.keys())
def test_an_engine_change_with_the_toolchain_present_plans_cis_toolchain_selection(
    path: str, tmp_path: Path
) -> None:
    checks, _ = plan_with_notes([path], have=present, root=tmp_path)
    run = the_toolchain_run(checks)
    assert "pytest" in run.argv, run.argv
    assert option_value(run.argv, "-m") == [MARKS], run.argv
    assert PLUGIN in option_value(run.argv, "-p"), run.argv


@pytest.mark.parametrize("path", ENGINE_CHANGES.values(), ids=ENGINE_CHANGES.keys())
def test_the_toolchain_run_selects_the_changed_engine_paths_tests(path: str, tmp_path: Path) -> None:
    checks, _ = plan_with_notes([path], have=present, root=tmp_path)
    run = the_toolchain_run(checks)
    folders = path_arguments(run.argv)
    # The whole suite (no folder, as CI runs it) or folders that include the changed path.
    assert not folders or any(covers(folder, path) for folder in folders), run.argv


def test_without_the_toolchain_no_toolchain_run_is_planned_and_a_note_says_so(tmp_path: Path) -> None:
    checks, notes = plan_with_notes([ENGINE_CHANGES["code"]], have=absent, root=tmp_path)
    assert toolchain_runs(checks) == [], [check.argv for check in checks]
    assert any("toolchain" in note for note in notes), f"no note names the toolchain: {notes}"


def test_a_change_with_no_engine_path_plans_no_toolchain_run(tmp_path: Path) -> None:
    paths = ["docs/intent.md", "web/src/main.tsx", "scripts/verify.py", ".claude/hooks/guard.mjs"]
    checks, _ = plan_with_notes(paths, have=present, root=tmp_path)
    assert toolchain_runs(checks) == [], [check.argv for check in checks]
