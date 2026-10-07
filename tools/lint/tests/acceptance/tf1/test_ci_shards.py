"""Ticket f1, section 3 A: the python job is four shards read from `.github/ci-shards.json`, and
`python -m tools.lint.ci_shards` proves they partition the suite, that `ci.yml` reads them, that the
`ci` aggregator needs every job, that the lints run once, that CI runs every node test, and that
`.github/flaky.txt` names real tests (docs/specs/factory.md 3.5, 3.9; the ticket's 4.1, 4.3, 4.4).

The module is imported inside each test, so each test is red on its own until the module exists.
Problem lines are compared with the tree's own path taken out, so a synthetic tree's incidental
problems (a stub tree is not the whole repository) never count for or against a test: a test asks
only for the problem its change makes.
"""

import json
import os
import re
import subprocess
import sys
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[5]
CI = ".github/workflows/ci.yml"
SHARDS = ".github/ci-shards.json"
FLAKY = ".github/flaky.txt"
# The ticket's 4.1 named four shards; S17-F1 split `rest` into three (its own acceptance tests,
# tools/lint/tests/acceptance/ts17f1, pin the split), so the names are read from the shard file.
# The ticket's 4.4: the three #245 flakes, one per class.
FLAKES = {
    (
        "web/src/acceptance/t16/viewer.test.tsx",
        "pans on a drag with the left button, by the distance dragged",
    ),
    ("web/src/acceptance/tviewerplot/plot.test.tsx", "cycles As read → Plot → Compare → As read on P"),
    (
        "web/src/takeoff/acts.test.tsx",
        (
            "says the 16 were confirmed and why the rest was not, offers Undo,"
            " and undoes only what was done"
        ),
    ),
}
# A stub test file in every folder the real shards name, and one each folder no shard names.
STUBS = [
    "vextrus/takeoff/tests/acceptance/t1/test_a.py",
    "vextrus/takeoff/tests/test_b.py",
    "vextrus/seed/tests/test_c.py",
    "vextrus/platform/tests/test_d.py",
    "vextrus/drawings/tests/test_e.py",
    "vextrus/other/tests/test_f.py",
    "engine/part/tests/test_g.py",
    "tools/lint/tests/test_h.py",
    "scripts/tests/test_i.py",
]
LINTS = ["ruff check", "mypy", "lint-imports", "makemigrations --check"]
PLUGIN = "-p tools.lint.acceptance_pytest"


# --- reading ci.yml without a YAML parser (as tools/lint/workflows.py does) ------------------------


def _code(line: str) -> str:
    """A line without its comment (a `#` at the start, or one after whitespace)."""
    return "" if line.lstrip().startswith("#") else re.sub(r"\s#\s.*$", "", line)


def jobs(text: str) -> dict[str, list[str]]:
    """Each job under `jobs:` and its lines, comments and blank lines left out."""
    lines = text.splitlines()
    start = next(at for at, line in enumerate(lines) if line.rstrip() == "jobs:")
    found: dict[str, list[str]] = {}
    indent: int | None = None
    current: str | None = None
    for line in lines[start + 1 :]:
        if not _code(line).strip():
            continue
        width = len(line) - len(line.lstrip())
        if width == 0:
            break
        indent = indent or width
        if width == indent:
            current = line.strip().removesuffix(":").strip(" '\"")
            found[current] = []
        elif current is not None:
            found[current].append(_code(line))
    return found


def needs(job: list[str]) -> list[str]:
    """The job's own `needs:` (inline, a list, or one name)."""
    width = len(job[0]) - len(job[0].lstrip())
    for at, line in enumerate(job):
        if len(line) - len(line.lstrip()) != width or not line.strip().startswith("needs:"):
            continue
        rest = line.strip().removeprefix("needs:").strip()
        if rest:
            return [word.strip(" '\"") for word in rest.strip("[]").split(",") if word.strip()]
        items = []
        for child in job[at + 1 :]:
            if len(child) - len(child.lstrip()) <= width:
                break
            items.append(child.strip().removeprefix("- ").strip(" '\""))
        return items
    return []


def pytest_lines(text: str) -> list[str]:
    return [line for line in map(_code, text.splitlines()) if re.search(r"(?:uv run|-m) pytest\b", line)]


# --- synthetic trees -------------------------------------------------------------------------------


def _write(root: Path, name: str, text: str = "") -> None:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def tree(root: Path, *, ci: str | None = None, mjs: list[str] | None = None) -> Path:
    """A small repository shaped like the real one: the real `pyproject.toml`, shard file, flaky
    list and the files it names, a stub test in each folder, the node tests (`mjs`, by default the
    real ones' paths) and `ci.yml` (`ci`, by default the real one). Tracked by git, so a check that
    lists files with git sees what one that walks the folders sees."""
    for name in ("pyproject.toml", SHARDS, FLAKY):
        _write(root, name, (ROOT / name).read_text())
    for path, _title in FLAKES:
        _write(root, path, (ROOT / path).read_text())
    for name in STUBS:
        _write(root, name, "def test_stub() -> None:\n    pass\n")
    for name in mjs if mjs is not None else _real_mjs():
        _write(root, name, "")
    _write(root, CI, ci if ci is not None else (ROOT / CI).read_text())
    _track(root)
    return root


def _real_mjs() -> list[str]:
    listed = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "*.test.mjs"], capture_output=True, text=True, check=True
    )
    return listed.stdout.split()


def _track(root: Path) -> None:
    env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
    for args in (["init", "-q", "-b", "main"], ["add", "--", "."]):
        subprocess.run(["git", "-C", str(root), *args], env=env, capture_output=True, check=True)


def minimal(
    root: Path, testpaths: list[str], files: list[str], shards: Sequence[Mapping[str, object]]
) -> Path:
    """A tree with its own `testpaths`, test files and shard file (the real `ci.yml` beside them)."""
    paths = ", ".join(json.dumps(path) for path in testpaths)
    _write(root, "pyproject.toml", f"[tool.pytest.ini_options]\ntestpaths = [{paths}]\n")
    _write(root, SHARDS, json.dumps({"version": 1, "shards": shards}))
    for name in files:
        _write(root, name, "def test_stub() -> None:\n    pass\n")
    _write(root, CI, (ROOT / CI).read_text())
    _track(root)
    return root


def found(root: Path) -> list[str]:
    from tools.lint.ci_shards import problems

    return [line.replace(str(root), "<root>") for line in problems(root)]


def made_by(tmp: Path, change: Callable[[str], str]) -> list[str]:
    """The problems a change to the real `ci.yml` adds, against an unchanged copy."""
    real = (ROOT / CI).read_text()
    changed = change(real)
    assert changed != real, "the change applies to the real ci.yml"
    before = set(found(tree(tmp / "before")))
    return [line for line in found(tree(tmp / "after", ci=changed)) if line not in before]


def cli(*args: str, cwd: Path = ROOT) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.ci_shards", *args],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def exit_code(call: Callable[[], int]) -> int:
    try:
        return call()
    except SystemExit as stopped:
        return stopped.code if isinstance(stopped.code, int) else 1


def real_shards() -> list[dict[str, object]]:
    shards: list[dict[str, object]] = json.loads((ROOT / SHARDS).read_text())["shards"]
    return shards


def _strings(value: object) -> list[str]:
    assert isinstance(value, list)
    return [str(item) for item in value]


# --- A1 to A12 -------------------------------------------------------------------------------------


def test_a1_the_real_repository_has_no_problems_and_the_check_exits_0(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from tools.lint.ci_shards import main, problems

    assert problems(ROOT) == []
    monkeypatch.chdir(ROOT)
    assert exit_code(lambda: main([])) == 0


def test_a2_a_test_folder_no_shard_covers_is_a_problem_naming_it(tmp_path: Path) -> None:
    files = ["alpha/tests/test_x.py", "bravo/tests/test_x.py", "charlie/tests/test_x.py"]
    testpaths = ["alpha", "bravo", "charlie"]
    two = [
        {"name": "one", "paths": ["alpha"], "ignore": []},
        {"name": "two", "paths": ["bravo"], "ignore": []},
    ]
    three = [*two, {"name": "three", "paths": ["charlie"], "ignore": []}]

    assert any("charlie" in line for line in found(minimal(tmp_path / "two", testpaths, files, two)))
    assert not any(
        "charlie" in line for line in found(minimal(tmp_path / "three", testpaths, files, three))
    )


def test_a3_a_folder_claimed_by_two_shards_is_a_problem_naming_it(tmp_path: Path) -> None:
    files = ["alpha/tests/test_x.py", "bravo/tests/test_x.py"]
    testpaths = ["alpha", "bravo"]
    once = [
        {"name": "one", "paths": ["alpha"], "ignore": []},
        {"name": "two", "paths": ["bravo"], "ignore": []},
    ]
    twice = [
        {"name": "one", "paths": ["alpha"], "ignore": []},
        {"name": "two", "paths": ["bravo", "alpha"]},
    ]

    assert any("alpha" in line for line in found(minimal(tmp_path / "twice", testpaths, files, twice)))
    assert not any("alpha" in line for line in found(minimal(tmp_path / "once", testpaths, files, once)))


def test_a4_a_new_folder_falls_into_the_last_shard_and_never_drops_out(tmp_path: Path) -> None:
    files = ["pkg/alpha/tests/test_a.py", "pkg/bravo/tests/test_b.py", "pkg/delta/tests/test_x.py"]
    rest = {"name": "rest", "paths": [], "ignore": ["pkg/alpha", "pkg/bravo"]}
    shards = [{"name": "one", "paths": ["pkg/alpha"]}, {"name": "two", "paths": ["pkg/bravo"]}, rest]
    root = minimal(tmp_path / "rest", ["pkg"], files, shards)

    assert not any("delta" in line for line in found(root))
    printed = cli("args", "rest", cwd=root)
    assert printed.returncode == 0, printed.stderr
    words = printed.stdout.split()
    assert [word for word in words if not word.startswith("-")] == [], "the last shard names no path"
    ignored = [word.removeprefix("--ignore=") for word in words]
    assert not any("pkg/delta/tests/test_x.py".startswith(f"{path}/") for path in ignored)

    # Had the last shard named its folders, the new one would drop out: the check sees it.
    closed = [*shards[:2], {"name": "rest", "paths": ["pkg/charlie"]}]
    assert any("delta" in line for line in found(minimal(tmp_path / "closed", ["pkg"], files, closed)))


def test_a5_matrix_prints_the_real_shard_names_in_order_and_an_unknown_subcommand_exits_2() -> None:
    names = [shard["name"] for shard in real_shards()]
    printed = cli("matrix")
    assert printed.returncode == 0, printed.stderr
    assert len(printed.stdout.strip().splitlines()) == 1, "one line"
    assert json.loads(printed.stdout) == {"include": [{"shard": name} for name in names]}

    assert cli("bogus").returncode == 2


def test_a6_args_prints_a_shards_pytest_arguments_and_refuses_an_unsafe_path(tmp_path: Path) -> None:
    for shard in real_shards():
        printed = cli("args", str(shard["name"]))
        assert printed.returncode == 0, printed.stderr
        assert len(printed.stdout.strip().splitlines()) == 1, "one line"
        ignore = _strings(shard.get("ignore", []))
        expected = [*_strings(shard["paths"]), *(f"--ignore={path}" for path in ignore)]
        # S17-F1: the printed arguments may also carry pytest options (the shard's workers).
        assert [word for word in printed.stdout.split() if word in expected] == expected

    # The catch-all (f1's `rest`; S17-F1 split it): one shard names no path and ignores every other
    # shard's paths, so a new folder never drops out.
    catch_all = [shard for shard in real_shards() if not _strings(shard["paths"])]
    assert len(catch_all) == 1, "exactly one shard names no path"
    rest = cli("args", str(catch_all[0]["name"])).stdout.split()
    assert not [word for word in rest if not word.startswith("-") and "/" in word], "it carries no path"
    ignored = [word.removeprefix("--ignore=") for word in rest if word.startswith("--ignore=")]
    for shard in real_shards():
        for path in _strings(shard["paths"]):
            assert any(path == i or path.startswith(f"{i}/") for i in ignored), path

    unknown = cli("args", "no-such-shard")
    assert unknown.returncode == 1
    assert unknown.stdout == ""

    files = ["pkg/a/tests/test_a.py"]
    for bad in ("pkg/al pha", "pkg/a;b", "pkg/$(id)"):
        shards = [{"name": "one", "paths": ["pkg/a"]}, {"name": "two", "paths": [bad]}]
        name = re.sub(r"\W", "_", bad)
        assert any(bad in line for line in found(minimal(tmp_path / name, ["pkg"], files, shards))), bad


def test_a7_the_python_job_is_a_matrix_read_from_the_shard_job_with_the_plugin_on_every_pytest(
    tmp_path: Path,
) -> None:
    text = (ROOT / CI).read_text()
    every = jobs(text)
    python = every["python"]
    body = "\n".join(python)
    reads = re.search(
        r"matrix:\s*\$\{\{\s*fromJSON\(\s*needs\.([\w-]+)\.outputs\.[\w-]+\s*\)\s*\}\}", body
    )
    assert reads, "strategy.matrix is fromJSON of a job's output"
    shard_job = reads.group(1)
    assert shard_job in needs(python)
    assert "tools.lint.ci_shards matrix" in "\n".join(every[shard_job])
    assert re.search(r"^\s*strategy:", body, re.MULTILINE)
    assert re.search(r"^\s*fail-fast:\s*false\s*$", body, re.MULTILINE)
    assert re.search(r"^\s*timeout-minutes:\s*25\s*$", body, re.MULTILINE)
    assert pytest_lines(body), "the python job runs pytest"
    for line in pytest_lines(text):
        assert PLUGIN in line, line

    def hard_coded(ci: str) -> str:
        return re.sub(r"\$\{\{\s*fromJSON\([^}]*\}\}", '{"include": [{"shard": "rest"}]}', ci)

    assert any("matrix" in line.lower() for line in made_by(tmp_path / "matrix", hard_coded))
    assert any(
        "acceptance_pytest" in line
        for line in made_by(tmp_path / "plugin", lambda ci: ci.replace(PLUGIN, ""))
    )


def test_a8_the_ci_aggregator_needs_every_other_job(tmp_path: Path) -> None:
    every = jobs((ROOT / CI).read_text())
    assert set(needs(every["ci"])) == set(every) - {"ci"}

    def one_more_job(ci: str) -> str:
        width = len(next(line for line in ci.splitlines() if line.strip() == "ci:")) - len("ci:")
        pad = " " * width
        added = (
            f"{pad}extra-leg:\n{pad}  runs-on: ubuntu-24.04\n{pad}  steps:\n{pad}    - run: echo extra\n"
        )
        return ci.rstrip("\n") + "\n\n" + added

    assert any("extra-leg" in line for line in made_by(tmp_path, one_more_job))


def test_a9_the_lints_run_once_and_never_in_the_matrix_job(tmp_path: Path) -> None:
    every = jobs((ROOT / CI).read_text())
    for lint in LINTS:
        running = [name for name, lines in every.items() if any(lint in line for line in lines)]
        assert len(running) == 1, f"{lint!r} runs in {running}"
        assert running != ["python"], f"{lint!r} runs in the matrix job"

    def mypy_in_the_matrix(ci: str) -> str:
        lines = ci.splitlines(keepends=True)
        start = next(at for at, line in enumerate(lines) if line.strip() == "python:")
        at = next(at for at in range(start, len(lines)) if "uv run pytest" in lines[at])
        lines[at] = lines[at].replace("uv run pytest", "uv run mypy && uv run pytest", 1)
        return "".join(lines)

    assert any("mypy" in line for line in made_by(tmp_path, mypy_in_the_matrix))


def test_a10_a_directory_argument_to_node_test_is_a_problem(tmp_path: Path) -> None:
    def directories(ci: str) -> str:
        return re.sub(r"node --test .*", "node --test .claude/hooks/ scripts/factory/", ci)

    assert made_by(tmp_path, directories), "on Node 24 `node --test <dir>/` runs the folder as a file"


def test_a11_every_node_test_under_claude_and_scripts_is_reached_by_the_harness_step(
    tmp_path: Path,
) -> None:
    mjs = ["scripts/factory/x.test.mjs", ".claude/hooks/y.test.mjs"]
    real = (ROOT / CI).read_text()
    assert re.search(r"node --test .*", real)
    hooks_only = re.sub(r"node --test .*", "node --test '.claude/hooks/**/*.test.mjs'", real)
    both = re.sub(
        r"node --test .*",
        "node --test '.claude/hooks/**/*.test.mjs' 'scripts/factory/**/*.test.mjs'",
        real,
    )

    short = found(tree(tmp_path / "short", ci=hooks_only, mjs=mjs))
    assert any("scripts/factory/x.test.mjs" in line for line in short)
    assert not any("y.test.mjs" in line for line in short)
    assert not any(".test.mjs" in line for line in found(tree(tmp_path / "both", ci=both, mjs=mjs)))


def test_a12_the_flaky_list_names_real_tests_and_holds_exactly_the_three_245_flakes(
    tmp_path: Path,
) -> None:
    from tools.lint.ci_shards import flaky_problems

    assert flaky_problems(ROOT) == []
    entries = [
        line
        for line in (ROOT / FLAKY).read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]
    pairs = {tuple(part.strip() for part in line.split(" :: ", 1)) for line in entries}
    assert len(entries) == 3
    assert pairs == FLAKES

    _write(tmp_path, "web/a.test.tsx", "it('does a thing', () => {})\n")
    _write(tmp_path, FLAKY, "# remove when green\n\nweb/a.test.tsx :: does a thing\n")
    assert flaky_problems(tmp_path) == []
    _write(tmp_path, FLAKY, "web/missing.test.tsx :: does a thing\n")
    assert any("web/missing.test.tsx" in line for line in flaky_problems(tmp_path))
    _write(tmp_path, FLAKY, "web/a.test.tsx :: does another thing\n")
    assert flaky_problems(tmp_path) != []
