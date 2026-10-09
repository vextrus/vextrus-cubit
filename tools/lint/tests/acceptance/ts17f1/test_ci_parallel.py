"""Ticket S17-F1 (session 17, factory speed; verify-ci-speed.md items 4 and 5): CI's python shards run
pytest with four workers (`-n 4`), the `rest` shard is split into three, the engine's toolchain job
runs `-n 3`, and `tools/lint/tests` stays serial (no `-n`) until #585 is fixed. No `-n auto` anywhere
in `.github/workflows`.

What a shard runs is read at CI's boundary: the `python` job's steps in `ci.yml` (a step's `if:` on
`matrix.shard` is evaluated per shard) with `$(python3 -m tools.lint.ci_shards args "$SHARD")` replaced
by what that command prints for the shard, and the shard names by `tools.lint.ci_shards matrix`. So the
workers may live in the step's text or in the shard's printed arguments, as the builder chooses. A
pytest line whose targets are all single files (the policy-coverage step) is not a shard's test run.
Shell-level branching inside one `run:` script is not read: branch by the step's `if:`.
"""

import re
import shlex
import subprocess
import sys
import tomllib
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from functools import cache
from pathlib import Path, PurePath

ROOT = Path(__file__).resolve().parents[5]
CI = ".github/workflows/ci.yml"
ENGINE = ".github/workflows/engine.yml"
WORKFLOWS = ".github/workflows"
MATRIX_JOB = "python"
TOOLCHAIN_JOB = "toolchain"
LINT_TESTS = "tools/lint/tests"
# The three shards beside `rest` on main (2a63391a7), and what each runs; the ticket splits only `rest`.
KEPT = {
    "takeoff-acceptance": (("vextrus/takeoff/tests/acceptance",), ()),
    "takeoff-rest": (("vextrus/takeoff",), ("vextrus/takeoff/tests/acceptance",)),
    "seed-platform-drawings": (("vextrus/seed", "vextrus/platform", "vextrus/drawings"), ()),
}
# What `rest` ran on main: every test file outside these.
REST_IGNORED = ("vextrus/takeoff", "vextrus/seed", "vextrus/platform", "vextrus/drawings")
PYTEST = re.compile(r"(?:\buv run(?:\s+--[\w-]+)*|\s-m)\s+pytest\b")
ARGS_CALL = re.compile(r"\$\([^()]*tools\.lint\.ci_shards\s+args\b[^()]*\)")
SHARD_REFS = re.compile(r"\$\{\{\s*matrix\.shard\s*\}\}|\$\{SHARD\}|\$SHARD\b")
N_AUTO = re.compile(r"(?:(?<![\w-])-n\s*=?\s*|--numprocesses(?:\s*=\s*|\s+))[\"']?auto\b")
# pytest options that take the next word as their value.
VALUED = {
    "-p", "-m", "-k", "-n", "-c", "-o", "-W",
    "--numprocesses", "--junitxml", "--junit-xml", "--rootdir", "--maxfail", "--dist", "--ignore",
    "--ignore-glob", "--deselect", "--durations", "--tb", "--basetemp", "--confcutdir",
    "--override-ini", "--log-level", "--max-worker-restart", "--maxprocesses", "--import-mode",
}  # fmt: skip


# --- the repository's test files -------------------------------------------------------------------


@cache
def roots() -> tuple[str, ...]:
    with (ROOT / "pyproject.toml").open("rb") as file:
        paths = tomllib.load(file)["tool"]["pytest"]["ini_options"]["testpaths"]
    return tuple(str(path) for path in paths)


@cache
def repo_test_files() -> tuple[str, ...]:
    """Every `test_*.py` or `*_test.py` pytest would find under the testpaths, as repository paths."""
    found: list[str] = []
    for top in roots():
        for path in sorted((ROOT / top).rglob("*.py")):
            parts = path.relative_to(ROOT).parts
            if any(p == "__pycache__" or p == "node_modules" or p.startswith(".") for p in parts):
                continue
            if path.name.startswith("test_") or path.name.endswith("_test.py"):
                found.append(PurePath(*parts).as_posix())
    return tuple(found)


def under(path: str, root: str) -> bool:
    root = root.rstrip("/")
    return path == root or path.startswith(f"{root}/")


def selected(paths: tuple[str, ...], ignore: tuple[str, ...]) -> set[str]:
    return {
        file
        for file in repo_test_files()
        if (not paths or any(under(file, root) for root in paths))
        and not any(under(file, root) for root in ignore)
    }


# --- reading a workflow as text (no YAML parser in the tree) ---------------------------------------


def indent(line: str) -> int:
    return len(line) - len(line.lstrip())


def job_lines(text: str, name: str) -> list[str]:
    """The lines of one job under the top-level `jobs:`, full-line comments and blank lines left out."""
    lines = [line for line in text.splitlines() if line.strip() and not line.lstrip().startswith("#")]
    start = next(at for at, line in enumerate(lines) if line.rstrip() == "jobs:")
    width: int | None = None
    current: str | None = None
    found: list[str] = []
    for line in lines[start + 1 :]:
        if indent(line) == 0:
            break
        width = width or indent(line)
        if indent(line) == width:
            current = line.strip().removesuffix(":").strip(" '\"")
        elif current == name:
            found.append(line)
    assert found, f"no job {name!r}"
    return found


@dataclass(frozen=True)
class Step:
    condition: str | None
    run: str


def steps(job: list[str]) -> list[Step]:
    at = next(i for i, line in enumerate(job) if line.strip() == "steps:")
    base = indent(job[at])
    items: list[list[str]] = []
    for line in job[at + 1 :]:
        if indent(line) <= base:
            break
        if line.lstrip().startswith("- ") and (not items or indent(line) <= indent(items[0][0])):
            items.append([line])
        elif items:
            items[-1].append(line)
    return [step(item) for item in items]


def step(item: list[str]) -> Step:
    first = item[0]
    key_width = indent(first) + 2
    lines = [" " * key_width + first.lstrip()[2:], *item[1:]]
    condition: str | None = None
    run = ""
    for at, line in enumerate(lines):
        if indent(line) != key_width:
            continue
        key, _, value = line.strip().partition(":")
        value = value.strip()
        if key == "if":
            condition = value
        elif key == "run":
            if value[:1] in ("|", ">"):
                block: list[str] = []
                for child in lines[at + 1 :]:
                    if indent(child) <= key_width:
                        break
                    block.append(child)
                width = min((indent(child) for child in block), default=0)
                run = "\n".join(child[width:] for child in block)
            else:
                run = value
    return Step(condition, run)


def runs_for(condition: str | None, shard: str) -> bool:
    """A step's `if:` for this shard: `matrix.shard ==/!= '<name>'`, always(), success(), && || ! ()."""
    if condition is None:
        return True
    text = condition.strip()
    text = text.removeprefix("${{").removesuffix("}}").strip()

    def compare(match: re.Match[str]) -> str:
        equal = shard == match.group(3)
        return f" {equal if match.group(2) == '==' else not equal} "

    text = re.sub(r"(matrix\.shard)\s*(==|!=)\s*'([^']*)'", compare, text)
    text = re.sub(r"\b(?:always|success)\(\)", " True ", text)
    text = re.sub(r"\b(?:failure|cancelled)\(\)", " False ", text)
    text = text.replace("&&", " and ").replace("||", " or ")
    text = re.sub(r"!(?!=)", " not ", text)
    tokens = re.findall(r"[()]|[^\s()]+", text)
    assert set(tokens) <= {"True", "False", "and", "or", "not", "(", ")"}, (
        f"cannot read the step's if: {condition}"
    )
    value, at = _either(tokens, 0)
    assert at == len(tokens), f"cannot read the step's if: {condition}"
    return value


def _either(tokens: list[str], at: int) -> tuple[bool, int]:
    value, at = _both(tokens, at)
    while at < len(tokens) and tokens[at] == "or":
        right, at = _both(tokens, at + 1)
        value = value or right
    return value, at


def _both(tokens: list[str], at: int) -> tuple[bool, int]:
    value, at = _one(tokens, at)
    while at < len(tokens) and tokens[at] == "and":
        right, at = _one(tokens, at + 1)
        value = value and right
    return value, at


def _one(tokens: list[str], at: int) -> tuple[bool, int]:
    assert at < len(tokens), "a step's if: ends early"
    if tokens[at] == "not":
        value, at = _one(tokens, at + 1)
        return not value, at
    if tokens[at] == "(":
        value, at = _either(tokens, at + 1)
        assert at < len(tokens), "a step's if: has an unclosed ("
        assert tokens[at] == ")", "a step's if: has an unclosed ("
        return value, at + 1
    assert tokens[at] in ("True", "False"), f"a step's if: has {tokens[at]!r} where a value goes"
    return tokens[at] == "True", at + 1


def commands(run: str) -> Iterator[str]:
    """Each shell command line of a `run:` script, a trailing backslash joining the next line."""
    yield from run.replace("\\\n", " ").splitlines()


# --- what pytest is asked to run -------------------------------------------------------------------


@dataclass(frozen=True)
class Invocation:
    line: str
    argv: tuple[str, ...]

    def workers(self) -> list[str]:
        found: list[str] = []
        words = list(self.argv)
        for at, word in enumerate(words):
            if word in ("-n", "--numprocesses"):
                found.append(words[at + 1] if at + 1 < len(words) else "")
            elif word.startswith("--numprocesses="):
                found.append(word.removeprefix("--numprocesses="))
            elif word.startswith("-n") and not word.startswith("--") and len(word) > 2:
                found.append(word[2:].removeprefix("="))
        return found

    def targets_and_ignores(self) -> tuple[tuple[str, ...], tuple[str, ...]]:
        targets: list[str] = []
        ignores: list[str] = []
        words = list(self.argv)
        at = 0
        while at < len(words):
            word = words[at]
            if word.startswith("--ignore="):
                ignores.append(word.removeprefix("--ignore="))
            elif word == "--ignore" and at + 1 < len(words):
                ignores.append(words[at + 1])
                at += 1
            elif word in VALUED:
                at += 1
            elif not word.startswith("-"):
                targets.append(word.split("::", 1)[0].rstrip("/"))
            at += 1
        return tuple(targets), tuple(ignores)

    def is_test_run(self) -> bool:
        """Not a run of single files only (the policy-coverage step)."""
        targets, _ = self.targets_and_ignores()
        return not targets or any(not target.endswith(".py") for target in targets)

    def collects(self) -> set[str]:
        targets, ignores = self.targets_and_ignores()
        return selected(targets or roots(), ignores)


def invocations(run: str, expand: dict[str, str] | None = None) -> list[Invocation]:
    found: list[Invocation] = []
    for line in commands(run):
        match = PYTEST.search(line)
        if not match:
            continue
        rest = line[match.end() :]
        for pattern, value in (expand or {}).items():
            rest = re.sub(pattern, value.replace("\\", "\\\\"), rest)
        assert "$(" not in rest, f"cannot read a command substitution in: {line.strip()}"
        found.append(Invocation(line.strip(), tuple(shlex.split(rest))))
    return found


@cache
def shard_names() -> tuple[str, ...]:
    import json

    printed = cli("matrix")
    assert printed.returncode == 0, printed.stderr
    include = json.loads(printed.stdout)["include"]
    return tuple(str(item["shard"]) for item in include)


@cache
def shard_args(shard: str) -> str:
    printed = cli("args", shard)
    assert printed.returncode == 0, printed.stderr
    return printed.stdout.strip()


def cli(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.ci_shards", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


@cache
def shard_runs(shard: str) -> tuple[Invocation, ...]:
    """Every pytest invocation the python job runs for this shard, its arguments expanded."""
    job = job_lines((ROOT / CI).read_text(), MATRIX_JOB)
    expand = {ARGS_CALL.pattern: shard_args(shard), SHARD_REFS.pattern: shard}
    found: list[Invocation] = []
    for item in steps(job):
        if item.run and runs_for(item.condition, shard):
            found.extend(invocations(item.run, expand))
    return tuple(found)


def shard_test_runs(shard: str) -> list[Invocation]:
    return [run for run in shard_runs(shard) if run.is_test_run()]


def holds_lint_tests(run: Invocation) -> bool:
    return any(under(file, LINT_TESTS) for file in run.collects())


def new_shards() -> list[str]:
    names = shard_names()
    for name in KEPT:
        assert name in names, f"the shards are {list(names)}: {name!r} is gone"
    others = [name for name in names if name not in KEPT]
    assert len(others) == 3, f"the shards are {list(names)}: rest is not split into three"
    return others


# --- the shards ------------------------------------------------------------------------------------


def test_rest_becomes_three_shards_beside_the_three_it_had() -> None:
    assert len(new_shards()) == 3
    assert len(shard_names()) == 6


def test_the_three_new_shards_run_every_test_file_rest_ran_exactly_once() -> None:
    rest = selected((), REST_IGNORED)
    counted: Counter[str] = Counter()
    for shard in new_shards():
        ran: Counter[str] = Counter()
        for run in shard_test_runs(shard):
            ran.update(run.collects())
        assert ran, f"shard {shard!r} runs no test file"
        counted.update(ran)
    dropped = sorted(rest - set(counted))
    twice = sorted(file for file, times in counted.items() if times > 1)
    strays = sorted(set(counted) - rest)
    assert not dropped, f"rest's test files no new shard runs: {dropped[:10]}"
    assert not twice, f"test files run more than once: {twice[:10]}"
    assert not strays, f"test files rest did not run, run by a new shard: {strays[:10]}"


def test_the_three_shards_beside_rest_still_run_what_they_ran() -> None:
    for shard, (paths, ignore) in KEPT.items():
        ran: set[str] = set()
        for run in shard_test_runs(shard):
            ran |= run.collects()
        assert ran == selected(paths, ignore), f"shard {shard!r} runs other files than on main"


# --- the workers -----------------------------------------------------------------------------------


def test_every_shards_test_run_carries_n_4_but_the_one_holding_tools_lint_tests() -> None:
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


def test_the_run_holding_tools_lint_tests_carries_no_n() -> None:
    holding = [
        (shard, run) for shard in shard_names() for run in shard_runs(shard) if holds_lint_tests(run)
    ]
    assert holding, f"no shard runs {LINT_TESTS}"
    for shard, run in holding:
        assert run.workers() == [], (
            f"shard {shard!r}: pytest {' '.join(run.argv)} runs {LINT_TESTS} with -n (#585 is open)"
        )


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
