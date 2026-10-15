"""The CI shard check (the factory spec 3.9; ticket f1). `ci.yml`'s python job is a matrix read from
`.github/ci-shards.json`; this proves the shards partition the suite (every test file in exactly one
shard, so a new folder can never drop out), that `ci.yml` reads them, that the `ci` aggregator needs
every job (so no leg goes unrequired), that the lints run once and outside the matrix, that the
harness step runs every node test under `.claude/` and `scripts/` (the spec 3.5), and that
`.github/flaky.txt` names real tests (#245). It reads `ci.yml` as text, as `workflows.py` does: no
YAML parser. Fails closed: a file it cannot read is a problem, never "no problems". Standard library
only.

    python -m tools.lint.ci_shards [check [root]]   # the problems, one per line; exit 1 if any
    python -m tools.lint.ci_shards matrix           # {"include":[{"shard":"<name>"},...]}, one line
    python -m tools.lint.ci_shards args <name>      # the shard's pytest arguments, one line
    python -m tools.lint.ci_shards collected [root] # what pytest collects: each id in one shard (#864)
    python -m tools.lint.ci_shards balance [root]   # each shard predicted at 270 s or less (S29-F1)
"""

import ast
import json
import os
import re
import shlex
import subprocess
import sys
import tomllib
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path, PurePath

SHARDS = ".github/ci-shards.json"
CI = ".github/workflows/ci.yml"
FLAKY = ".github/flaky.txt"
TIMINGS = ".github/ci-timings.json"
# 6 min on main, less about 0.5 min before a shard starts and about 1 min of set-up in it (S29-F1); the
# 4 workers are the ones every shard's test run carries (ts29f1 pins `-n 4`).
BOUND_SECONDS = 270.0
WORKERS = 4
PLUGIN = "-p tools.lint.acceptance_pytest"
MATRIX_JOB = "python"
AGGREGATOR = "ci"
# The once-only lints (the ticket's A9): each in exactly one job, never the matrix one.
ONCE = ("ruff check", "mypy", "lint-imports", "makemigrations --check")
NODE_ROOTS = (".claude/", "scripts/")
SAFE_PATH = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./-]*$")
SAFE_NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")
FROM_JSON = re.compile(r"matrix:\s*\$\{\{\s*fromJSON\(\s*needs\.([\w-]+)\.outputs\.[\w-]+\s*\)\s*\}\}")
PYTEST = re.compile(r"(?:uv run|-m) pytest\b")


@dataclass(frozen=True)
class Shard:
    name: str
    paths: tuple[str, ...]
    ignore: tuple[str, ...]

    def owns(self, path: str) -> bool:
        inside = not self.paths or any(_under(path, root) for root in self.paths)
        return inside and not any(_under(path, root) for root in self.ignore)

    def args(self) -> list[str]:
        # pytest honours --ignore only for folders found inside its arguments, never for an argument
        # itself: a shard without paths is given the testpaths, so its --ignore words alone do nothing
        # (issue #864). --ignore-glob=<p>/* does the same inside a folder and also on an argument.
        return [
            *self.paths,
            *(f"--ignore={path}" for path in self.ignore),
            *(f"--ignore-glob={path.rstrip('/')}/*" for path in self.ignore),
        ]


def _under(path: str, root: str) -> bool:
    root = root.rstrip("/")
    return path == root or path.startswith(f"{root}/")


class Malformed(Exception):
    """The shard file cannot be read as shards; the message is the problem line."""


def load(root: Path) -> list[Shard]:
    """The shards, or `Malformed` naming why not (and every unsafe path or name)."""
    try:
        data = json.loads((root / SHARDS).read_text())
    except (OSError, ValueError) as error:
        raise Malformed(f"{SHARDS}: unreadable ({error})") from None
    raw = data.get("shards") if isinstance(data, dict) else None
    if not isinstance(raw, list) or not raw:
        raise Malformed(f"{SHARDS}: no list of shards")
    shards: list[Shard] = []
    bad: list[str] = []
    for at, item in enumerate(raw):
        if not isinstance(item, dict):
            raise Malformed(f"{SHARDS}: shard {at} is not an object")
        name = item.get("name")
        paths, ignore = item.get("paths", []), item.get("ignore", [])
        if not isinstance(name, str) or not name:
            raise Malformed(f"{SHARDS}: shard {at} has no name")
        if not (_strings(paths) and _strings(ignore)):
            raise Malformed(f"{SHARDS}: shard {name!r}: paths and ignore must be lists of strings")
        if not SAFE_NAME.match(name):
            bad.append(f"{SHARDS}: shard name {name!r} is not lower-case letters, digits and -")
        bad.extend(
            f"{SHARDS}: shard {name!r}: unsafe path {path!r} (letters, digits, _ . / - only)"
            for path in [*paths, *ignore]
            if not SAFE_PATH.match(path) or ".." in path.split("/")
        )
        shards.append(Shard(name, tuple(paths), tuple(ignore)))
    names = [shard.name for shard in shards]
    bad.extend(
        f"{SHARDS}: two shards are named {name!r}"
        for name in sorted(set(names))
        if names.count(name) > 1
    )
    if bad:
        raise Malformed("\n".join(bad))
    return shards


def _strings(value: object) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def testpaths(root: Path) -> list[str]:
    with (root / "pyproject.toml").open("rb") as file:
        options = tomllib.load(file)["tool"]["pytest"]["ini_options"]
    paths = options["testpaths"]
    if not _strings(paths):
        raise ValueError("testpaths is not a list of strings")
    return list(paths)


def test_files(root: Path, roots: list[str]) -> list[str]:
    """Every `test_*.py` or `*_test.py` under the `testpaths`, as repository paths."""
    found: list[str] = []
    for top in roots:
        base = root / top
        for path in sorted(base.rglob("*.py")) if base.is_dir() else []:
            parts = path.relative_to(root).parts
            if any(
                part == "__pycache__" or part.startswith(".") or part == "node_modules" for part in parts
            ):
                continue
            if path.name.startswith("test_") or path.name.endswith("_test.py"):
                found.append(PurePath(*parts).as_posix())
    return found


def shard_problems(root: Path) -> list[str]:
    try:
        shards = load(root)
    except Malformed as error:
        return str(error).splitlines()
    try:
        roots = testpaths(root)
    except (OSError, KeyError, TypeError, ValueError) as error:
        return [f"pyproject.toml: no readable testpaths ({error})"]
    found: list[str] = []
    for path in test_files(root, roots):
        owners = [shard.name for shard in shards if shard.owns(path)]
        if not owners:
            found.append(f"{path}: in no shard of {SHARDS} (CI would never run it)")
        elif len(owners) > 1:
            found.append(f"{path}: in more than one shard ({', '.join(owners)})")
    return found


# --- ci.yml, read as text --------------------------------------------------------------------------


def _code(line: str) -> str:
    """A line without its comment (a `#` at the start, or one after whitespace)."""
    return "" if line.lstrip().startswith("#") else re.sub(r"\s#\s.*$", "", line)


def jobs(text: str) -> dict[str, list[str]]:
    """Each job under the top-level `jobs:` and its lines, comments and blank lines left out."""
    lines = text.splitlines()
    start = next((at for at, line in enumerate(lines) if line.rstrip() == "jobs:"), None)
    found: dict[str, list[str]] = {}
    if start is None:
        return found
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
            current = _code(line).strip().removesuffix(":").strip(" '\"")
            found[current] = []
        elif current is not None:
            found[current].append(_code(line))
    return found


def needs(job: list[str]) -> list[str]:
    """The job's own `needs:` (inline, a list, or one name)."""
    if not job:
        return []
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


def workflow_problems(root: Path) -> list[str]:
    try:
        text = (root / CI).read_text()
    except OSError as error:
        return [f"{CI}: unreadable ({error})"]
    every = jobs(text)
    found: list[str] = []
    python = every.get(MATRIX_JOB)
    if python is None:
        found.append(f"{CI}: no {MATRIX_JOB!r} job")
    else:
        body = "\n".join(python)
        reads = FROM_JSON.search(body)
        if not reads:
            found.append(
                f"{CI}: the {MATRIX_JOB} job's strategy.matrix is not fromJSON of the shard job's output"
            )
        else:
            source = reads.group(1)
            if source not in needs(python):
                found.append(
                    f"{CI}: the {MATRIX_JOB} job's matrix reads {source!r}, which it does not need"
                )
            if "tools.lint.ci_shards matrix" not in "\n".join(every.get(source, [])):
                found.append(f"{CI}: the matrix job {source!r} does not run tools.lint.ci_shards matrix")
        if not re.search(r"^\s*fail-fast:\s*false\s*$", body, re.MULTILINE):
            found.append(f"{CI}: the {MATRIX_JOB} job's matrix lacks fail-fast: false")
        if not re.search(r"^\s*timeout-minutes:\s*25\s*$", body, re.MULTILINE):
            found.append(f"{CI}: the {MATRIX_JOB} job lacks timeout-minutes: 25")
        if not any(PYTEST.search(line) for line in python):
            found.append(f"{CI}: the {MATRIX_JOB} job runs no pytest")
    found.extend(
        f"{CI}: a pytest line without {PLUGIN} (tools.lint.acceptance_pytest): {line.strip()}"
        for line in map(_code, text.splitlines())
        if PYTEST.search(line) and PLUGIN not in line
    )
    aggregator = every.get(AGGREGATOR)
    if aggregator is None:
        found.append(f"{CI}: no {AGGREGATOR!r} aggregator job")
    else:
        missing = [name for name in every if name != AGGREGATOR and name not in needs(aggregator)]
        found.extend(
            f"{CI}: the {AGGREGATOR} job does not need {name!r} (its result would go unrequired)"
            for name in missing
        )
    for lint in ONCE:
        running = [name for name, lines in every.items() if any(lint in line for line in lines)]
        if MATRIX_JOB in running:
            found.append(f"{CI}: {lint!r} runs in the matrix job {MATRIX_JOB!r} (once per shard)")
        if len(running) != 1:
            found.append(
                f"{CI}: {lint!r} runs in {len(running)} jobs ({', '.join(running)}), not exactly one"
            )
    return found + serial_problems(root, text) + node_problems(root, text)


# --- serial tests (signals and process groups fail under xdist) -----------------------------------

SENDS_SIGNAL = re.compile(
    r"\bos\.kill(?:pg)?\(|\bsignal\.(?:signal|raise_signal|pthread_kill|pthread_sigmask|sigpending)\("
    r"|\bsend_signal\(|\bgetpgid\(|\bstart_new_session\b|\bkillpg\("
)


def is_marked_serial(body: str) -> bool:
    """Whether the source names `pytest.mark.serial` anywhere (a `pytestmark` list, a decorator)."""
    try:
        tree = ast.parse(body)
    except SyntaxError:
        return False
    return any(
        isinstance(node, ast.Attribute)
        and node.attr == "serial"
        and isinstance(node.value, ast.Attribute)
        and node.value.attr == "mark"
        for node in ast.walk(tree)
    )


def _runs_on(condition: str | None, shard: str) -> bool:
    """A step's `if:` for this shard (`matrix.shard ==/!= '<name>'`, && || ! and parentheses); one
    this cannot read counts as not running, so the file it names is reported."""
    if condition is None:
        return True
    text = condition.strip().removeprefix("${{").removesuffix("}}").strip()
    text = re.sub(
        r"matrix\.shard\s*(==|!=)\s*'([^']*)'",
        lambda m: f" {(shard == m.group(2)) == (m.group(1) == '==')} ",
        text,
    )
    text = re.sub(r"\b(?:always|success)\(\)", " True ", text)
    text = text.replace("&&", " and ").replace("||", " or ")
    text = re.sub(r"!(?!=)", " not ", text)
    tokens = re.findall(r"[()]|[^\s()]+", text)
    if not set(tokens) <= {"True", "False", "and", "or", "not", "(", ")"}:
        return False
    try:
        return bool(eval(" ".join(tokens), {"__builtins__": {}}))
    except SyntaxError:
        return False


def _carries_workers(words: list[str]) -> bool:
    """Whether a pytest line asks for xdist: -n, --numprocesses, -d or --dist, in any spelling."""
    return any(
        word in ("-d", "--dist")
        or word.startswith(("--numprocesses", "--dist="))
        or (word.startswith("-n") and not word.startswith("--"))
        for word in words
    )


def serial_runs(text: str, shards: list[str]) -> set[str]:
    """The arguments of every non-comment pytest line, in a step of the python job whose `if:` holds on
    a shard that exists, whose `-m` selects serial tests and which carries no worker flag."""
    named: set[str] = set()
    steps: list[tuple[str | None, list[str]]] = []
    for line in jobs(text).get(MATRIX_JOB, []):
        if line.lstrip().startswith("- "):
            steps.append((None, []))
        if not steps:
            continue
        body = line.lstrip().removeprefix("- ").strip()
        if body.startswith("if:"):
            steps[-1] = (body.removeprefix("if:").strip(), steps[-1][1])
        elif PYTEST.search(line):
            steps[-1][1].append(line)
    for condition, lines in steps:
        if not any(_runs_on(condition, shard) for shard in shards):
            continue
        for line in lines:
            try:
                words = shlex.split(line.split("pytest", 1)[1])
            except ValueError:
                continue
            marks = [words[at + 1] for at, word in enumerate(words[:-1]) if word == "-m"]
            if any(re.match(r"\s*serial\b", mark) for mark in marks) and not _carries_workers(words):
                named.update(word for word in words if not word.startswith("-"))
    return named


def serial_problems(root: Path, text: str) -> list[str]:
    """Each test file (acceptance folders aside: they cannot be edited) that sends a signal carries
    `pytest.mark.serial`, and each file so marked is an argument of a `ci.yml` pytest run whose `-m`
    selects serial (a path in a comment or a parallel step does not count). The mark is read per file."""
    try:
        files = test_files(root, testpaths(root))
    except OSError, KeyError, TypeError, ValueError:
        return []  # shard_problems already reports an unreadable testpaths
    try:
        run = serial_runs(text, [shard.name for shard in load(root)])
    except Malformed:
        return []  # shard_problems already reports an unreadable shard file
    found: list[str] = []
    for path in files:
        if "/acceptance/" in path:
            continue
        body = (root / path).read_text(errors="replace")
        marked = is_marked_serial(body)
        if SENDS_SIGNAL.search(body) and not marked:
            found.append(f"{path}: sends a signal, not marked pytest.mark.serial (xdist breaks it)")
        if marked and path not in run:
            found.append(
                f"{path}: marked serial but {CI} has no serial run naming it (it would be deselected)"
            )
    return found


# --- node tests ------------------------------------------------------------------------------------


def node_patterns(text: str) -> tuple[list[str], list[str]]:
    """The `node --test` arguments in `ci.yml`, and the problems with their form."""
    patterns: list[str] = []
    found: list[str] = []
    lines = [line for line in map(_code, text.splitlines()) if "node --test" in line]
    if not lines:
        found.append(f"{CI}: no `node --test` step (CI must run every node test)")
    for line in lines:
        rest = line.split("node --test", 1)[1]
        try:
            words = shlex.split(rest)
        except ValueError:
            found.append(f"{CI}: unreadable node --test line: {line.strip()}")
            continue
        raw = rest.split()
        for word in words:
            if word.startswith("-"):
                continue
            if word.endswith("/") or ("*" not in word and not word.endswith(".mjs")):
                found.append(
                    f"{CI}: node --test {word}: a directory argument (Node 24 runs it as a file"
                    " and fails); use a quoted glob"
                )
            elif "*" in word and word in raw:
                found.append(
                    f"{CI}: node --test {word}: an unquoted glob (the shell expands it); quote it"
                )
            else:
                patterns.append(word)
    return patterns, found


def full_match(path: str, pattern: str) -> bool:
    """`PurePath.full_match` (Python 3.13+), with the same `**` rule on an older `python3`."""
    pure = PurePath(path)
    if hasattr(pure, "full_match"):
        return bool(pure.full_match(pattern))
    parts = []
    for segment in pattern.split("/"):
        if segment == "**":
            parts.append("(?:[^/]+/)*")
        else:
            body = "".join(
                "[^/]*" if c == "*" else "[^/]" if c == "?" else re.escape(c) for c in segment
            )
            parts.append(body + "/")
    return re.fullmatch("".join(parts).removesuffix("/"), path) is not None


def node_problems(root: Path, text: str) -> list[str]:
    patterns, found = node_patterns(text)
    listed = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--", "*.test.mjs"],
        capture_output=True,
        text=True,
        check=False,
    )
    if listed.returncode != 0:
        return [*found, f"cannot list the node tests with git ({listed.stderr.strip()})"]
    for name in listed.stdout.split():
        if not name.startswith(NODE_ROOTS):
            continue
        if not any(full_match(name, pattern) for pattern in patterns):
            found.append(f"{name}: a node test the harness step's `node --test` does not run")
    return found


# --- the flaky list --------------------------------------------------------------------------------


def flaky_problems(root: Path) -> list[str]:
    """`.github/flaky.txt`: `<repo path> :: <test title>` lines; each path exists and holds the title."""
    try:
        text = (root / FLAKY).read_text()
    except OSError as error:
        return [f"{FLAKY}: unreadable ({error})"]
    found: list[str] = []
    for number, line in enumerate(text.splitlines(), start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        path, sep, title = (part.strip() for part in line.partition(" :: "))
        if not sep or not path or not title:
            found.append(f"{FLAKY}:{number}: not `<repo path> :: <test title>`")
            continue
        target = root / path
        if ".." in PurePath(path).parts or not target.is_file():
            found.append(f"{FLAKY}:{number}: {path} does not exist")
        elif title not in target.read_text(errors="replace"):
            found.append(f"{FLAKY}:{number}: {path} has no test titled {title!r}")
    return found


# --- what pytest collects --------------------------------------------------------------------------

INHERITED = ("PYTEST_ADDOPTS", "PYTEST_XDIST_WORKER", "PYTEST_XDIST_WORKER_COUNT", "PYTEST_CURRENT_TEST")
NO_TESTS = 5  # pytest's exit status for "collected nothing": a shard with no test is not an error


def _collect(root: Path, args: list[str]) -> tuple[set[str], str | None]:
    """The node ids `pytest --collect-only -q <args>` finds in `root`, or why it could not."""
    env = {key: value for key, value in os.environ.items() if key not in INHERITED}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    done = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "-p", "no:cacheprovider", *args],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if done.returncode not in (0, NO_TESTS):
        tail = (done.stdout + done.stderr).strip().splitlines()[-3:]
        return set(), f"pytest exited {done.returncode} ({' | '.join(tail)})"
    return {line for line in done.stdout.splitlines() if "::" in line and not line[0].isspace()}, None


def collected_problems(root: Path) -> list[str]:
    """Each node id collected by two shards (naming both) or by none, measured against what pytest
    collects with no arguments (the `testpaths`). A collection error is a problem, never a pass."""
    try:
        shards = load(root)
        testpaths(root)
    except Malformed as error:
        return str(error).splitlines()
    except (OSError, KeyError, TypeError, ValueError) as error:
        return [f"pyproject.toml: no readable testpaths ({error})"]
    runs: list[tuple[str, list[str]]] = [("all testpaths", [])]
    runs += [(f"shard {shard.name!r}", shard.args()) for shard in shards]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda run: _collect(root, run[1]), runs))
    found = [
        f"{name}: collection failed: {why}"
        for (name, _), (_, why) in zip(runs, results, strict=True)
        if why
    ]
    if found:
        return found
    everything, per_shard = results[0][0], results[1:]
    owners: dict[str, list[str]] = {}
    for shard, (ids, _) in zip(shards, per_shard, strict=True):
        for node in ids:
            owners.setdefault(node, []).append(shard.name)
    for node in sorted(everything | owners.keys()):
        names = owners.get(node, [])
        if len(names) > 1:
            found.append(f"{node}: collected by more than one shard ({', '.join(names)})")
        elif not names:
            found.append(f"{node}: collected by no shard (CI would never run it)")
    return found


def timings(root: Path) -> dict[str, float]:
    """`.github/ci-timings.json`: `{"version": 1, "files": {<test file>: <seconds>}}`, as CI's JUnit
    report gives them (`tools.lint.slow_files`). Raises `Malformed` (fails closed)."""
    try:
        data = json.loads((root / TIMINGS).read_text())
    except (OSError, ValueError) as error:
        raise Malformed(f"{TIMINGS}: unreadable ({error})") from None
    files = data.get("files") if isinstance(data, dict) else None
    if not isinstance(files, dict) or not files:
        raise Malformed(f"{TIMINGS}: no files object")
    seconds: dict[str, float] = {}
    for path, value in files.items():
        if isinstance(value, bool) or not isinstance(value, int | float) or value < 0:
            raise Malformed(f"{TIMINGS}: {path!r}: {value!r} is not a number of seconds")
        seconds[str(path)] = float(value)
    return seconds


def predicted(root: Path, shards: list[Shard], seconds: dict[str, float]) -> dict[str, float]:
    """Each shard's predicted wall: the files it owns, a file marked serial in full and every other
    divided by the workers. A file the timing file does not name counts 0."""
    wall = {shard.name: 0.0 for shard in shards}
    for path, value in seconds.items():
        owners = [shard for shard in shards if shard.owns(path)]
        if not owners:
            continue
        try:
            serial = is_marked_serial((root / path).read_text(errors="replace"))
        except OSError:
            serial = False
        wall[owners[0].name] += value if serial else value / WORKERS
    return wall


def _untimed_serial(root: Path, shards: list[Shard], seconds: dict[str, float]) -> list[str]:
    """Each test file marked serial that a shard owns and the timing file does not name: a serial file
    is the one kind counted in full, so a plan that drops it understates its shard (S29-F1 fix round)."""
    try:
        paths = test_files(root, testpaths(root))
    except OSError, KeyError, ValueError, tomllib.TOMLDecodeError:
        return []
    found: list[str] = []
    for path in paths:
        if path in seconds or not any(shard.owns(path) for shard in shards):
            continue
        try:
            serial = is_marked_serial((root / path).read_text(errors="replace"))
        except OSError:
            continue
        if serial:
            found.append(
                f"{TIMINGS}: {path}: marked serial but has no timing (counted in full, so a plan "
                "without it understates its shard; rebuild from the shard's serial JUnit report too)"
            )
    return found


def balance_problems(root: Path) -> list[str]:
    try:
        shards, seconds = load(root), timings(root)
    except Malformed as error:
        return [str(error)]
    found = [
        f"{TIMINGS}: {path}: no such test file (a stale plan; rebuild it from a JUnit report)"
        for path in sorted(seconds)
        if not (root / path).is_file()
    ]
    found.extend(_untimed_serial(root, shards, seconds))
    found.extend(
        f"shard {name!r}: predicted {value:.0f} s, over {BOUND_SECONDS:.0f} s; move files in {SHARDS}"
        for name, value in predicted(root, shards, seconds).items()
        if value > BOUND_SECONDS
    )
    return found


def problems(root: Path) -> list[str]:
    return shard_problems(root) + workflow_problems(root) + flaky_problems(root)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    command, rest = (args[0], args[1:]) if args else ("check", [])
    root = Path.cwd()
    if command == "check" and len(rest) <= 1:
        found = problems(Path(rest[0]) if rest else root)
        for problem in found:
            print(problem)
        return 1 if found else 0
    if command == "collected" and len(rest) <= 1:
        found = collected_problems(Path(rest[0]).resolve() if rest else root)
        for problem in found:
            print(problem)
        return 1 if found else 0
    if command == "balance" and len(rest) <= 1:
        found = balance_problems(Path(rest[0]).resolve() if rest else root)
        for problem in found:
            print(problem)
        return 1 if found else 0
    if command in ("matrix", "args"):
        try:
            shards = load(root)
        except Malformed as error:
            print(error, file=sys.stderr)
            return 1
        if command == "matrix" and not rest:
            print(
                json.dumps(
                    {"include": [{"shard": shard.name} for shard in shards]}, separators=(",", ":")
                )
            )
            return 0
        if command == "args" and len(rest) == 1:
            chosen = [shard for shard in shards if shard.name == rest[0]]
            if not chosen:
                print(f"no shard named {rest[0]!r} in {SHARDS}", file=sys.stderr)
                return 1
            print(" ".join(chosen[0].args()))
            return 0
    usage = "[check [root] | collected [root] | balance [root] | matrix | args <name>]"
    print(f"usage: python -m tools.lint.ci_shards {usage}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
