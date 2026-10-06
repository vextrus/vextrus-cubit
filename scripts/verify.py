"""`python -m scripts.verify`: the fast check for the changed paths, on the staged tree
(docs/specs/factory.md 2.2 "Builder's finish", 3.4 "verify";
`docs/specs/factory/contracts/verify-record.schema.json`).

It refuses (exit 2) while tracked files differ between the worktree and the index: what it checks is
exactly the tree `git write-tree` names, which the next commit will carry. It maps the changed paths
(staged against HEAD, plus the commits since the merge base with `origin/main`) to checks, runs them one
after another in the foreground, keeps each one's output under `.private/work/verify/<tree>/`, and
writes `<git-common-dir>/vextrus/verify-<tree>.json` (the guard's READY push gate reads it). Only when
every check passed does its last line read `Factory-Verify: <tree> ok`, the builder's trailer.

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
The caller wraps it in an explicit timeout. Exit codes: 0 every check passed, 1 one failed, 2 refused.
"""

import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

PYTHON = re.compile(r"\.pyi?$|^(?:pyproject\.toml|uv\.lock|\.importlinter)$")
WEB_SCHEMA = ".private/work/verify/openapi.json"
FLAKY = ".github/flaky.txt"
FLAKY_ROOT = ".github/flaky-root.txt"
PYTEST_FAILURE = re.compile(r"^(?:FAILED|ERROR) (\S.*)$")
VITEST_FAILURE = re.compile(r"^\s*FAIL\s+(\S.*)$")
SUMMARY_LINE = re.compile(r"^=*\s*\d+ \w.*\bin \d+(?:\.\d+)?s\b")
VITEST_SUMMARY = re.compile(r"^\s+Tests\s+\d")
NOT_RUN_SECTION = "acceptance tests that did not run"


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


def plan_with_notes(
    paths: Iterable[str], *, have: Have = _have, root: Path | None = None
) -> tuple[list[Check], list[str]]:
    """The checks for these changed paths, in run order, and a note for each check left out. `root` is
    the checkout's root (default: the current folder): the schema path is absolute because `api:types`
    runs from `web/`."""
    paths = sorted(set(paths))
    schema = str((Path.cwd() if root is None else root).resolve() / WEB_SCHEMA)
    checks: list[Check] = []
    notes: list[str] = []
    python = [p for p in paths if PYTHON.search(p)]
    if python:
        targets = sorted({target for p in python if (target := pytest_target(p)) is not None})
        if "." in targets:
            targets = []
        pytest = ("uv", "run", "pytest", "-rf", "-p", "tools.lint.acceptance_pytest", *targets)
        checks += [
            Check("pytest", pytest),
            Check("ruff", ("uv", "run", "ruff", "check", ".")),
            Check("ruff-format", ("uv", "run", "ruff", "format", "--check", ".")),
            Check("mypy", ("uv", "run", "mypy")),
            Check("lint-imports", ("uv", "run", "lint-imports")),
        ]
    if any(p.startswith("web/") for p in paths):
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
            Check("web-test", ("npm", "--prefix", "web", "test")),
        ]
    if any(p.startswith(".claude/hooks/") for p in paths):
        # A glob, never a folder: `node --test <dir>` fails on Node 24.
        checks.append(Check("node-test", ("node", "--test", ".claude/hooks/**/*.test.mjs")))
    if any(p.startswith(".claude/workflows/") for p in paths):
        checks.append(Check("workflows-js", ("python3", "-m", "tools.lint.workflows_js")))
        checks.append(Check("review-cutover", ("python3", "-m", "tools.lint.review_cutover")))
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


def plan(paths: Iterable[str], *, have: Have = _have, root: Path | None = None) -> list[Check]:
    return plan_with_notes(paths, have=have, root=root)[0]


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


def run_command(check: Check) -> tuple[int, str]:
    done = subprocess.run(
        check.argv,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, **check.env},
    )
    return done.returncode, done.stdout + done.stderr


def clamp(code: int) -> int:
    """An exit code as the record holds it (0 to 255); a signal's negative code is a failure."""
    return code if 0 <= code <= 255 else 255


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def main(argv: list[str] | None = None, *, run: Run = run_command) -> int:
    args = sys.argv[1:] if argv is None else argv
    if args:
        print("usage: python -m scripts.verify (on the staged tree)", file=sys.stderr)
        return 2
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
    (root / WEB_SCHEMA).parent.mkdir(parents=True, exist_ok=True)
    checks, notes = plan_with_notes(changed_paths(), root=root)
    for note in notes:
        print(f"verify: {note}", file=sys.stderr)
    if not checks:
        checks = [Check("diff-check", ("git", "diff", "--cached", "--check", "HEAD"))]
    outputs = Path(".private/work/verify") / tree
    (root / outputs).mkdir(parents=True, exist_ok=True)
    entries = flaky_entries(root)
    root_entries = flaky_entries(root, FLAKY_ROOT)
    results = []
    for check in checks:
        code, output = run(check)
        raw, flakes, root_only = code, [], []
        if (
            code != 0
            and os.geteuid() == 0
            and (listed_root := root_only_in(code, output, root_entries)) is not None
        ):
            code, root_only = 0, listed_root
        elif code != 0 and (listed := flakes_in(output, entries)) is not None:
            again, rerun = run(check)
            output += f"\n--- rerun (flakes listed in {FLAKY}) ---\n{rerun}"
            if again == 0:
                code, flakes = 0, listed
            else:
                code = raw = again
        name = outputs / f"{check.name}.txt"
        (root / name).write_text(output)
        results.append(
            {
                "name": check.name,
                "command": check.command,
                "exit_code": clamp(code),
                "raw_exit_code": clamp(raw),
                "flakes": flakes,
                "root_only": root_only,
                "output_file": name.as_posix(),
            }
        )
        print(
            f"verify: {check.name} {code}"
            + (f" (flakes: {len(flakes)})" if flakes else "")
            + (f" (root-only: {len(root_only)})" if root_only else "")
        )
    ok = all(result["exit_code"] == 0 for result in results)
    record = {"schema_version": 1, "tree": tree, "written_at": utc_now(), "ok": ok, "checks": results}
    folder = common / "vextrus"
    folder.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=folder, prefix=".verify-", suffix=".tmp")
    with os.fdopen(handle, "w") as out:
        out.write(json.dumps(record, indent=2) + "\n")
    os.replace(temporary, folder / f"verify-{tree}.json")
    if not ok:
        print(f"verify: failed; outputs under {outputs.as_posix()}/")
        return 1
    print(f"Factory-Verify: {tree} ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
