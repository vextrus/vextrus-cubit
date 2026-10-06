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

import ast
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ElementTree
from collections.abc import Collection, Sequence
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
NAMED = re.compile(r"No module named '([\w.]+)'")
NO_NAME = re.compile(r"^: cannot import name '(\w+)' from '([\w.]+)'")
IMPORT_LINTER = (".importlinter", "setup.cfg", "pyproject.toml")
NOBODY = 65534
DESELECTED = re.compile(r"\b(\d+) deselected\b")
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
    reasons for it wins; per key, the newest pin. A mistake in an older commit is superseded the same
    way, since commits cannot be edited: a malformed `pin:` line by a newer pin of its key (of any key
    when none can be read), a malformed `red-for:` line or one naming a path never added by a newer
    commit stating `red-for:` lines."""
    ticket = Ticket(branch)
    ids = _git(root, "rev-list", "--no-merges", "--reverse", f"{base}..{branch}").split()
    added: list[str] = []
    reasons: dict[str, list[str]] = {}
    stated_in: dict[str, int] = {}  # each path: the commit (its index) whose reasons stand
    pins: dict[str, str] = {}
    pinned_in: dict[str, int] = {}
    last_red_for, last_pin = -1, -1
    mistakes: list[tuple[int, str, str | None, str]] = []  # (index, kind, key, line)
    for index, commit in enumerate(ids):
        message = _git(root, "log", "-1", "--format=%B", commit)
        if not message.startswith(PREFIX):
            continue
        changed = _git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "-z", commit)
        added += [name for name in changed.split("\0") if name and name not in added]
        stated: dict[str, list[str]] = {}
        for path, reason in RED_FOR.findall(message):
            stated.setdefault(path, []).append(reason)
        reasons.update(stated)
        stated_in.update(dict.fromkeys(stated, index))
        for key, value in PIN.findall(message):
            pins[key], pinned_in[key] = value, index
        last_red_for = index if stated else last_red_for
        last_pin = index if PIN.search(message) else last_pin
        for line in message.splitlines():
            if line.startswith("pin:") and not PIN.fullmatch(line):
                key = re.match(r"pin:\s*([^\s=:]+)", line)
                mistakes.append((index, "pin", key.group(1) if key else None, f"{commit[:12]}: {line}"))
            elif line.startswith("red-for:") and not RED_FOR.fullmatch(line):
                mistakes.append((index, "red-for", None, f"{commit[:12]}: {line}"))
    ticket.pins = list(pins.items())
    ticket.malformed = [
        line
        for index, kind, key, line in mistakes
        if not (
            (kind == "red-for" and last_red_for > index)
            or (kind == "pin" and (pinned_in.get(key, -1) if key else last_pin) > index)
        )
    ]
    listed = _git(root, "ls-tree", "-r", "--name-only", "-z", branch, "--", *added) if added else ""
    present = set(listed.split("\0"))
    ticket.files = [name for name in added if name in present]
    # A file a later commit withdrew keeps no reason; a path never added is a mistake, unless a newer
    # commit states `red-for:` lines again.
    ticket.reasons = {path: said for path, said in reasons.items() if path in present}
    ticket.unknown = [path for path in reasons if path not in added and stated_in[path] >= last_red_for]
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


def imports_of(source: str) -> set[str]:
    """The absolute modules a file imports: `import a.b` gives `a.b`; `from a.b import c` gives `a.b`
    and `a.b.c` (c may be a module); a module loaded by name, `importlib.import_module("a.b")` or
    `__import__("a.b")` with a literal, gives `a.b`. Empty when the file does not parse."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return set()
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            found.add(node.module)
            found.update(f"{node.module}.{alias.name}" for alias in node.names)
        elif isinstance(node, ast.Call) and _loads_by_name(node):
            found.add(node.args[0].value)  # type: ignore[attr-defined]
    return found


def _loads_by_name(call: ast.Call) -> bool:
    """Whether a call is `import_module("<absolute name>")` (as `importlib.import_module` or bare) or
    `__import__("<absolute name>")`."""
    func = call.func
    name = (
        func.attr if isinstance(func, ast.Attribute) else func.id if isinstance(func, ast.Name) else ""
    )
    if name not in {"import_module", "__import__"} or not call.args:
        return False
    first = call.args[0]
    return (
        isinstance(first, ast.Constant)
        and isinstance(first.value, str)
        and not first.value.startswith(".")
    )


def _stated(text: str, reasons: Sequence[str], imported: Collection[str] = ()) -> bool:
    """Whether a line of `text` contains a reason. A reason naming a module not built (`No module
    named 'a.b.c'`) that the test imports (`imported`: that module, or a module under it) also matches
    the same error naming a parent package of it (`'a.b'`): when the package is new too, Python names
    the first part it cannot find. A module the test never imports gets no such widening."""
    for reason in reasons:
        named = NAMED.search(reason)
        module = named.group(1) if named else ""
        parents = module.split(".")
        if named and any(name == module or name.startswith(f"{module}.") for name in imported):
            accepted = [reason] + [
                reason.replace(named.group(0), f"No module named '{'.'.join(parents[:depth])}'")
                for depth in range(1, len(parents))
            ]
        else:
            accepted = [reason]
        if any(form in line for line in text.splitlines() for form in accepted):
            return True
    return False


def _undo(made: dict[Path, bytes | None]) -> None:
    """Undo what stub() did: each file restored or removed, then each folder it made, deepest first,
    when empty."""
    for changed, before in made.items():
        if before is not None:
            changed.write_bytes(before)
        elif not changed.is_dir():
            changed.unlink(missing_ok=True)
    for folder in reversed([changed for changed, before in made.items() if before is None]):
        if folder.is_dir() and not folder.is_symlink() and not any(folder.iterdir()):
            folder.rmdir()


def _work_parent() -> str | None:
    """A temp folder every user can reach (the non-root run reads the tree under it)."""
    for candidate in (tempfile.gettempdir(), "/var/tmp", "/tmp"):
        path = Path(candidate).resolve()
        if path.is_dir() and all(part.stat().st_mode & stat.S_IXOTH for part in (path, *path.parents)):
            return str(path)
    return None


def _unrunnable() -> dict[str, str]:
    """The opt-in marks (the base's addopts deselect them) whose tests cannot run here, each with why.
    `live` is not one: CI's acceptance check never runs a live test, so one is refused (LIVE)."""
    found = {}
    if not Path("/opt/vextrus").is_dir():
        found["needs_toolchain"] = "no toolchain under /opt/vextrus"
    if shutil.which("bwrap") is None:
        found["needs_bwrap"] = "no bwrap"
    return found


def _through_link(tree: Path, path: Path) -> bool:
    """Whether `path` (under `tree`), or any folder between them, is a symlink, dangling or not: a write
    there could land outside the tree."""
    current = tree
    for part in path.relative_to(tree).parts:
        current = current / part
        if current.is_symlink():
            return True
    return False


def _write_unlinked(tree: Path, name: str, data: bytes) -> None:
    """Write a branch's file at `tree/name` without following a symlink: a link the base has where the
    branch has a folder or a file is replaced by it (the link itself removed, never its target)."""
    path = tree
    *folders, leaf = Path(name).parts
    for part in folders:
        path = path / part
        if path.is_symlink():
            path.unlink()
        path.mkdir(exist_ok=True)
    path = path / leaf
    if path.is_symlink():
        path.unlink()
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o644)
    with os.fdopen(descriptor, "wb") as file:
        file.write(data)


class Checker:
    """One branch's acceptance files, laid over a copy of the base's tree in a work folder."""

    def __init__(self, root: Path, base: str, ticket: Ticket, work: Path) -> None:
        self.root, self.base, self.ticket, self.work = root, base, ticket, work
        self.tree = work / "tree"
        self.python = [name for name in ticket.files if name.endswith(".py")]
        self.tests = [name for name in self.python if TEST_FILE.search(name)]
        # The lint's own `-m` replaces the base's (its addopts may deselect opt-in marks): every test
        # is judged but those whose marks cannot run here, which are named, never refused.
        self.unrunnable = _unrunnable()
        # Never `live` (paid calls): such a test is refused, found by its own collection (`live()`).
        self.select = " and ".join(f"not {mark}" for mark in ["live", *sorted(self.unrunnable)])
        self.unjudged: set[str] = set()

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
            _write_unlinked(self.tree, name, blob.stdout)
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

    def live(self, path: str) -> list[str]:
        """The file's tests marked `live`, by a collection of them alone (the stubs standing in)."""
        done, _folder = self.pytest(path, "live", "--collect-only", "-q", "-m", "live")
        return (
            [line for line in done.stdout.splitlines() if "::" in line] if done.returncode == 0 else []
        )

    def stub(self, module: str, name: str | None, made: dict[Path, bytes | None]) -> bool:
        """Stand a stub in for a module (or a name in one) of the tree's packages not built yet,
        remembering what it changed in `made` (each folder it made among them, mapped to None, before
        the files in it). False when it cannot (not the tree's own, or done)."""
        parts = module.split(".")
        package = self.tree.joinpath(*parts)
        inits = [self.tree.joinpath(*parts[:depth], "__init__.py") for depth in range(1, len(parts))]
        if any(
            _through_link(self.tree, written)
            for written in (package, package.with_suffix(".py"), *inits)
        ):
            return False  # every path it would write or unlink, checked before any write
        if not (self.tree / parts[0]).is_dir():
            return False
        path = package / "__init__.py" if package.is_dir() else package.with_suffix(".py")
        if _through_link(self.tree, path):
            return False
        if name is None and path.exists():
            return False
        if name is not None and (not path.is_file() or path in made):
            return False
        for init in inits:
            if not init.parent.is_dir():
                init.parent.mkdir()  # its parent's `__init__.py`, one step up, made the folder above
                made[init.parent] = None
            if not init.exists():
                made[init] = None
                init.write_text("")
        made[path] = path.read_bytes() if path.exists() else None
        path.write_text((path.read_text() if path.exists() else "") + STUB)
        return True

    def check_collection(self) -> list[str]:
        problems = []
        for path in self.tests:
            made: dict[Path, bytes | None] = {}
            stubs = 0
            try:
                # A collection after each stub, the last one's among them: STUBS stubs, STUBS + 1 runs.
                for _ in range(STUBS + 1):
                    done, _folder = self.pytest(path, "collect", "--collect-only", "-q")
                    output = done.stdout + done.stderr
                    deselected = DESELECTED.search(output)
                    live = self.live(path) if deselected and done.returncode in (0, 5) else []
                    if live:
                        why = "CI's acceptance check never runs a live test (it fails as deselected)"
                        problems.append(f"{self.label(path)}: marked live: {why}: {', '.join(live)}")
                    if deselected and int(deselected.group(1)) > len(live):
                        marks = ", ".join(f"{mark} ({why})" for mark, why in self.unrunnable.items())
                        print(
                            f"{self.label(path)}: {int(deselected.group(1)) - len(live)} test(s) not "
                            f"judged here, marked one of: {marks}"
                        )
                    if deselected and done.returncode == 5:
                        self.unjudged.add(path)
                        break
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
                    if missing and stubs + len(missing) > STUBS:
                        problems.append(
                            f"{self.label(path)}: does not collect (stub limit reached: {STUBS} modules "
                            f"not built, and still failing):\n{_tail(output)}"
                        )
                        break
                    if not missing or not all(self.stub(module, name, made) for module, name in missing):
                        stubbed = f" (with {stubs} stub(s) for modules not built)" if stubs else ""
                        problems.append(
                            f"{self.label(path)}: does not collect{stubbed} (exit {done.returncode}):\n"
                            f"{_tail(output)}"
                        )
                        break
                    stubs += len(missing)
            finally:
                _undo(made)
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
            f"--junitxml={folder / 'report.xml'}", "-o", "junit_logging=no",
            "-m", self.select, *args, path,
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

    def imports_beside(self, path: str) -> set[str]:
        """The modules the test file and the helpers beside it (each `.py` in its folder, never through
        a link) import or load by name."""
        folder = (self.tree / path).parent
        found: set[str] = set()
        for helper in sorted(folder.glob("*.py")):
            if not _through_link(self.tree, helper):
                found |= imports_of(helper.read_text(errors="replace"))
        return found

    def check_red(self) -> list[str]:
        problems = []
        for path in self.tests:
            if path in self.unjudged:
                continue
            reasons = self.ticket.reasons.get(path, [])
            imported = self.imports_beside(path)
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
                    if not _stated(text, reasons, imported)
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
