"""S28-C1 part 1 (issue #864): each test is collected by exactly one CI shard, proven on what pytest
collects, not on what the shard file appears to say.

Issue #864: "`.github/ci-shards.json` gives shard `rest` an ignore list that includes `scripts`, `engine`
and `tools/lint`, yet CI run 38526912157 (job `python (rest)`) ran 7503 tests in 697 s, and its slowest
files are ... the same files `rest-scripts` and `rest-engine-lint` run." The cause: pytest honours
`--ignore=<dir>` only for what it finds inside a collection argument, never for an argument itself, and
`rest` has no paths, so its arguments are the `testpaths` (`engine`, `scripts`, ...) and their ignores
are dead. The file-based `check` passes on that config; the owed check does not.

The owed check (the issue): "`tools/lint/ci_shards` compares the shards' collected node ids (`pytest
--collect-only -q` per shard's args) and fails when an id is collected by two shards or by none." Its
seam, pinned here: `python -m tools.lint.ci_shards collected [root]`, run from the repository, reading
`<root>/.github/ci-shards.json` and `<root>/pyproject.toml` and collecting in `<root>`; it prints one
line per problem (the node id, and for an id collected twice the names of both shards) and exits 1 if
there is any, 0 if none. "None" is measured against what pytest collects with no arguments in `<root>`
(the `testpaths`). Problem wording is the builder's; only the id and the shard names are asserted.

The synthetic roots live in tmp_path and turn pytest-django off in their own pyproject (they are not
Django projects). The real-repository cases collect the repository: run once each.
"""

import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CI = ROOT / ".github" / "workflows" / "ci.yml"
SHARDS = ROOT / ".github" / "ci-shards.json"
NOT_BUILT = "tools.lint.ci_shards collected"
# Environment a nested pytest must not inherit from the pytest running these tests.
SCRUB = ("PYTEST_ADDOPTS", "PYTEST_XDIST_WORKER", "PYTEST_XDIST_WORKER_COUNT", "PYTEST_CURRENT_TEST")


def _env(*, django: bool) -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if key not in SCRUB}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    if not django:
        env.pop("DJANGO_SETTINGS_MODULE", None)
    return env


def _collected(root: Path, *, django: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.ci_shards", "collected", str(root)],
        cwd=ROOT,
        env=_env(django=django),
        capture_output=True,
        text=True,
        check=False,
    )


def _said(result: subprocess.CompletedProcess[str]) -> str:
    return f"{NOT_BUILT} exited {result.returncode}: {result.stdout}{result.stderr}"


def _shard(name: str, paths: list[str], ignore: list[str]) -> str:
    quoted = ", ".join(f'"{path}"' for path in paths)
    ignored = ", ".join(f'"{path}"' for path in ignore)
    return f'{{"name": "{name}", "paths": [{quoted}], "ignore": [{ignored}]}}'


def _root(tmp_path: Path, testpaths: list[str], files: list[str], shards: list[str]) -> Path:
    """A synthetic repository: a pyproject with these testpaths, one test per file (named for the file,
    so every node id is unique and readable), and a shard file of these shards."""
    root = tmp_path / "repo"
    (root / ".github").mkdir(parents=True)
    listed = ", ".join(f'"{path}"' for path in testpaths)
    (root / "pyproject.toml").write_text(
        "[tool.pytest.ini_options]\n"
        f"testpaths = [{listed}]\n"
        'python_files = ["test_*.py", "*_check.py"]\n'
        'addopts = ["-p", "no:django", "-p", "no:cacheprovider"]\n'
    )
    for file in files:
        path = root / file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"def test_{path.stem.removeprefix('test_')}():\n    pass\n")
    (root / ".github" / "ci-shards.json").write_text(
        '{"version": 1, "shards": [' + ", ".join(shards) + "]}\n"
    )
    return root


def _id(file: str) -> str:
    return f"{file}::test_{Path(file).stem.removeprefix('test_')}"


def _lines_naming(output: str, node_id: str) -> list[str]:
    return [line for line in output.splitlines() if node_id in line]


# --- the check, on synthetic roots ------------------------------------------------------------------

FILES = ["alpha/test_alpha.py", "alpha/inner/test_inner.py", "beta/test_beta.py"]


def test_shards_that_collect_every_test_once_pass(tmp_path: Path) -> None:
    root = _root(
        tmp_path,
        ["alpha", "beta"],
        FILES,
        [_shard("one", ["alpha"], []), _shard("two", ["beta"], [])],
    )
    result = _collected(root)
    assert result.returncode == 0, _said(result)


def test_an_id_collected_by_two_shards_fails_naming_it_and_both_shards(tmp_path: Path) -> None:
    root = _root(
        tmp_path,
        ["alpha", "beta"],
        FILES,
        [_shard("one", ["alpha"], []), _shard("two", ["alpha/inner", "beta"], [])],
    )
    result = _collected(root)
    assert result.returncode == 1, _said(result)
    lines = _lines_naming(result.stdout, _id("alpha/inner/test_inner.py"))
    assert lines, _said(result)
    assert any("one" in line and "two" in line for line in lines), _said(result)
    assert not _lines_naming(result.stdout, _id("beta/test_beta.py")), _said(result)


def test_a_duplicate_only_pytest_sees_is_found(tmp_path: Path) -> None:
    """The ids are what pytest collects: a test in a file the configuration's `python_files` collects
    but a `test_*.py` walk does not see, in two shards, is found (as #864's duplicates were invisible to
    the file-based check)."""
    root = _root(
        tmp_path,
        ["alpha", "beta"],
        ["alpha/test_alpha.py", "alpha/sub/sub_check.py", "beta/test_beta.py"],
        [_shard("one", ["alpha"], []), _shard("two", ["alpha/sub", "beta"], [])],
    )
    result = _collected(root)
    assert result.returncode == 1, _said(result)
    lines = _lines_naming(result.stdout, _id("alpha/sub/sub_check.py"))
    assert any("one" in line and "two" in line for line in lines), _said(result)


def test_an_id_collected_by_no_shard_fails_naming_it(tmp_path: Path) -> None:
    root = _root(
        tmp_path,
        ["alpha", "beta"],
        FILES,
        [_shard("one", ["alpha"], [])],
    )
    result = _collected(root)
    assert result.returncode == 1, _said(result)
    assert _lines_naming(result.stdout, _id("beta/test_beta.py")), _said(result)
    assert not _lines_naming(result.stdout, _id("alpha/test_alpha.py")), _said(result)


def test_a_collection_error_fails_rather_than_passing(tmp_path: Path) -> None:
    """A test file pytest cannot collect is a problem, never "no problems": its tests are in no shard
    that anyone can see."""
    root = _root(
        tmp_path,
        ["alpha", "beta"],
        FILES,
        [_shard("one", ["alpha"], []), _shard("two", ["beta"], [])],
    )
    (root / "beta" / "test_broken.py").write_text("def test_broken(:\n    pass\n")
    result = _collected(root)
    assert result.returncode == 1, _said(result)
    assert result.stdout.strip(), _said(result)


# --- the repository ---------------------------------------------------------------------------------


def test_the_repositorys_shards_collect_every_test_exactly_once() -> None:
    result = _collected(ROOT, django=True)
    assert result.returncode == 0, _said(result)


def _real_args(name: str) -> list[str]:
    result = subprocess.run(
        [sys.executable, "-m", "tools.lint.ci_shards", "args", name],
        cwd=ROOT,
        env=_env(django=False),
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.split()


def test_rest_leaves_out_scripts_engine_and_tools_lint_as_pytest_reads_its_args(
    tmp_path: Path,
) -> None:
    """`rest`'s arguments, exactly as CI passes them, given to pytest in a copy of the repository's
    layout (its testpaths, a test under every folder a shard names, and one under scripts/, engine/
    and tools/lint/): pytest collects nothing of scripts/, engine/ or tools/lint/."""
    with (ROOT / "pyproject.toml").open("rb") as file:
        options = tomllib.load(file)["tool"]["pytest"]["ini_options"]
    testpaths = [str(path) for path in options["testpaths"]]
    named = set(re.findall(r'"([A-Za-z0-9_][A-Za-z0-9_./-]*)"', SHARDS.read_text()))
    folders = {path for path in named if "/" in path or path in testpaths}
    folders |= set(testpaths) | {"scripts/tests", "engine/render/tests", "tools/lint/tests"}
    files = [f"{folder}/test_{re.sub(r'[^A-Za-z0-9]', '_', folder)}.py" for folder in sorted(folders)]
    root = _root(tmp_path, testpaths, files, [])
    args = _real_args("rest")
    collected = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", *args],
        cwd=root,
        env=_env(django=False),
        capture_output=True,
        text=True,
        check=False,
    )
    assert collected.returncode == 0, collected.stdout + collected.stderr
    ids = [line for line in collected.stdout.splitlines() if "::" in line]
    leaked = [node for node in ids if node.startswith(("scripts/", "engine/", "tools/lint/"))]
    assert not leaked, f"rest ({' '.join(args)}) collects tests of other shards: {leaked}"


def test_ci_runs_the_collected_shard_check_in_a_job_the_ci_check_needs() -> None:
    text = CI.read_text()
    lines = text.splitlines()
    start = lines.index("jobs:")
    job: str | None = None
    owner: dict[str, list[str]] = {}
    runs: list[str] = []
    for line in lines[start + 1 :]:
        if line.startswith("  ") and not line.startswith("   ") and line.strip().endswith(":"):
            job = line.strip().removesuffix(":")
            owner[job] = []
        elif job is not None:
            code = "" if line.lstrip().startswith("#") else line
            owner[job].append(code)
            if NOT_BUILT in code:
                runs.append(job)
    assert runs, f"{CI.name} runs no `python -m {NOT_BUILT}`"
    ci_needs = next((line for line in owner.get("ci", []) if line.strip().startswith("needs:")), "")
    for job_id in runs:
        assert re.search(rf"[\[\s,]{re.escape(job_id)}[\],\s]", ci_needs + " "), (
            f"{CI.name}: {NOT_BUILT} runs in {job_id!r}, which the ci check does not need"
        )
