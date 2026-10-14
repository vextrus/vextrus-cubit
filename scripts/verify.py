"""`python -m scripts.verify`: the fast check for the changed paths, on the staged tree
(docs/specs/factory.md 2.2 "Builder's finish", 3.4 "verify";
`docs/specs/factory/contracts/verify-record.schema.json`).

It refuses (exit 2) while tracked files differ between the worktree and the index: what it checks is
exactly the tree `git write-tree` names, which the next commit will carry. It maps the changed paths
(staged against HEAD, plus the commits since the merge base with `origin/main`) to checks, runs them (the
web checks in order, the rest concurrently, pytest on a bounded `-n` count: `VEXTRUS_VERIFY_WORKERS`),
keeps each one's output under `.private/work/verify/<tree>/`, and
writes `<git-common-dir>/vextrus/verify-<tree>.json` (the guard's READY push gate reads it). Only when
every check passed does its last line read `Factory-Verify: <tree> ok`, the builder's trailer. First
it leak-scans `<merge-base>..<the staged tree>` (never stamped; #412) where a corpus is present: a hit
names its locations, writes no record and exits 1, so a local builder learns of it before READY.

A check that fails only on tests listed in `.github/flaky.txt` (`<repo path> :: <test title>` per line)
is run once more; if that passes it is recorded `exit_code` 0 with `raw_exit_code` and `flakes`.
A check run as root (uid 0, a cloud container) whose every failing test is listed in
`.github/flaky-root.txt` (the same line format) is not rerun: it is recorded `exit_code` 0 with
`raw_exit_code` and `root_only` naming the listed lines, and its `verify:` line says `root-only`. That
holds only when the run's own counts agree (see `root_only_in`): exit code 1, the summary's failed count
(pytest's, or vitest's `Tests` line) equal to the listed failure lines, no errors, and no "acceptance
tests that did not run" section; otherwise the command's exit code stands. An entry names a test
exactly: `<path>::<title>` followed by `[`, a space or the end of the line (a vitest line: the title
ends the line).
A `web-test` that fails with every failing test's error vitest's `Error: Test timed out in <n>ms.` line
(the counts agreeing, see `timed_out_files`) has each such file run again alone, `--maxWorkers=1`, as its
own `web-test-rerun` check; it passes only if every re-run passes, and any other failure stands.
`web-test-slowed` is CI's second pass: `web-test` with `VITE_FAKE_API_LATENCY_MS` read from
`.github/workflows/web.yml`; its timed-out files are re-run alone the same way, latency kept.
Each check's record keeps its `started_at` and `ended_at` (its re-runs included), and the record its
`mode`.

`--fast` (S29-F2a; the owner's Q3: "a fast verify before READY; CI is the full gate") plans less:
pytest on the changed modules and the modules importing them (`fast_targets`, read from the files under
the root), never an unrelated module or the whole suite; ruff and mypy on the changed Python files;
`web-test` on the changed web files' tests alone; no `web-test-slowed` (CI runs it). Its test checks
carry `VEXTRUS_TIME_SCALE` (`time_scale`), which `vextrus.testing.timing` and the web tests' timeouts
read. A fast pass prints `Verify-Mode: fast` on the line before the unchanged trailer.
The caller wraps it in an explicit timeout. Exit codes: 0 every check passed, 1 one failed, 2 refused.
"""

import ast
import hashlib
import json
import os
import re
import shlex
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
from collections.abc import Callable, Iterable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from scripts.factory import leakwhere
from tools.lint.acceptance import is_acceptance

PYTHON = re.compile(r"\.pyi?$|^(?:pyproject\.toml|uv\.lock|\.importlinter)$")
WEB_SCHEMA = ".private/work/verify/openapi.json"
FLAKY = ".github/flaky.txt"
FLAKY_ROOT = ".github/flaky-root.txt"
WEB_YML = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "web.yml"
LATENCY_KEY = "VITE_FAKE_API_LATENCY_MS"
LATENCY_SETTING = re.compile(rf"^\s*{LATENCY_KEY}:\s*[\"']?(\d+)[\"']?\s*$", re.M)
SLOWED = "web-test-slowed"
PYTEST_FAILURE = re.compile(r"^(?:FAILED|ERROR) (\S.*)$")
VITEST_FAILURE = re.compile(r"^\s*FAIL\s+(\S.*)$")
SUMMARY_LINE = re.compile(r"^=*\s*\d+ \w.*\bin \d+(?:\.\d+)?s\b")
VITEST_SUMMARY = re.compile(r"^\s+Tests\s+\d")
NOT_RUN_SECTION = "acceptance tests that did not run"
VITEST_FAIL_FILE = re.compile(r"^\s*FAIL\s+(?:\|[^|]*\|\s+)?(\S+)\s+>\s")
VITEST_TIMEOUT = re.compile(r"^Error: Test timed out in \d+ms\.\s*$")


@dataclass(frozen=True)
class Check:
    name: str
    argv: tuple[str, ...]
    env: dict[str, str] = field(default_factory=dict)

    @property
    def command(self) -> str:
        return shlex.join([*(f"{key}={value}" for key, value in self.env.items()), *self.argv])[:500]


Run = Callable[[Check], tuple[int, str]]
Have = Callable[[str], bool]


def _have(tool: str) -> bool:
    return shutil.which(tool) is not None


def pytest_target(path: str) -> str | None:
    """The test folder a Python path belongs to: its module (`vextrus/<m>`, `engine/<m>`, `tools/<m>`),
    `scripts`, or the whole suite (`.`) for the shared configuration."""
    parts = path.split("/")
    if parts[0] in ("vextrus", "engine", "tools") and len(parts) > 2:
        return "/".join(parts[:2])
    if parts[0] == "scripts":
        return "scripts"
    if parts[0] in ("vextrus", "engine", "tools") or PYTHON.search(path):
        return "."
    return None


LINT_TESTS = "tools/lint/tests"
WEB_CHAIN = (
    "openapi-export",
    "api-types",
    "typecheck",
    "lint",
    "messages-check",
    "web-test",
    "web-test-slowed",
)
# The checks that read the exported schema run after it, in its chain (#709: contract-fixtures raced
# openapi-export when it ran as its own chain).
SCHEMA_CHAIN = (*WEB_CHAIN, "contract-fixtures")


def chains_of(checks: list[Check]) -> list[list[tuple[int, Check]]]:
    """The schema's checks keep their plan order in one chain; every other check is its own chain."""
    indexed = list(enumerate(checks))
    chained = set(SCHEMA_CHAIN)
    chains = [[ic for ic in indexed if ic[1].name in chained]]
    chains += [[ic] for ic in indexed if ic[1].name not in chained]
    return [chain for chain in chains if chain]


LOCAL_WORKERS = 6
CLOUD_WORKERS = 4


def pytest_workers() -> int:
    """The xdist worker count, read from the environment on every call: `VEXTRUS_VERIFY_WORKERS`
    (0 or 1 = serial), else 4 in a cloud session (`CLAUDE_CODE_REMOTE=true`), else 6. Never `auto`: it
    starts a worker per core (24 here, ~9 GB)."""
    given = os.environ.get("VEXTRUS_VERIFY_WORKERS", "").strip()
    if not given:
        return CLOUD_WORKERS if os.environ.get("CLAUDE_CODE_REMOTE") == "true" else LOCAL_WORKERS
    if not given.isdigit():
        raise SystemExit(f"verify: VEXTRUS_VERIFY_WORKERS must be a whole number, not {given!r}")
    return int(given)


def pytest_checks(targets: list[str], workers: int) -> list[Check]:
    """The pytest runs for these folders (none: the whole suite). `tools/lint/tests` runs in its own
    serial invocation while #585 is open (a full xdist run fails 27 acceptance-lint tests)."""
    base = ("uv", "run", "pytest", "-rf")
    plugin = ("-p", "tools.lint.acceptance_pytest")
    if workers <= 1:
        return [Check("pytest", (*base, *plugin, *targets))]
    lint = LINT_TESTS in targets or not targets or "tools/lint" in targets
    # A fast plan may name single files; one under tools/lint/tests runs in the serial run too.
    lint_files = [t for t in targets if t.startswith(f"{LINT_TESTS}/")]
    rest = [t for t in targets if t != "tools/lint" and t not in lint_files]
    checks: list[Check] = []
    if rest or not targets:
        # Named even with folders given, so the parallel run states what it leaves to the serial one.
        ignore = ("--ignore", LINT_TESTS) if lint else ()
        checks.append(Check("pytest", (*base, "-n", str(workers), *ignore, *plugin, *rest)))
    if lint:
        checks.append(Check("pytest-lint", (*base, *plugin, LINT_TESTS)))
    elif lint_files:
        checks.append(Check("pytest-lint", (*base, *plugin, *lint_files)))
    return checks


TIME_SCALE = "VEXTRUS_TIME_SCALE"
TIME_SCALE_CAP = 4.0
"""At most this factor, so `vextrus.testing.timing`'s 0.5 s act bound (x max(3, factor)) stays under
the 3 s lock_timeout it must still catch."""


def time_scale() -> float:
    """The machine's slowdown factor for the fast plan's test checks: `VEXTRUS_TIME_SCALE` when given,
    else the one-minute load average per CPU; never below 1.0 nor above `TIME_SCALE_CAP`."""
    given = os.environ.get(TIME_SCALE, "").strip()
    try:
        factor = float(given) if given else os.getloadavg()[0] / (os.cpu_count() or 1)
    except ValueError, OSError:
        factor = 1.0
    if factor != factor:  # NaN
        factor = 1.0
    return round(min(TIME_SCALE_CAP, max(1.0, factor)), 2)


PYTHON_ROOTS = ("vextrus", "engine", "tools", "scripts")
SKIPPED_DIRS = frozenset({"__pycache__", "node_modules", "migrations"})


def dotted(path: str) -> str | None:
    """A repo path's module name (`vextrus/alpha/rules.py`: `vextrus.alpha.rules`), or None."""
    if not path.endswith((".py", ".pyi")):
        return None
    parts = path.rsplit(".", 1)[0].split("/")
    if parts[-1] == "__init__":
        parts = parts[:-1]
    if not parts or not all(part.isidentifier() for part in parts):
        return None
    return ".".join(parts)


def is_test_file(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    return name.endswith(".py") and (name.startswith("test_") or name.endswith("_test.py"))


def imported_by(path: str, text: str) -> set[str]:
    """The module names a Python file imports: `import a.b`, `from a import b` (both `a` and `a.b`),
    relative imports resolved from its package, and `importlib.import_module("a.b")` with a literal."""
    try:
        tree = ast.parse(text)
    except SyntaxError, ValueError:
        return set()
    own = dotted(path) or ""
    package = own.split(".") if path.endswith(("__init__.py", "__init__.pyi")) else own.split(".")[:-1]
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:
                anchor = package[: len(package) - (node.level - 1)] if node.level > 1 else package
                base = ".".join([*anchor, *([base] if base else [])])
            if base:
                found.add(base)
            found.update(f"{base}.{alias.name}" if base else alias.name for alias in node.names)
        elif (
            isinstance(node, ast.Call)
            and (
                (isinstance(node.func, ast.Attribute) and node.func.attr == "import_module")
                or (isinstance(node.func, ast.Name) and node.func.id == "import_module")
            )
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            found.add(node.args[0].value)
    return found


def python_files(root: Path) -> list[str]:
    """The Python files under the root's code folders and at its top, as repo paths."""
    found = [p.name for p in root.glob("*.py") if p.is_file()]
    for top in PYTHON_ROOTS:
        for folder, dirs, files in os.walk(root / top):
            dirs[:] = [d for d in dirs if d not in SKIPPED_DIRS and not d.startswith(".")]
            relative = Path(folder).relative_to(root).as_posix()
            found += [f"{relative}/{name}" for name in files if name.endswith((".py", ".pyi"))]
    return sorted(found)


def fast_unit(path: str) -> str | None:
    """What a fast plan runs for one Python file of the change, before its importers: a test file
    itself; a conftest's or a test helper's folder; `scripts/<sub>` for a scripts package; the module
    (`vextrus/<m>`, `engine/<m>`, `tools/<m>`); None for a top-level scripts file (its importing tests
    stand for it) and for the shared configuration (CI runs the whole suite for it)."""
    if is_test_file(path):
        return path
    parts = path.split("/")
    folder = "/".join(parts[:-1])
    if parts[-1] == "conftest.py" or "tests" in parts[:-1]:
        return folder if len(parts) > 2 else None
    if parts[0] == "scripts":
        return folder if len(parts) > 2 else None
    target = pytest_target(path)
    return None if target in (None, ".") else target


def fast_targets(python: list[str], root: Path) -> tuple[list[str], list[str]]:
    """The pytest targets of a fast plan and a note for each change left to CI. Each changed file's
    `fast_unit`, and each file importing a changed module (read under `root`): a test file itself, any
    other its `fast_unit`; a test file importing a selected test file is selected too. A top-level
    scripts file nothing imports runs `scripts` (the full plan's target)."""
    changed = {name: path for path in python if (name := dotted(path))}
    texts: dict[str, set[str]] = {}
    for path in python_files(root):
        try:
            texts[path] = imported_by(path, (root / path).read_text())
        except OSError, UnicodeDecodeError:
            continue

    def importers(names: set[str]) -> set[str]:
        return {
            path
            for path, imports in texts.items()
            if any(i == n or i.startswith(f"{n}.") for i in imports for n in names)
        }

    targets: set[str] = set()
    notes: list[str] = []
    for path in python:
        unit = fast_unit(path)
        if unit is not None:
            targets.add(unit)
    tests: set[str] = set()
    for importer in importers(set(changed)) - set(python):
        if is_test_file(importer):
            tests.add(importer)
        elif (unit := fast_unit(importer)) is not None:
            targets.add(unit)
    # Test files importing selected test files (an acceptance test that imports another's helpers).
    frontier = {t for t in {*tests, *targets} if is_test_file(t)}
    while frontier:
        names = {name for t in frontier if (name := dotted(t))}
        frontier = {i for i in importers(names) if is_test_file(i)} - tests - targets
        tests |= frontier
    targets |= tests
    for path in python:
        if fast_unit(path) is not None:
            continue
        name = dotted(path)
        if path.startswith("scripts/") and name is not None:
            if not importers({name}):
                targets.add("scripts")
                notes.append(f"fast: nothing imports {path}: runs scripts")
        else:
            notes.append(f"not run in fast: the whole suite for {path} (CI runs it)")
    # A file or folder inside a selected folder is run by it.
    kept = sorted(t for t in targets if not any(t != o and t.startswith(f"{o}/") for o in targets))
    return kept, notes


WEB_TEST_SUFFIXES = (".test.tsx", ".test.ts", ".node.test.ts", ".browser.test.ts")
WEB_TEST_FILE = re.compile(r"\.(?:node\.|browser\.)?test\.tsx?$")


def fast_web_tests(paths: list[str], root: Path) -> list[str]:
    """The web test files (relative to `web/`) a fast plan names: each changed test file, and each
    changed source file's own tests beside it (`Panel.tsx`: `Panel.test.tsx`, ...)."""
    found: list[str] = []
    for path in paths:
        if not path.startswith("web/") or not path.endswith((".ts", ".tsx")):
            continue
        if WEB_TEST_FILE.search(path):
            candidates = [path]
        else:
            stem = re.sub(r"\.tsx?$", "", path)
            candidates = [f"{stem}{suffix}" for suffix in WEB_TEST_SUFFIXES]
        found += [c.removeprefix("web/") for c in candidates if (root / c).is_file()]
    return sorted(set(found))


BROWSER_PORTS = 3  # one per browser project of web/vite.config.ts


def _digest(root: Path) -> str:
    return hashlib.sha256(str(root.resolve()).encode()).hexdigest()


def worktree_db_name(root: Path) -> str:
    """A database base name: the checkout folder's name and a hash of its whole resolved path."""
    slug = re.sub(r"[^a-z0-9]+", "_", root.resolve().name.lower()).strip("_")[:20]
    return f"vextrus_{slug}_{_digest(root)[:10]}"


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def ci_latency() -> str:
    """CI's slowed-fake latency, read from web.yml when verify runs (it cannot drift)."""
    found = LATENCY_SETTING.findall(WEB_YML.read_text())
    if len(found) != 1:
        raise SystemExit(f"verify: {WEB_YML} must set {LATENCY_KEY} exactly once, found {len(found)}")
    return str(found[0])


def vitest_port(root: Path) -> int:
    """The first of a block of three free ports, begun at a slot the root's hash picks."""
    start = (int(_digest(root)[:8], 16) % 10000) * BROWSER_PORTS
    for step in range(200):
        first = 20000 + (start + step * BROWSER_PORTS) % 30000
        if all(_port_free(first + k) for k in range(BROWSER_PORTS)):
            return first
    return 20000 + start


CI_WORKFLOW = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "ci.yml"
NODE_TEST_ROOTS = (".claude/", "scripts/", "tools/mod/", ".github/", "docs/")
"""The folders node tests can read; a root-level file (CLAUDE.md, CONTEXT.md ...) is read too."""


def reads_node_tests(path: str) -> bool:
    return path.startswith(NODE_TEST_ROOTS) or "/" not in path


def ci_node_command(workflow: Path = CI_WORKFLOW) -> tuple[str, ...]:
    """The argv of the one `run: node --test ...` step of ci.yml's `harness` job (quoted globs: Node 24
    runs a directory argument as a file)."""
    lines = workflow.read_text().splitlines()
    if "  harness:" not in lines:
        raise SystemExit("verify: ci.yml's harness job has 0 `node --test` steps, not one")
    start = lines.index("  harness:")
    end = next(
        (
            i
            for i in range(start + 1, len(lines))
            if lines[i].startswith("  ") and lines[i][2:3].isalpha()
        ),
        len(lines),
    )
    commands = [
        shlex.split(line.strip().removeprefix("- ").removeprefix("run:").strip(), comments=True)
        for line in lines[start:end]
        if line.strip().removeprefix("- ").startswith("run: node --test")
    ]
    if len(commands) != 1:
        raise SystemExit(
            f"verify: ci.yml's harness job has {len(commands)} `node --test` steps, not one"
        )
    return tuple(commands[0])


WORDS_INPUTS = frozenset({"tools/lint/words.py", "tools/lint/words_allowlist.toml"})
"""What the words lint reads besides `web/`'s catalogues."""


def plan_with_notes(
    paths: Iterable[str],
    *,
    have: Have = _have,
    root: Path | None = None,
    fast: bool = False,
    scale: float | None = None,
) -> tuple[list[Check], list[str]]:
    """The checks for these changed paths, in run order, and a note for each check left out. `root` is
    the checkout's root (default: the current folder): the schema path is absolute because `api:types`
    runs from `web/`. `fast` plans the fast verify (the module docstring), its test checks carrying
    `scale` (default: `time_scale()`) as `VEXTRUS_TIME_SCALE`."""
    paths = sorted(set(paths))
    root = Path.cwd() if root is None else root
    schema = str(root.resolve() / WEB_SCHEMA)
    timed = {TIME_SCALE: str(time_scale() if scale is None else scale)} if fast else {}
    checks: list[Check] = []
    notes: list[str] = []
    python = [p for p in paths if PYTHON.search(p)]
    if python and fast:
        targets, said = fast_targets(python, root)
        notes += said
        db = {"VEXTRUS_DB_NAME": worktree_db_name(root), **timed}
        if targets:
            checks += [
                Check(c.name, c.argv, {**c.env, **db}) for c in pytest_checks(targets, pytest_workers())
            ]
        files = [p for p in python if p.endswith((".py", ".pyi")) and (root / p).is_file()]
        # A changed configuration (pyproject.toml, uv.lock, .importlinter) changes what they check.
        whole = any(not p.endswith((".py", ".pyi")) for p in python)
        named: tuple[str, ...] = (".",) if whole else tuple(files)
        if named:
            checks += [
                Check("ruff", ("uv", "run", "ruff", "check", *named)),
                Check("ruff-format", ("uv", "run", "ruff", "format", "--check", *named)),
                Check("mypy", ("uv", "run", "mypy", *([] if whole else files))),
            ]
        checks.append(Check("lint-imports", ("uv", "run", "lint-imports")))
    elif python:
        targets = sorted({target for p in python if (target := pytest_target(p)) is not None})
        if "." in targets:
            targets = []
        checks += [
            *(
                Check(c.name, c.argv, {**c.env, "VEXTRUS_DB_NAME": worktree_db_name(root)})
                for c in pytest_checks(targets, pytest_workers())
            ),
            Check("ruff", ("uv", "run", "ruff", "check", ".")),
            Check("ruff-format", ("uv", "run", "ruff", "format", "--check", ".")),
            Check("mypy", ("uv", "run", "mypy")),
            Check("lint-imports", ("uv", "run", "lint-imports")),
        ]
    web = any(p.startswith("web/") for p in paths)
    if web or WORDS_INPUTS.intersection(paths):
        # CI's web job runs it (.github/workflows/web.yml "Words lint").
        checks.append(Check("words-lint", ("uv", "run", "python", "-m", "tools.lint.words")))
    fixtures = web or any(is_acceptance(p) for p in paths)
    if web:
        # The cloud web order: `npm test` fails at import without the generated API types and the
        # route tree, so the schema is exported and the types generated before typecheck (which runs
        # `tsr generate`).
        export = ("uv", "run", "manage.py", "export_openapi_schema", "--api", "vextrus.api.api")
        checks += [
            Check("openapi-export", (*export, "--output", schema)),
            Check(
                "api-types", ("npm", "--prefix", "web", "run", "api:types"), {"OPENAPI_SCHEMA": schema}
            ),
            Check("typecheck", ("npm", "--prefix", "web", "run", "typecheck")),
            Check("lint", ("npm", "--prefix", "web", "run", "lint")),
            Check("messages-check", ("npm", "--prefix", "web", "run", "messages:check")),
        ]
        port = {"VEXTRUS_VITEST_PORT": str(vitest_port(root))}
        if not fast:
            checks += [
                Check("web-test", ("npm", "--prefix", "web", "test"), port),
                # CI's second pass (web.yml): every FakeApi answer waits, so a latency race fails here.
                Check(
                    SLOWED,
                    ("npm", "--prefix", "web", "test"),
                    {**port, LATENCY_KEY: ci_latency()},
                ),
            ]
        elif named_tests := fast_web_tests(paths, root):
            # The changed files' own tests; the slowed pass and the rest of the suite are CI's.
            argv = ("npm", "--prefix", "web", "test", "--", *named_tests)
            checks.append(Check("web-test", argv, {**port, **timed}))
        else:
            notes.append("not run in fast: web-test (no test names a changed web file; CI runs it)")
    if fixtures:
        # Reply fixtures against the exported schema (S17-F5); an acceptance-only change exports it too.
        if not web:
            export = ("uv", "run", "manage.py", "export_openapi_schema", "--api", "vextrus.api.api")
            checks.append(Check("openapi-export", (*export, "--output", schema)))
        contract = ("uv", "run", "python", "-m", "tools.lint.contract_fixtures", "--schema", schema)
        checks.append(Check("contract-fixtures", contract))
    if any(reads_node_tests(p) for p in paths):
        # CI's harness step itself (S26-FX10), never a restated copy: the two cannot drift.
        checks.append(Check("node-test", ci_node_command()))
    if any(p.startswith(".claude/workflows/") for p in paths):
        checks.append(Check("workflows-js", ("python3", "-m", "tools.lint.workflows_js")))
    if any(p.startswith((".github/workflows/", ".github/actions/")) for p in paths):
        checks.append(Check("workflows", ("python3", "-m", "tools.lint.workflows")))
    plugins = sorted(
        {"/".join(p.split("/")[:3]) for p in paths if p.count("/") >= 3 and p.startswith("tools/mod/")}
    )
    for plugin in plugins:
        if not have("claude"):
            notes.append(f"not run: claude absent (plugin-validate, plugin-test for {plugin})")
            continue
        checks += [
            Check("plugin-validate", ("claude", "plugin", "validate", "--json", "--strict", plugin)),
            Check("plugin-test", ("claude", "plugin", "test", plugin)),
        ]
    return checks, notes


def plan(
    paths: Iterable[str],
    *,
    have: Have = _have,
    root: Path | None = None,
    fast: bool = False,
    scale: float | None = None,
) -> list[Check]:
    return plan_with_notes(paths, have=have, root=root, fast=fast, scale=scale)[0]


def flaky_entries(root: Path, name: str = FLAKY) -> list[tuple[str, str, str]]:
    """`.github/flaky.txt`'s (or `name`'s) entries: (the line, its path, its test title)."""
    path = root / name
    if not path.is_file():
        return []
    entries = []
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or " :: " not in line:
            continue
        where, title = (part.strip() for part in line.split(" :: ", 1))
        entries.append((line, where, title))
    return entries


def failure_lines(output: str) -> list[str]:
    """A pytest `FAILED`/`ERROR` line or a vitest `FAIL` line, each naming one failing test."""
    found = []
    for line in output.splitlines():
        if (match := PYTEST_FAILURE.match(line)) or (match := VITEST_FAILURE.match(line)):
            found.append(match[1])
    return found


def names_failure(where: str, title: str, failure: str) -> bool:
    """Whether a failure line names exactly this test: a pytest node id `<path>::<title>` followed by
    `[`, a space or the end of the line, or a vitest line (`<path> > ... > <title>`) the title ends."""
    if re.search(rf"(?:^|\s){re.escape(where)}::{re.escape(title)}(?:\[| |$)", failure):
        return True
    return (where in failure or where.removeprefix("web/") in failure) and (
        re.search(rf"(?:^|>\s){re.escape(title)}$", failure.rstrip()) is not None
    )


def flakes_in(output: str, entries: list[tuple[str, str, str]]) -> list[str] | None:
    """The listed flakes every failure line matches, or None when some failure is not listed."""
    failures = failure_lines(output)
    if not failures or not entries:
        return None
    matched: list[str] = []
    for failure in failures:
        hits = [entry for entry, where, title in entries if names_failure(where, title, failure)]
        if not hits:
            return None
        matched += [entry for entry in hits if entry not in matched]
    return matched


def root_only_in(code: int, output: str, entries: list[tuple[str, str, str]]) -> list[str] | None:
    """The `.github/flaky-root.txt` lines a run as root failed on, when those are the only reasons it
    failed, else None. A listed failure line alone excuses nothing: the run's own counts must agree.
    pytest: exit code 1, the summary's failed count equal to the FAILED lines, no errors (`-rf` drops
    ERROR lines, so a fixture or teardown error shows only in the summary's count), and no section
    naming acceptance tests that did not run (the acceptance plugin fails a run with no FAILED line).
    vitest: exit code 1, the `Tests` line's failed count equal to the FAIL lines, and no unhandled
    errors. A run with neither summary, or anything else, keeps the command's exit code."""
    if code != 1 or NOT_RUN_SECTION in output or re.search(r"^ERROR ", output, re.M):
        return None
    lines = output.splitlines()
    pytest_summary = [line for line in lines if SUMMARY_LINE.match(line)]
    vitest_summary = [line for line in lines if VITEST_SUMMARY.match(line)]
    if bool(pytest_summary) == bool(vitest_summary):
        return None
    if pytest_summary:
        counts = {
            word: int(n) for n, word in re.findall(r"(\d+) (failed|errors?)\b", pytest_summary[-1])
        }
        if counts.get("error", 0) or counts.get("errors", 0):
            return None
    else:
        if re.search(r"^\s*Errors\s+\d|Unhandled Errors", output, re.M):
            return None
        counts = {word: int(n) for n, word in re.findall(r"(\d+) (failed)\b", vitest_summary[-1])}
    if counts.get("failed", 0) != len(failure_lines(output)):
        return None
    return flakes_in(output, entries)


def timed_out_files(code: int, output: str) -> list[str] | None:
    """The test files of a failed vitest run (default reporter, either project: `|node|`,
    `|browser (chromium)|`) when every failing test's error is the timeout line right after its `FAIL`
    line (`Error: Test timed out in <n>ms.`), else None. The run's own counts must agree: exit code 1,
    the `Tests` line's failed count equal to the FAIL lines, no unhandled errors. A failure of any other
    kind, an assertion quoting the timeout text included, keeps the command's exit code."""
    if code != 1 or re.search(r"^\s*Errors\s+\d|Unhandled Errors", output, re.M):
        return None
    lines = output.splitlines()
    summary = [line for line in lines if VITEST_SUMMARY.match(line)]
    if not summary:
        return None
    failed = {word: int(n) for n, word in re.findall(r"(\d+) (failed)\b", summary[-1])}
    files: list[str] = []
    fails = 0
    for index, line in enumerate(lines):
        if not VITEST_FAILURE.match(line):
            continue
        fails += 1
        named = VITEST_FAIL_FILE.match(line)
        following = lines[index + 1] if index + 1 < len(lines) else ""
        if named is None or not VITEST_TIMEOUT.match(following):
            return None
        if named[1] not in files:
            files.append(named[1])
    if not fails or failed.get("failed", 0) != fails:
        return None
    return files


def _git(*args: str) -> str:
    done = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise SystemExit(f"verify: git {args[0]} failed: {done.stderr.strip()}")
    return done.stdout.strip()


def changed_paths() -> list[str]:
    staged = _git("diff", "--cached", "--name-only", "HEAD").splitlines()
    since: list[str] = []
    base = subprocess.run(
        ["git", "merge-base", "origin/main", "HEAD"], capture_output=True, text=True, check=False
    )
    if base.returncode == 0:
        since = _git("diff", "--name-only", base.stdout.strip(), "HEAD").splitlines()
    return sorted({*staged, *since} - {""})


def _leakscan_env(root: Path) -> dict[str, str] | None:
    """The environment for the real scanner (`python -m tools.leakscan`): this checkout's, else the
    tree holding verify; None when neither has one. Verify's record gates READY, so no environment
    variable chooses the scanner (`VEXTRUS_LEAKSCAN_CMD` is the watcher's read-only seam alone)."""
    own = Path(__file__).resolve().parents[1]
    trees = [tree for tree in (root, own) if (tree / "tools" / "leakscan" / "__main__.py").is_file()]
    if not trees:
        return None
    paths = [str(trees[0]), *filter(None, os.environ.get("PYTHONPATH", "").split(os.pathsep))]
    return {**os.environ, "PYTHONPATH": os.pathsep.join(paths)}


def remedy(root: Path, sha: str, staged: str) -> str:
    """What clears a hit in this commit: a pushed commit is never rewritten (the guard refuses force
    pushes) and every commit of the range is scanned, so a new commit never clears one."""
    if sha == staged:
        return "the hit is in the staged changes, not committed: replace it before you commit"
    if leakwhere.is_pushed(root, sha):
        return (
            f"the hit is in commit {sha[:12]} (already pushed): start a fresh branch from main with the "
            "work squashed into new commits containing no hit, and push that branch; the orchestrator "
            "closes the old PR"
        )
    return (
        f"the hit is in local commit {sha[:12]}, not pushed: amend or soft-reset that commit (allowed "
        "for unpushed commits) so no commit holds it"
    )


def leak_scan(root: Path, tree: str) -> tuple[bool, list[str]]:
    """The range `<merge-base with origin/main>..<the staged tree>` leak-scanned, never stamped (#412):
    (refused, lines). The staged tree is scanned as a commit on HEAD (`git commit-tree`, an unreferenced
    object), so the READY commit's own additions are in the range. A hit refuses, naming locations and
    counts only; with no scanner, no origin/main or no corpus (a cloud session) it is a note."""
    env = _leakscan_env(root)
    argv = [sys.executable, "-m", "tools.leakscan"]
    if env is None:
        return False, ["verify: leak scan not run: no tools/leakscan here"]
    base = subprocess.run(
        ["git", "merge-base", "origin/main", "HEAD"], capture_output=True, text=True, check=False
    )
    if base.returncode != 0:
        return False, ["verify: leak scan not run: no merge base with origin/main"]
    # A fixed identity: the object is never referenced, and a missing user.name must not let the
    # staged tree go unscanned.
    who = {"NAME": "verify", "EMAIL": "verify@example.invalid"}
    identity = {
        f"GIT_{role}_{key}": value for role in ("AUTHOR", "COMMITTER") for key, value in who.items()
    }
    staged = subprocess.run(
        ["git", "commit-tree", tree, "-p", "HEAD", "-m", "verify: the staged tree"],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, **identity},
    )
    if staged.returncode != 0:
        return True, ["verify: refused: the staged tree cannot be made a commit to scan"]
    span = f"{base.stdout.strip()}..{staged.stdout.strip()}"
    done = subprocess.run(
        [*argv, "range", span, "--no-stamp", "--json"],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        check=False,
    )
    try:
        report = json.loads(done.stdout.strip().splitlines()[-1])
        summary = report["summary"]
        hits = [(str(hit["where"]), int(hit["n"])) for hit in report["hits"]]
    except IndexError, ValueError, KeyError, TypeError:
        return True, [f"verify: refused: the leak scan's report is unreadable (exit {done.returncode})"]
    status = summary.get("status")
    if status == "skipped" or (status == "cannot-scan" and summary.get("reason") == "no-corpus"):
        return False, ["verify: leak scan not run: no corpus here"]
    if status == "cannot-scan":
        return True, [f"verify: refused: the leak scan cannot scan ({summary.get('reason')})"]
    if hits or done.returncode != 0:
        # Each hit with the commit whose own added text the scanner matched (each commit alone), and
        # that commit's remedy once.
        head = staged.stdout.strip()
        attributed = leakwhere.commit_hits(root, argv, base.stdout.strip(), head, env)
        if not attributed:
            lines = [f"verify: leak hit {where} {n}" for where, n in hits]
        else:
            lines = [f"verify: leak hit {sha[:12]} {where} {n}" for sha, where, n in attributed]
            for sha in dict.fromkeys(sha for sha, _, _ in attributed):
                lines.append(f"verify: {remedy(root, sha, head)}")
        return True, [*lines, "verify: refused: no verify record written"]
    return False, [f"verify: leak scan clean (hits=0 scanned={summary.get('scanned')})"]


#: Variables that force colour into piped output. A check's output goes to a file, and tests that read
#: a child's output (node --test's counts, the acceptance lint's pytest) fail on the escapes (#585).
FORCED_COLOUR = frozenset({"FORCE_COLOR", "PY_COLORS", "CLICOLOR_FORCE", "MYPY_FORCE_COLOR"})


def run_command(check: Check) -> tuple[int, str]:
    inherited = {key: value for key, value in os.environ.items() if key not in FORCED_COLOUR}
    done = subprocess.run(
        check.argv,
        capture_output=True,
        text=True,
        check=False,
        env={**inherited, **check.env},
    )
    return done.returncode, done.stdout + done.stderr


def clamp(code: int) -> int:
    """An exit code as the record holds it (0 to 255); a signal's negative code is a failure."""
    return code if 0 <= code <= 255 else 255


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def main(
    argv: list[str] | None = None,
    *,
    run: Run = run_command,
    leak: Callable[[Path, str], tuple[bool, list[str]]] = leak_scan,
) -> int:
    args = sys.argv[1:] if argv is None else argv
    if args not in ([], ["--fast"]):
        print("usage: python -m scripts.verify [--fast] (on the staged tree)", file=sys.stderr)
        return 2
    fast = args == ["--fast"]
    if subprocess.run(["git", "diff", "--quiet"], check=False).returncode != 0:
        print(
            "verify: tracked files differ from the index: stage them (or stash them) and verify the "
            "staged tree",
            file=sys.stderr,
        )
        return 2
    root = Path(_git("rev-parse", "--show-toplevel"))
    tree = _git("write-tree")
    common = Path(_git("rev-parse", "--path-format=absolute", "--git-common-dir"))
    refused, said = leak(root, tree)
    for line in said:
        print(line, file=sys.stderr if refused else sys.stdout)
    if refused:
        return 1
    (root / WEB_SCHEMA).parent.mkdir(parents=True, exist_ok=True)
    checks, notes = plan_with_notes(changed_paths(), root=root, fast=fast)
    for note in notes:
        print(f"verify: {note}", file=sys.stderr)
    if not checks:
        checks = [Check("diff-check", ("git", "diff", "--cached", "--check", "HEAD"))]
    # Not in plan(paths): it depends on the open PRs, not the changed paths. It checks the staged tree
    # (what this commit carries) on the branch's tip; a detached HEAD is checked as `HEAD`.
    started_at = utc_now()  # before the first check starts (the measures read started_at..written_at)
    branch = _git("branch", "--show-current") or "HEAD"
    crosspr = (sys.executable, "-m", "scripts.factory.crosspr", branch, "--tree", tree)
    checks.append(Check("crosspr", crosspr))
    outputs = Path(".private/work/verify") / tree
    (root / outputs).mkdir(parents=True, exist_ok=True)
    entries = flaky_entries(root)
    root_entries = flaky_entries(root, FLAKY_ROOT)
    printing = threading.Lock()

    names = [check.name for check in checks]

    def settle(index: int, check: Check) -> dict[str, object]:
        began = utc_now()
        code, output = run(check)
        raw, flakes, root_only, reruns = code, [], [], 0
        # The cross-PR check's exit stands: no root-only or flaky excuse covers a conflict.
        excusable = check.name != "crosspr"
        if (
            code != 0
            and excusable
            and os.geteuid() == 0
            and (listed_root := root_only_in(code, output, root_entries)) is not None
        ):
            code, root_only = 0, listed_root
        elif code != 0 and excusable and (listed := flakes_in(output, entries)) is not None:
            again, rerun = run(check)
            output += f"\n--- rerun (flakes listed in {FLAKY}) ---\n{rerun}"
            if again == 0:
                code, flakes = 0, listed
            else:
                code = raw = again
        elif (
            code != 0 and check.name in ("web-test", SLOWED) and (files := timed_out_files(code, output))
        ):
            # Each timed-out file alone, vitest's workers capped: a pool under load times a slow
            # test out; only a file that passes alone is excused (the owner's Q-R3).
            codes = []
            # A fast plan's argv already names its files after `--`: the re-run names one alone.
            bare = check.argv[: check.argv.index("--")] if "--" in check.argv else check.argv
            for file in files:
                alone = Check(
                    f"{check.name}-rerun",
                    (*bare, "--", file, "--maxWorkers=1"),
                    check.env,
                )
                again, rerun = run(alone)
                output += f"\n--- rerun alone (timed out: {file}) ---\n{rerun}"
                codes.append(again)
            reruns = len(files)
            if all(c == 0 for c in codes):
                code = 0
            else:
                code = raw = next(c for c in codes if c != 0)
        ended = utc_now()  # after every re-run: the check's whole time
        stem = check.name if names.count(check.name) == 1 else f"{check.name}-{index}"
        name = outputs / f"{stem}.txt"
        (root / name).write_text(output)
        with printing:
            print(
                f"verify: {check.name} {code}"
                + (f" (flakes: {len(flakes)})" if flakes else "")
                + (f" (root-only: {len(root_only)})" if root_only else "")
                + (f" (timeout re-run alone: {reruns})" if reruns else ""),
                flush=True,
            )
        return {
            "name": check.name,
            "command": check.command,
            "exit_code": clamp(code),
            "raw_exit_code": clamp(raw),
            "flakes": flakes,
            "root_only": root_only,
            "output_file": name.as_posix(),
            "started_at": began,
            "ended_at": ended,
        }

    # The web checks keep their order (each needs the one before) in one chain; every other check is
    # its own chain, so pytest and the cheap checks run concurrently.
    chains = chains_of(checks)

    def run_chain(chain: list[tuple[int, Check]]) -> list[tuple[int, dict[str, object]]]:
        return [(index, settle(index, check)) for index, check in chain]

    with ThreadPoolExecutor(max_workers=len(chains)) as pool:
        done = list(pool.map(run_chain, chains))
    # By plan index, never by name: two checks may share one (a plugin check per changed plugin).
    pairs = sorted((pair for chain in done for pair in chain), key=lambda pair: pair[0])
    results = [result for _, result in pairs]
    ok = all(result["exit_code"] == 0 for result in results)
    record = {"schema_version": 1, "tree": tree, "written_at": utc_now(), "ok": ok, "checks": results}
    record["started_at"] = started_at
    record["mode"] = "fast" if fast else "full"
    folder = common / "vextrus"
    folder.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=folder, prefix=".verify-", suffix=".tmp")
    with os.fdopen(handle, "w") as out:
        out.write(json.dumps(record, indent=2) + "\n")
    os.replace(temporary, folder / f"verify-{tree}.json")
    if not ok:
        print(f"verify: failed; outputs under {outputs.as_posix()}/")
        return 1
    if fast:
        # A plain trailer the builder copies beside Factory-Verify (any new Factory-* key is malformed).
        print("Verify-Mode: fast")
    print(f"Factory-Verify: {tree} ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
