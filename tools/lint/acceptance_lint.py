"""The acceptance lint (S14-AL, #458): judges a ticket's `acceptance:` commits before its builder starts,
so a broken acceptance test is caught at its writer, not as a builder's BLOCK.

    python -m tools.lint.acceptance_lint <base> <branch>...

Run in the repository. For each branch, its `acceptance:` commits in base..branch and the Python files
they add, laid over a copy of the base's tree:

- the test files collect, but for an import of a module that does not exist yet (the module under
  test, built later);
- `lint-imports` (when the tree has an import-linter configuration) and `mypy` pass on them;
- every test red on the base fails with a line containing a reason stated for its file in the commit
  message, `red-for: <path> <reason>` (one line per reason). A file with a red test and no `red-for:`
  line is flagged. The tests run as a non-root user (`nobody` when the lint runs as root) and as root
  (the lint itself when root, else `unshare -r` when the kernel allows it): red for the stated reason
  under both;

and across the branches given, each `pin: <key> = <value>` line in their `acceptance:` commits: two
pins of one key to different values fail naming both branches and the key, and so does a pin
contradicting a `ruling: <key> = <value>` line in `docs/rulings.md` as it is at the base (no register,
no rulings).

Exit 0 clean, 1 with each problem printed. The tools run from this interpreter (`sys.executable -m
pytest`, `-m mypy`, the `lint-imports` beside it) with the checked tree as the working folder. Standard
library only.
"""

import os
import re
import shutil
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
# A module that does not exist yet: the only collection error the lint lets through.
NOT_YET = re.compile(
    r"^E?\s*(?:ModuleNotFoundError: No module named |ImportError: cannot import name )", re.MULTILINE
)
IMPORT_LINTER = (".importlinter", "setup.cfg", "pyproject.toml")
NOBODY = 65534
TIMEOUT = 900


class Refused(Exception):
    """A problem that stops the check of one branch (a missing ref, a tool that cannot run)."""


@dataclass
class Ticket:
    branch: str
    files: list[str] = field(default_factory=list)
    reasons: dict[str, list[str]] = field(default_factory=dict)
    pins: list[tuple[str, str]] = field(default_factory=list)


def _git(root: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise Refused(f"git {' '.join(args)}: {done.stderr.strip() or 'failed'}")
    return done.stdout


def read_ticket(root: Path, base: str, branch: str) -> Ticket:
    """The branch's `acceptance:` commits in base..branch: the files they leave on the branch, their
    stated reasons and their pins."""
    ticket = Ticket(branch)
    ids = _git(root, "rev-list", "--no-merges", "--reverse", f"{base}..{branch}").split()
    seen: set[str] = set()
    for commit in ids:
        message = _git(root, "log", "-1", "--format=%B", commit)
        if not message.startswith(PREFIX):
            continue
        changed = _git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "-z", commit)
        for name in changed.split("\0"):
            if name and name not in seen:
                seen.add(name)
                ticket.files.append(name)
        for path, reason in RED_FOR.findall(message):
            ticket.reasons.setdefault(path, []).append(reason)
        ticket.pins.extend(PIN.findall(message))
    present = (
        set(_git(root, "ls-tree", "-r", "--name-only", "-z", branch, "--", *ticket.files).split("\0"))
        if ticket.files
        else set()
    )
    ticket.files = [name for name in ticket.files if name in present]
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


def _failures(report: Path) -> list[tuple[str, str]] | None:
    """Each failing or erroring test in a junit report: its name and its whole text. None if the run
    wrote no report."""
    if not report.is_file():
        return None
    try:
        suite = ElementTree.parse(report).getroot()
    except ElementTree.ParseError:
        return None
    found = []
    for case in suite.iter("testcase"):
        for outcome in list(case.findall("failure")) + list(case.findall("error")):
            name = f"{case.get('classname', '')}::{case.get('name', '')}"
            found.append((name, f"{outcome.get('message', '')}\n{outcome.text or ''}"))
    return found


def collects(output: str) -> bool:
    """Whether a failed collection's output shows only modules not built yet: every `E   <Error>`
    line an import of a module (or a name in one) that does not exist."""
    errors = [line for line in output.splitlines() if re.match(r"^E\s+\w+(?:Error|Exception)\b", line)]
    return bool(errors) and all(NOT_YET.match(line) for line in errors)


def _stated(text: str, reasons: Sequence[str]) -> bool:
    return any(reason in line for line in text.splitlines() for reason in reasons)


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
                Path(dirpath, name).chmod(0o755)
            for name in filenames:
                path = Path(dirpath, name)
                if not path.is_symlink():
                    path.chmod(path.stat().st_mode | 0o444)

    def env(self) -> dict[str, str]:
        return _environment(self.tree)

    def check(self) -> list[str]:
        if not self.ticket.files:
            span = f"{self.base}..{self.ticket.branch}"
            return [f"{self.ticket.branch}: no `{PREFIX}` commit in {span} adds a file"]
        problems = [
            f"{self.label(path)}: red-for names a file the acceptance commits do not add"
            for path in self.ticket.reasons
            if path not in self.tests
        ]
        if not self.python:
            return problems
        self.lay_out()
        problems += self.check_collection()
        problems += self.check_imports()
        problems += self.check_types()
        problems += self.check_red()
        return problems

    def check_collection(self) -> list[str]:
        problems = []
        for path in self.tests:
            done, _ = self.pytest(path, "collect", "--collect-only", "-q")
            if done.returncode in (0, 5):
                continue
            output = done.stdout + done.stderr
            if collects(output):
                continue
            problems.append(
                f"{self.label(path)}: does not collect (exit {done.returncode}):\n{_tail(output)}"
            )
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
                failures = _failures(folder / "report.xml")
                if failures is None:
                    output = _tail(done.stdout + done.stderr)
                    code = f"exit {done.returncode}"
                    problems.append(
                        f"{self.label(path)}: pytest wrote no report {who} ({code}):\n{output}"
                    )
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
    for branch in branches:
        try:
            ticket = read_ticket(root, base, branch)
            tickets.append(ticket)
            with tempfile.TemporaryDirectory(prefix="acceptance-lint-") as work:
                problems += Checker(root, base, ticket, Path(work)).check()
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
