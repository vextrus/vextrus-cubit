"""S29-F1 (session 29, CI speed; docs/plans/factory-s29.md item 1): "shards rebalanced on measured step
times". The `ci` wall on main, median, is 10.4 min against a target of 6 min or less; S28-C1 made the
shards' collected ids disjoint and complete but did not move the wall. Measured on main (runs
38616022347, 38593466408, 38585803129): the python shards' test steps take 85 s (`rest`) to 537 s
(`takeoff-acceptance`), each job pays about a minute before its tests and starts about half a minute in,
so the slowest shard is the critical path (8.2 to 10.8 min).

The seam, pinned here (its names are this ticket's, not the plan's):

- `.github/ci-timings.json`: `{"version": 1, "files": {"<repository path of a test file>": <seconds>}}`,
  each file's tests' seconds summed as CI's JUnit report gives them (tools.lint.slow_files reads it so).
- `python -m tools.lint.ci_shards balance [root]`, run from the repository, reading `<root>`'s shard
  file, timing file and test files: each shard's predicted seconds are the timings of the files it owns
  (its paths, less its ignores, as `ci_shards` already reads them), a file marked `pytest.mark.serial`
  counting in full and every other file divided by the 4 workers each shard runs with (S17-F1). A shard
  predicted over 270 s is a problem naming it; so is a timing for a file that does not exist (a stale
  plan). One line per problem, exit 1 if any, 0 if none; a missing or unreadable timing file is exit 1
  (fails closed). A file the timing file does not name counts 0 (slow_files warns at run time).
- `ci.yml`'s harness job runs it, so the plan cannot drift out of balance unseen.

The bound: 6 min, less about 0.5 min before a shard starts and about 1 min of set-up in it, leaves 270 s.
Problem wording is the builder's; only exit codes, shard names and paths are asserted.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
CI = ROOT / ".github" / "workflows" / "ci.yml"
SHARDS = ROOT / ".github" / "ci-shards.json"
TIMINGS = ROOT / ".github" / "ci-timings.json"
BOUND = 270.0
WORKERS = 4
SEAM = "tools.lint.ci_shards balance"
SCRUB = ("PYTEST_ADDOPTS", "PYTEST_XDIST_WORKER", "PYTEST_XDIST_WORKER_COUNT", "PYTEST_CURRENT_TEST")
SERIAL = re.compile(r"pytest\.mark\.serial\b")

# Files CI measured over 100 s (JUnit seconds summed, run 38616022347, main 1474ed4d0): a timing file
# that is measured names each, and none of them near zero.
MEASURED = {
    "vextrus/takeoff/tests/test_read_never_waits.py": 422.59,
    "vextrus/takeoff/tests/test_step1_whole.py": 290.48,
    "vextrus/takeoff/tests/test_step1_correct.py": 105.74,
    "scripts/tests/acceptance/ts26fx4/test_delta_review.py": 157.88,
    "scripts/tests/acceptance/ts14b1/test_crosspr.py": 142.15,
    "scripts/tests/acceptance/ts14f2/test_guard_remote_leak.py": 104.40,
    "scripts/tests/test_crosspr_round6.py": 102.34,
    "vextrus/takeoff/tests/acceptance/tw319/test_act_cost_is_flat.py": 149.16,
    "vextrus/takeoff/tests/acceptance/tw319/test_answer_cost_is_flat.py": 144.03,
}
FLOOR = 30.0
# The six shards' test steps on that run took 1681 s at 4 workers, 6724 worker-seconds; the 120 files
# their slow-file reports name alone sum to 4296 s. A timing file of the suite sums to 4000 s or more.
TOTAL_FLOOR = 4000.0


def _balance(root: Path) -> subprocess.CompletedProcess[str]:
    env = {key: value for key, value in os.environ.items() if key not in SCRUB}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.ci_shards", "balance", str(root)],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _said(result: subprocess.CompletedProcess[str]) -> str:
    return f"{SEAM} exited {result.returncode}: {result.stdout}{result.stderr}"


def _root(
    tmp_path: Path,
    shards: list[dict[str, object]],
    timings: dict[str, float] | None,
    files: list[str],
    serial: tuple[str, ...] = (),
) -> Path:
    """A synthetic repository: a pyproject whose testpaths are the files' top folders, one test per file
    (marked serial when named so), the shard file and, unless None, the timing file."""
    root = tmp_path / "repo"
    (root / ".github").mkdir(parents=True)
    tops = sorted({file.split("/", 1)[0] for file in files})
    (root / "pyproject.toml").write_text(
        "[tool.pytest.ini_options]\n"
        f"testpaths = [{', '.join(json.dumps(top) for top in tops)}]\n"
        'addopts = ["-p", "no:django", "-p", "no:cacheprovider"]\n'
    )
    for file in files:
        path = root / file
        path.parent.mkdir(parents=True, exist_ok=True)
        head = "import pytest\n\npytestmark = pytest.mark.serial\n\n\n" if file in serial else ""
        path.write_text(f"{head}def test_{path.stem.removeprefix('test_')}():\n    pass\n")
    shard_list = [{"paths": [], "ignore": [], **shard} for shard in shards]
    (root / ".github" / "ci-shards.json").write_text(
        json.dumps({"version": 1, "shards": shard_list}, indent=1) + "\n"
    )
    if timings is not None:
        (root / ".github" / "ci-timings.json").write_text(
            json.dumps({"version": 1, "files": timings}, indent=1) + "\n"
        )
    return root


def _naming(result: subprocess.CompletedProcess[str], word: str) -> list[str]:
    return [line for line in (result.stdout + result.stderr).splitlines() if word in line]


# --- the check, on synthetic roots ------------------------------------------------------------------

TWO = ["alpha/test_alpha.py", "beta/test_beta.py"]
LIGHT_HEAVY = [{"name": "light-shard", "paths": ["alpha"]}, {"name": "heavy-shard", "paths": ["beta"]}]


def test_shards_each_predicted_under_270_seconds_pass(tmp_path: Path) -> None:
    timings = {"alpha/test_alpha.py": 800.0, "beta/test_beta.py": 1000.0}  # 200 s and 250 s
    result = _balance(_root(tmp_path, LIGHT_HEAVY, timings, TWO))
    assert result.returncode == 0, _said(result)


def test_a_shard_predicted_over_270_seconds_fails_naming_it_and_only_it(tmp_path: Path) -> None:
    timings = {"alpha/test_alpha.py": 800.0, "beta/test_beta.py": 1200.0}  # 200 s and 300 s
    result = _balance(_root(tmp_path, LIGHT_HEAVY, timings, TWO))
    assert result.returncode == 1, _said(result)
    assert _naming(result, "heavy-shard"), _said(result)
    assert not _naming(result, "light-shard"), _said(result)


def test_the_bound_is_270_seconds_at_four_workers(tmp_path: Path) -> None:
    at_bound = {"alpha/test_alpha.py": 100.0, "beta/test_beta.py": 270.0 * WORKERS}
    passed = _balance(_root(tmp_path / "at", LIGHT_HEAVY, at_bound, TWO))
    assert passed.returncode == 0, _said(passed)

    over = {"alpha/test_alpha.py": 100.0, "beta/test_beta.py": 271.0 * WORKERS}
    failed = _balance(_root(tmp_path / "over", LIGHT_HEAVY, over, TWO))
    assert failed.returncode == 1, _said(failed)
    assert _naming(failed, "heavy-shard"), _said(failed)


def test_a_file_counts_only_for_the_shard_that_owns_it_folder_ignores_and_file_paths_alike(
    tmp_path: Path,
) -> None:
    files = ["alpha/test_alpha.py", "alpha/inner/test_inner.py", "alpha/test_split.py"]
    shards = [
        {"name": "outer-shard", "paths": ["alpha"], "ignore": ["alpha/inner", "alpha/test_split.py"]},
        {"name": "inner-shard", "paths": ["alpha/inner"]},
        {"name": "split-shard", "paths": ["alpha/test_split.py"]},
    ]
    # Owned alone, each shard is 250 s or less; were an ignore or a file path not honoured, outer-shard
    # would count 1000 + 1000 + 400 seconds, 600 s.
    timings = {
        "alpha/test_alpha.py": 400.0,
        "alpha/inner/test_inner.py": 1000.0,
        "alpha/test_split.py": 1000.0,
    }
    result = _balance(_root(tmp_path, shards, timings, files))
    assert result.returncode == 0, _said(result)


def test_a_serial_file_counts_in_full_not_divided_by_the_workers(tmp_path: Path) -> None:
    shards = [{"name": "serial-shard", "paths": ["alpha"]}, {"name": "other-shard", "paths": ["beta"]}]
    timings = {"alpha/test_alpha.py": 300.0, "beta/test_beta.py": 40.0}

    unmarked = _balance(_root(tmp_path / "unmarked", shards, timings, TWO))
    assert unmarked.returncode == 0, _said(unmarked)  # 75 s

    marked = _balance(_root(tmp_path / "marked", shards, timings, TWO, serial=("alpha/test_alpha.py",)))
    assert marked.returncode == 1, _said(marked)  # 300 s in full
    assert _naming(marked, "serial-shard"), _said(marked)
    assert not _naming(marked, "other-shard"), _said(marked)


def test_a_timing_for_a_file_that_does_not_exist_is_a_problem_naming_it(tmp_path: Path) -> None:
    timings = {"alpha/test_alpha.py": 10.0, "beta/test_beta.py": 10.0, "alpha/test_gone_away.py": 10.0}
    result = _balance(_root(tmp_path, LIGHT_HEAVY, timings, TWO))
    assert result.returncode == 1, _said(result)
    assert _naming(result, "alpha/test_gone_away.py"), _said(result)


def test_a_missing_timing_file_fails_closed(tmp_path: Path) -> None:
    result = _balance(_root(tmp_path, LIGHT_HEAVY, None, TWO))
    assert result.returncode == 1, _said(result)
    assert result.stdout.strip() or result.stderr.strip(), "a failure names its problem"


# --- the repository ---------------------------------------------------------------------------------


def _committed_timings() -> dict[str, float]:
    assert TIMINGS.is_file(), f"no committed timing file {TIMINGS.relative_to(ROOT)}"
    data = json.loads(TIMINGS.read_text())
    files = data.get("files") if isinstance(data, dict) else None
    assert isinstance(files, dict), "the timing file has no files object"
    assert files, "the timing file names no file"
    return {str(path): float(seconds) for path, seconds in files.items()}


def _under(path: str, root: str) -> bool:
    root = root.rstrip("/")
    return path == root or path.startswith(f"{root}/")


def test_the_committed_plan_predicts_every_shard_at_270_seconds_or_less() -> None:
    timings = _committed_timings()
    shards = json.loads(SHARDS.read_text())["shards"]
    predicted: dict[str, float] = {}
    for shard in shards:
        paths, ignore = shard.get("paths", []), shard.get("ignore", [])
        total = 0.0
        for file, seconds in timings.items():
            inside = not paths or any(_under(file, path) for path in paths)
            if not inside or any(_under(file, path) for path in ignore):
                continue
            serial = (ROOT / file).is_file() and SERIAL.search((ROOT / file).read_text(errors="replace"))
            total += seconds if serial else seconds / WORKERS
        predicted[shard["name"]] = round(total, 1)
    over = {name: seconds for name, seconds in predicted.items() if seconds > BOUND}
    assert not over, f"shards predicted over {BOUND:.0f} s: {over} (all: {predicted})"

    result = _balance(ROOT)
    assert result.returncode == 0, _said(result)


def test_the_committed_timings_are_measured_ones() -> None:
    timings = _committed_timings()
    missing = sorted(file for file in MEASURED if file not in timings)
    assert not missing, f"files CI measured over 100 s the timing file does not name: {missing}"
    low = {file: timings[file] for file in MEASURED if timings[file] < FLOOR}
    assert not low, f"files CI measured over 100 s, committed under {FLOOR:.0f} s: {low}"
    total = sum(timings.values())
    assert total >= TOTAL_FLOOR, f"the timing file sums to {total:.0f} s, under {TOTAL_FLOOR:.0f} s"
    stale = sorted(file for file in timings if not (ROOT / file).is_file())
    assert not stale, f"timings for files that do not exist: {stale[:10]}"


def test_the_harness_job_runs_the_balance_check() -> None:
    from tools.lint.ci_shards import jobs

    harness = jobs(CI.read_text()).get("harness", [])
    assert harness, "ci.yml has no harness job"
    assert any("tools.lint.ci_shards balance" in line for line in harness), (
        "ci.yml's harness job does not run python3 -m tools.lint.ci_shards balance"
    )
