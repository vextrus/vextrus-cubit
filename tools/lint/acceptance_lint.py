"""The acceptance lint (S14-AL, #458): judges a ticket's `acceptance:` commits before its builder starts,
so a broken acceptance test is caught at its writer, not as a builder's BLOCK.

    python -m tools.lint.acceptance_lint <base> <branch>...

Run in the repository. For each branch, its `acceptance:` commits in base..branch and the Python files
they leave on the branch, laid over a copy of the base's tree:

- the test files collect. An import of a module of the tree's own packages that does not exist yet (the
  module under test, or a name in a module, built later) is let through: the lint stands a stub in for
  it and collects again, so an error behind that import is still found;
- `lint-imports` (when the tree has an import-linter configuration) and `mypy` pass on them;
- every test red on the base fails with an error line (pytest's `E` lines, or the failure's message)
  containing a reason stated for its file in the commit message, `red-for: <path> <reason>` (one line
  per reason). A file with a red test and no `red-for:` line is flagged. The tests run as a non-root
  user (`nobody` when the lint runs as root) and as root (the lint itself when root, else `unshare -r`
  when the kernel allows it): red for the stated reason under both;

and across the branches given, each `pin: <key> = <value>` line in their `acceptance:` commits: two
pins of one key to different values fail naming both branches and the key, and so does a pin
contradicting a `ruling: <key> = <value>` line in `docs/rulings.md` as it is at the base (no register,
no rulings). Acceptance files that are not Python (the web's) are named as not checked.

Exit 0 clean, 1 with each problem printed. The tools run from this interpreter (`sys.executable -m
pytest`, `-m mypy`, the `lint-imports` beside it) with the checked tree as the working folder. Standard
library only.
"""

import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ElementTree
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

PREFIX = "acceptance:"
RED_FOR = re.compile(r"^red-for:[ \t]+(\S+)[ \t]+(\S.*?)[ \t]*$", re.MULTILINE)
PIN = re.compile(r"^pin:[ \t]+([^=\s]+)[ \t]*=[ \t]*(\S.*?)[ \t]*$", re.MULTILINE)
RULING = re.compile(
    r"^[ \t]*(?:[-*][ \t]+)?`?ruling:[ \t]+([^=\s]+)[ \t]*=[ \t]*([^`\n]*?)[ \t]*`?[ \t]*$", re.MULTILINE
)
RULINGS = "docs/rulings.md"
TEST_FILE = re.compile(r"(?:^|/)(?:test_[^/]*|[^/]*_test)\.py$")
ERROR_LINE = re.compile(r"^E\s+(\w+(?:Error|Exception))\b(.*)$")
# The modules not built yet: the only collection errors the lint lets through, once stubbed.
NO_MODULE = re.compile(r"^: No module named '([\w.]+)'")
NO_NAME = re.compile(r"^: cannot import name '(\w+)' from '([\w.]+)'")
IMPORT_LINTER = (".importlinter", "setup.cfg", "pyproject.toml")
NOBODY = 65534
TIMEOUT = 300
STUBS = 20

# A module not built yet, for collection only: every name in it is a class that answers anything.
STUB = """

class _Stub(type):
    def __getattr__(cls, name: str) -> "_Stub":
        if name.startswith("__"):
            raise AttributeError(name)
        return _Stub(name, (), {})

    def __call__(cls, *args: object, **kwargs: object) -> "_Stub":
        return _Stub(cls.__name__, (), {})

    def __iter__(cls) -> object:
        return iter(())


def __getattr__(name: str) -> _Stub:
    if name.startswith("__"):
        raise AttributeError(name)
    return _Stub(name, (), {})
"""


# Drops the test database of the tree it runs in, as the owner role, when it exists (no server: none).
DROP = """
import os

os.environ["DJANGO_SETTINGS_MODULE"] = "vextrus.settings.test"
import django

django.setup()
import psycopg
from django.conf import settings
from psycopg import sql

owner = settings.DATABASES["owner"]
name = owner["TEST"]["NAME"]
try:
    connection = psycopg.connect(
        host=owner["HOST"], port=owner["PORT"], user=owner["USER"],
        password=owner["PASSWORD"] or None, dbname="postgres", autocommit=True,
    )
except psycopg.OperationalError:
    raise SystemExit(0)
with connection:
    if connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone():
        connection.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))
"""


class Refused(Exception):
    """A problem that stops the check of one branch (a missing ref, a tool that cannot run)."""


@dataclass
class Ticket:
    branch: str
    files: list[str] = field(default_factory=list)
    reasons: dict[str, list[str]] = field(default_factory=dict)
    pins: list[tuple[str, str]] = field(default_factory=list)
    unknown: list[str] = field(default_factory=list)
    malformed: list[str] = field(default_factory=list)


def _git(root: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise Refused(f"git {' '.join(args)}: {done.stderr.strip() or 'failed'}")
    return done.stdout


def read_ticket(root: Path, base: str, branch: str) -> Ticket:
    """The branch's `acceptance:` commits in base..branch: the files they leave on the branch, the
    reasons stated for those files, the `red-for:` paths they never added, their pins and the
    declaration lines not in their form. An amendment replaces: per file, the newest commit stating
    reasons for it wins; per key, the newest pin."""
    ticket = Ticket(branch)
    ids = _git(root, "rev-list", "--no-merges", "--reverse", f"{base}..{branch}").split()
    added: list[str] = []
    reasons: dict[str, list[str]] = {}
    pins: dict[str, str] = {}
    for commit in ids:
        message = _git(root, "log", "-1", "--format=%B", commit)
        if not message.startswith(PREFIX):
            continue
        changed = _git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "-z", commit)
        added += [name for name in changed.split("\0") if name and name not in added]
        stated: dict[str, list[str]] = {}
        for path, reason in RED_FOR.findall(message):
            stated.setdefault(path, []).append(reason)
        reasons.update(stated)
        pins.update(PIN.findall(message))
        ticket.malformed += [
            f"{commit[:12]}: {line}"
            for line in message.splitlines()
            if line.startswith(("pin:", "red-for:"))
            and not (PIN.fullmatch(line) or RED_FOR.fullmatch(line))
        ]
    ticket.pins = list(pins.items())
    listed = _git(root, "ls-tree", "-r", "--name-only", "-z", branch, "--", *added) if added else ""
    present = set(listed.split("\0"))
    ticket.files = [name for name in added if name in present]
    # A file a later commit withdrew keeps no reason; a path never added is a mistake.
    ticket.reasons = {path: said for path, said in reasons.items() if path in present}
    ticket.unknown = [path for path in reasons if path not in added]
    return ticket


def rulings_at(root: Path, base: str) -> dict[str, str]:
    """The owner's rulings recorded in the base's register: none when it has no register."""
    if not _git(root, "ls-tree", "--name-only", base, "--", RULINGS).strip():
        return {}
    return dict(RULING.findall(_git(root, "show", f"{base}:{RULINGS}")))


def contradictions(tickets: Sequence[Ticket], rulings: dict[str, str]) -> list[str]:
    """Pins of one key to different values across the tickets, and pins against the rulings."""
    problems = []
    by_key: dict[str, dict[str, list[str]]] = {}
    for ticket in tickets:
        for key, value in ticket.pins:
            branches = by_key.setdefault(key, {}).setdefault(value, [])
            if ticket.branch not in branches:
                branches.append(ticket.branch)
    for key, values in by_key.items():
        if len(values) > 1:
            said = "; ".join(
                f"{' and '.join(branches)} pin {key} = {value}" for value, branches in values.items()
            )
            problems.append(f"pin {key}: the tickets contradict each other: {said}")
        if key in rulings:
            for value, branches in values.items():
                if value != rulings[key]:
                    ruled = f"the ruling {key} = {rulings[key]} in {RULINGS}"
                    problems += [
                        f"{branch}: pin {key} = {value} contradicts {ruled}" for branch in branches
                    ]
    return problems


def _environment(tree: Path) -> dict[str, str]:
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PYTEST_") and key not in {"PYTHONPATH", "VIRTUAL_ENV"}
    }
    env["PYTHONPATH"] = str(tree)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def _run(
    command: Sequence[str], tree: Path, env: dict[str, str], *, as_nobody: bool = False
) -> subprocess.CompletedProcess[str]:
    """The command's run; a run past TIMEOUT comes back as exit 124 saying so, not as an error."""
    try:
        return subprocess.run(
            list(command),
            cwd=tree,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=TIMEOUT,
            user=NOBODY if as_nobody else None,
            group=NOBODY if as_nobody else None,
            extra_groups=[] if as_nobody else None,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(list(command), 124, "", f"timed out after {TIMEOUT} s")
    except (OSError, subprocess.SubprocessError) as error:
        raise Refused(f"{command[0]} could not run: {error}") from None


def _tail(text: str, lines: int = 12) -> str:
    kept = [line for line in text.strip().splitlines() if line.strip()][-lines:]
    return "\n".join(f"    {line[:200]}" for line in kept)


def _has_import_linter(tree: Path) -> bool:
    for name in IMPORT_LINTER:
        path = tree / name
        if path.is_file() and (
            name == ".importlinter" or "importlinter" in path.read_text(errors="replace")
        ):
            return True
    return False


def _outcomes(report: Path) -> tuple[list[tuple[str, str]], list[str]] | None:
    """A junit report's failing or erroring tests, each its name with its message and error lines
    (pytest's `E` lines; never the source lines it quotes), and its skipped tests (xfail among them).
    None if the run wrote no report."""
    if not report.is_file():
        return None
    try:
        suite = ElementTree.parse(report).getroot()
    except ElementTree.ParseError:
        return None
    failures, skipped = [], []
    for case in suite.iter("testcase"):
        name = f"{case.get('classname', '')}::{case.get('name', '')}"
        for outcome in list(case.findall("failure")) + list(case.findall("error")):
            errors = [line for line in (outcome.text or "").splitlines() if line.startswith("E ")]
            failures.append((name, "\n".join([outcome.get("message", ""), *errors])))
        skipped += [f"{name} ({mark.get('message', '')})" for mark in case.findall("skipped")]
    return failures, skipped


def not_built(output: str) -> list[tuple[str, str | None]] | None:
    """The modules (and names) a failed collection's output says are missing: `(module, None)` for
    `No module named`, `(module, name)` for `cannot import name`. None when any other error is in it."""
    missing: list[tuple[str, str | None]] = []
    for line in output.splitlines():
        error = ERROR_LINE.match(line)
        if error is None:
            continue
        kind, rest = error.groups()
        module, name = NO_MODULE.match(rest), NO_NAME.match(rest)
        if kind == "ModuleNotFoundError" and module:
            missing.append((module.group(1), None))
        elif kind == "ImportError" and name:
            missing.append((name.group(2), name.group(1)))
        else:
            return None
    return missing or None


def _stated(text: str, reasons: Sequence[str]) -> bool:
    return any(reason in line for line in text.splitlines() for reason in reasons)


def _work_parent() -> str | None:
    """A temp folder every user can reach (the non-root run reads the tree under it)."""
    for candidate in (tempfile.gettempdir(), "/var/tmp", "/tmp"):
        path = Path(candidate).resolve()
        if path.is_dir() and all(part.stat().st_mode & stat.S_IXOTH for part in (path, *path.parents)):
            return str(path)
    return None


class Checker:
    """One branch's acceptance files, laid over a copy of the base's tree in a work folder."""

    def __init__(self, root: Path, base: str, ticket: Ticket, work: Path) -> None:
        self.root, self.base, self.ticket, self.work = root, base, ticket, work
        self.tree = work / "tree"
        self.python = [name for name in ticket.files if name.endswith(".py")]
        self.tests = [name for name in self.python if TEST_FILE.search(name)]

    def label(self, path: str) -> str:
        return f"{self.ticket.branch} {path}"

    def lay_out(self) -> None:
        self.tree.mkdir()
        archive = subprocess.run(
            ["git", "-C", str(self.root), "archive", "--format=tar", self.base],
            capture_output=True,
            check=False,
        )
        if archive.returncode != 0:
            raise Refused(f"git archive {self.base}: {archive.stderr.decode(errors='replace').strip()}")
        unpacked = subprocess.run(
            ["tar", "-x", "-C", str(self.tree)], input=archive.stdout, capture_output=True, check=False
        )
        if unpacked.returncode != 0:
            raise Refused(f"tar: {unpacked.stderr.decode(errors='replace').strip()}")
        for name in self.ticket.files:
            blob = subprocess.run(
                ["git", "-C", str(self.root), "show", f"{self.ticket.branch}:{name}"],
                capture_output=True,
                check=False,
            )
            if blob.returncode != 0:
                said = blob.stderr.decode(errors="replace").strip()
                raise Refused(f"git show {self.ticket.branch}:{name}: {said}")
            path = self.tree / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(blob.stdout)
        # Readable by every user, so the non-root run can read the tree and write its own folders.
        for folder in (self.work, self.tree):
            folder.chmod(0o755)
        for dirpath, dirnames, filenames in os.walk(self.tree):
            for name in dirnames:
                folder = Path(dirpath, name)
                if not folder.is_symlink():  # a link may point outside the tree: never through it
                    folder.chmod(0o755)
            for name in filenames:
                path = Path(dirpath, name)
                if not path.is_symlink():
                    path.chmod(path.stat().st_mode | 0o444)

    def env(self) -> dict[str, str]:
        return _environment(self.tree)

    def check(self) -> list[str]:
        if not self.ticket.files:
            span = f"{self.base}..{self.ticket.branch}"
            return [f"{self.ticket.branch}: no `{PREFIX}` commit in {span} leaves a file"]
        problems = [
            f"{self.label(path)}: red-for names a file the acceptance commits do not add"
            for path in self.ticket.unknown
        ]
        form = "`pin: <key> = <value>` or `red-for: <path> <reason>`"
        problems += [
            f"{self.ticket.branch}: a declaration not in its form ({form}): {line}"
            for line in self.ticket.malformed
        ]
        others = [name for name in self.ticket.files if not name.endswith(".py")]
        if others:
            print(f"{self.ticket.branch}: not checked (not Python): {', '.join(others)}")
        if not self.python:
            return problems
        self.lay_out()
        problems += self.check_collection()
        problems += self.check_imports()
        problems += self.check_types()
        problems += self.check_red()
        return problems

    def stub(self, module: str, name: str | None, made: dict[Path, bytes | None]) -> bool:
        """Stand a stub in for a module (or a name in one) of the tree's packages not built yet,
        remembering what it changed in `made`. False when it cannot (not the tree's own, or done)."""
        parts = module.split(".")
        if not (self.tree / parts[0]).is_dir():
            return False
        package = self.tree.joinpath(*parts)
        path = package / "__init__.py" if package.is_dir() else package.with_suffix(".py")
        if name is None and path.exists():
            return False
        if name is not None and (not path.is_file() or path in made):
            return False
        for depth in range(1, len(parts)):
            init = self.tree.joinpath(*parts[:depth], "__init__.py")
            if not init.exists():
                made[init] = None
                init.parent.mkdir(parents=True, exist_ok=True)
                init.write_text("")
        made[path] = path.read_bytes() if path.exists() else None
        path.write_text((path.read_text() if path.exists() else "") + STUB)
        return True

    def check_collection(self) -> list[str]:
        problems = []
        for path in self.tests:
            made: dict[Path, bytes | None] = {}
            try:
                for _ in range(STUBS):
                    done, _folder = self.pytest(path, "collect", "--collect-only", "-q")
                    output = done.stdout + done.stderr
                    if done.returncode == 0:
                        # Fixtures resolve only at setup: plan it, the stubs still standing in.
                        plan, _folder = self.pytest(path, "plan", "--setup-plan", "-q")
                        if plan.returncode != 0:
                            output = _tail(plan.stdout + plan.stderr)
                            code = f"exit {plan.returncode}"
                            problems.append(
                                f"{self.label(path)}: a test cannot be set up ({code}):\n{output}"
                            )
                        break
                    if done.returncode == 5:
                        problems.append(f"{self.label(path)}: collects no test")
                        break
                    missing = not_built(output)
                    if not missing or not all(self.stub(module, name, made) for module, name in missing):
                        stubbed = f" (with {len(made)} stub(s) for modules not built)" if made else ""
                        problems.append(
                            f"{self.label(path)}: does not collect{stubbed} (exit {done.returncode}):\n"
                            f"{_tail(output)}"
                        )
                        break
            finally:
                for changed, before in made.items():
                    if before is None:
                        changed.unlink(missing_ok=True)
                    else:
                        changed.write_bytes(before)
        return problems

    def check_imports(self) -> list[str]:
        if not _has_import_linter(self.tree):
            return []
        tool = Path(sys.executable).with_name("lint-imports")
        if not tool.is_file():
            return [f"{self.ticket.branch}: lint-imports is not installed beside {sys.executable}"]
        done = _run([str(tool), "--no-cache"], self.tree, self.env())
        if done.returncode == 0:
            return []
        folders = ", ".join(sorted({str(Path(path).parent) for path in self.python}))
        output = _tail(done.stdout + done.stderr, 20)
        return [f"{self.ticket.branch} {folders}: lint-imports fails:\n{output}"]

    def check_types(self) -> list[str]:
        # No PYTHONPATH for mypy: a package found on it is "installed", and an import of a module not
        # built yet would be import-untyped, not import-not-found. The working folder is on its path.
        env = self.env()
        del env["PYTHONPATH"]
        cache = self.work / "mypy-cache"
        done = _run(
            [sys.executable, "-m", "mypy", "--cache-dir", str(cache), *self.python], self.tree, env
        )
        if done.returncode == 0:
            return []
        folders = ", ".join(sorted({str(Path(path).parent) for path in self.python}))
        return [f"{self.ticket.branch} {folders}: mypy fails:\n{_tail(done.stdout + done.stderr, 20)}"]

    def pytest(self, path: str, how: str, *args: str) -> tuple[subprocess.CompletedProcess[str], Path]:
        """pytest on one file in a fresh folder of its own (its `--basetemp` and its junit report),
        owned by the user it runs as. Returns the run and the folder."""
        folder = Path(tempfile.mkdtemp(prefix=f"{how}-", dir=self.work))
        folder.chmod(0o755)
        if how == "nobody":
            os.chown(folder, NOBODY, NOBODY)
        command = [
            sys.executable, "-m", "pytest", "-p", "no:cacheprovider", "--basetemp", str(folder / "tmp"),
            f"--junitxml={folder / 'report.xml'}", "-o", "junit_logging=no", *args, path,
        ]  # fmt: skip
        if how == "unshare":
            command = ["unshare", "-r", *command]
        env = self.env()
        if how == "nobody":
            # Its own HOME. The other runs keep the caller's: locally libpq finds the database password
            # there (the cloud and CI give the database in DATABASE_URL, which every run inherits).
            env["HOME"] = str(folder)
        return _run(command, self.tree, env, as_nobody=how == "nobody"), folder

    def drop_test_database(self) -> list[str]:
        """Drop the test database this run's tree made, by its exact name: the name carries a hash of
        the tree's path, unique to the run (`vextrus.settings.db`). Only for a Vextrus tree."""
        if not (self.tree / "vextrus" / "settings" / "test.py").is_file():
            return []
        done = _run([sys.executable, "-c", DROP], self.tree, self.env())
        if done.returncode == 0:
            return []
        output = _tail(done.stdout + done.stderr)
        return [f"{self.ticket.branch}: the run's test database was not dropped:\n{output}"]

    def runs(self) -> list[tuple[str, str]]:
        """The users the tests run as: a non-root one, and root when it can be had."""
        if os.geteuid() == 0:
            return [("nobody", "as the non-root user nobody"), ("direct", "as root")]
        found = [("direct", f"as the non-root user {os.geteuid()}")]
        if (
            shutil.which("unshare")
            and subprocess.run(["unshare", "-r", "true"], capture_output=True, check=False).returncode
            == 0
        ):
            found.append(("unshare", "as root (unshare -r)"))
        return found

    def check_red(self) -> list[str]:
        problems = []
        for path in self.tests:
            reasons = self.ticket.reasons.get(path, [])
            for how, who in self.runs():
                done, folder = self.pytest(path, how)
                outcomes = _outcomes(folder / "report.xml")
                if outcomes is None:
                    output = _tail(done.stdout + done.stderr)
                    code = f"exit {done.returncode}"
                    problems.append(
                        f"{self.label(path)}: pytest wrote no report {who} ({code}):\n{output}"
                    )
                    continue
                failures, skipped = outcomes
                if skipped:
                    names = ", ".join(skipped)
                    problems.append(
                        f"{self.label(path)}: skipped or xfail on {self.base} {who}: {names}"
                    )
                if not failures:
                    problems.append(f"{self.label(path)}: no test is red on {self.base} {who}")
                    continue
                if failures and not reasons:
                    names = ", ".join(name for name, _ in failures)
                    why = "with no `red-for:` line stating why"
                    problems.append(f"{self.label(path)}: red on {self.base} {why}: {names}")
                    break
                stated = " | ".join(reasons)
                problems += [
                    f"{self.label(path)}: {name} is red on {self.base} {who} for a reason not stated "
                    f"(stated: {stated}):\n{_tail(text, 6)}"
                    for name, text in failures
                    if not _stated(text, reasons)
                ]
        return problems


def lint(root: Path, base: str, branches: Sequence[str]) -> list[str]:
    problems: list[str] = []
    tickets = []
    parent = _work_parent() if os.geteuid() == 0 else None
    for branch in branches:
        try:
            ticket = read_ticket(root, base, branch)
            tickets.append(ticket)
            with tempfile.TemporaryDirectory(prefix="acceptance-lint-", dir=parent) as work:
                checker = Checker(root, base, ticket, Path(work))
                try:
                    problems += checker.check()
                finally:
                    problems += checker.drop_test_database()
        except Refused as error:
            problems.append(f"{branch}: {error}")
    try:
        problems += contradictions(tickets, rulings_at(root, base))
    except Refused as error:
        problems.append(f"{RULINGS}: {error}")
    return problems


def main(argv: Sequence[str]) -> int:
    if len(argv) < 2:
        print("usage: python -m tools.lint.acceptance_lint <base> <branch>...", file=sys.stderr)
        return 1
    base, branches = argv[0], argv[1:]
    try:
        problems = lint(Path.cwd(), base, branches)
    except Exception as error:  # A verdict, never a traceback.
        problems = [f"the lint stopped: {type(error).__name__}: {error}"]
    for problem in problems:
        print(problem)
    if problems:
        print(f"acceptance-lint: {len(problems)} problem(s) in {', '.join(branches)}")
        return 1
    print(f"acceptance-lint: {', '.join(branches)} clean against {base}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
