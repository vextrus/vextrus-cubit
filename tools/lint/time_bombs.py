"""The time-bomb lint (#308). A test that fixes a timestamp and also reads the wall clock, or makes a
git commit at the wall clock's time, passes until the clock moves past the fixed time and then fails:
in #293 two test files fixed verdict times (`T1 = "2026-10-05T01:00:00Z"`) but committed "now",
`scripts/walk/ready.py` rightly dropped a verdict over 10 minutes older than its head's commit, and CI
went red after 01:10Z (fixed by pinning `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`).

A **Python test file** is `test_*.py`, `*_test.py`, `conftest.py` or any `.py` under a `tests/`
folder; a **script test file** is a `.js`/`.mjs`/`.cjs`/`.ts`/`.tsx` named `*.test.*` or `*.spec.*`,
or under a `tests/` or `__tests__/` folder (folders starting with `.`, and `node_modules`, skipped).

In Python (read as a syntax tree; a file that does not parse is read as text, erring towards failing):
- a **fixed timestamp** is a string holding `YYYY-MM-DD` then `T` or a space then `HH:MM`, or a
  `datetime(Y, M, D, ...)` call with literal numbers; a **fixed date** is a bare `YYYY-MM-DD` string or
  a `date(Y, M, D)` call;
- a **clock read** is `datetime.now()`, `datetime.utcnow()`, `datetime.today()`, `time.time()`,
  `time.time_ns()` or Django's `timezone.now()`/`localtime()`, through any import alias; a **day read**
  is `date.today()`, `datetime.today()` or `timezone.localdate()`. A clock read is a hit beside a fixed
  timestamp; a day read beside a fixed timestamp or date;
- a **commit** is the string "commit" (never a dict key or a subscript: that is data), in a file naming
  git, or a shell string running `git ... commit`. It is pinned only when the function holding it, or a
  function of this file it is passed to, sets both `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` (as a
  dict key, an item or a call's argument; a comment or a docstring does not pin). An unpinned commit
  beside a fixed timestamp is a hit.
In script tests: `new Date("<date>")` or `Date.parse("<date>")` beside `Date.now()` or `new Date()`.

Every hit is found; a file is reported once, at its first hit that the allowlist does not excuse. The
allowlist (`time_bombs_allowlist.toml`) holds `[[allow]]` entries: `path` (a glob from the root),
`reason` (required), and `kind` (`read` or `commit`) with `function` (the def's qualified name, or
`<module>`) or `line`, which excuse only those hits. An entry with only a path excuses a file only
while it holds a single hit. An entry with no reason, or excusing no hit (stale), fails. Standard
library only.

    python -m tools.lint.time_bombs [root]
"""

import ast
import fnmatch
import os
import re
import sys
import tomllib
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

ALLOWLIST = "tools/lint/time_bombs_allowlist.toml"
KINDS = ("read", "commit")

_SKIPPED_DIRS = {"node_modules", ".venv"}
_SCRIPT_SUFFIXES = {".js", ".mjs", ".cjs", ".ts", ".tsx"}
_TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}")
_DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
_GIT = re.compile(r"\bgit\b")
_SHELL_COMMIT = re.compile(r"\bgit(?:\s+[^\s\"',;&|]+)*?\s+commit\b")
_PINS = ("GIT_AUTHOR_DATE", "GIT_COMMITTER_DATE")
_UNPINNED = "a git commit without GIT_AUTHOR_DATE and GIT_COMMITTER_DATE"

# Canonical dotted names (after import aliases are resolved), and the bare spellings tests use
# without importing.
_CLOCK = {
    "datetime.datetime.now",
    "datetime.datetime.utcnow",
    "datetime.now",
    "datetime.utcnow",
    "time.time",
    "time.time_ns",
    "django.utils.timezone.now",
    "django.utils.timezone.localtime",
    "timezone.now",
    "timezone.localtime",
}
_DAY = {
    "datetime.datetime.today",
    "datetime.date.today",
    "datetime.today",
    "date.today",
    "django.utils.timezone.localdate",
    "timezone.localdate",
}

# Script tests.
_JS_FIXED = re.compile(r"(?:new\s+Date|Date\.parse)\(\s*[\"'`][^\"'`]*\d{4}-\d{2}-\d{2}")
_JS_READ = re.compile(r"\bDate\.now\(\s*\)|\bnew\s+Date\(\s*\)")

# The text reader, for a Python file that does not parse.
_TEXT_READ = re.compile(
    r"\b(?:datetime\.now|datetime\.utcnow|datetime\.today|date\.today|time\.time|time\.time_ns"
    r"|timezone\.now|timezone\.localtime|timezone\.localdate)\("
)
_TEXT_COMMIT = re.compile(r"""(["'])commit\1(?!\s*:)""")


@dataclass(frozen=True)
class Hit:
    line: int
    kind: str  # "read" or "commit"
    what: str
    function: str  # the enclosing def's qualified name, or "<module>"


def _is_python_test(relative: PurePosixPath) -> bool:
    name = relative.name
    if not name.endswith(".py"):
        return False
    return (
        name.startswith("test_")
        or name.endswith("_test.py")
        or name == "conftest.py"
        or "tests" in relative.parts[:-1]
    )


def _is_script_test(relative: PurePosixPath) -> bool:
    if relative.suffix not in _SCRIPT_SUFFIXES:
        return False
    stem = relative.name[: -len(relative.suffix)]
    return (
        stem.endswith((".test", ".spec"))
        or "tests" in relative.parts[:-1]
        or "__tests__" in relative.parts[:-1]
    )


def test_files(root: Path) -> Iterator[Path]:
    """Every Python or script test file under `root`, in a stable order."""
    for folder, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d not in _SKIPPED_DIRS)
        for name in sorted(files):
            path = Path(folder) / name
            relative = PurePosixPath(path.relative_to(root).as_posix())
            if _is_python_test(relative) or _is_script_test(relative):
                yield path


def _numbers(call: ast.Call) -> int:
    """How many leading positional arguments are integer literals."""
    count = 0
    for arg in call.args:
        if not (isinstance(arg, ast.Constant) and type(arg.value) is int):
            break
        count += 1
    return count


class _Reader(ast.NodeVisitor):
    """One pass over a module: fixed times, clock and day reads, commits, and pinning functions."""

    def __init__(self) -> None:
        self.aliases: dict[str, str] = {}
        self.timestamp = False
        self.date = False
        self.reads: list[Hit] = []
        self.days: list[Hit] = []
        self.commits: list[tuple[ast.AST, str, str]] = []  # node, what, function
        self.pinned_functions: set[str] = set()  # short names of defs that pin both dates
        self.calls: dict[int, str] = {}  # id of an argument node -> short name of the called def
        self.data: set[int] = set()  # ids of string nodes that are dict keys or subscripts
        self.pins: dict[str, set[str]] = {}  # function -> the pin names it sets
        self.uses: dict[str, set[str]] = {}  # function -> short names of the functions it calls
        self.stack: list[str] = []
        self.docstrings: set[int] = set()  # ids of docstrings and f-string fragments

    def function(self) -> str:
        return ".".join(self.stack) or "<module>"

    def name(self, node: ast.expr) -> str | None:
        if isinstance(node, ast.Name):
            return self.aliases.get(node.id, node.id)
        if isinstance(node, ast.Attribute):
            base = self.name(node.value)
            return None if base is None else f"{base}.{node.attr}"
        return None

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.asname:
                self.aliases[alias.asname] = alias.name

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        for alias in node.names:
            if node.module:
                self.aliases[alias.asname or alias.name] = f"{node.module}.{alias.name}"

    def _scope(self, node: ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef) -> None:
        body = node.body
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
            self.docstrings.add(id(body[0].value))
        self.stack.append(node.name)
        self.generic_visit(node)
        self.stack.pop()

    visit_FunctionDef = _scope
    visit_AsyncFunctionDef = _scope
    visit_ClassDef = _scope

    def visit_Module(self, node: ast.Module) -> None:
        body = node.body
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
            self.docstrings.add(id(body[0].value))
        self.generic_visit(node)

    def visit_Dict(self, node: ast.Dict) -> None:
        for key in node.keys:
            if key is not None:
                self.data.add(id(key))
                self._pin(key)
        self.generic_visit(node)

    def visit_Subscript(self, node: ast.Subscript) -> None:
        self.data.add(id(node.slice))
        self._pin(node.slice)
        self.generic_visit(node)

    def _pin(self, node: ast.AST) -> None:
        if isinstance(node, ast.Constant) and node.value in _PINS:
            self.pins.setdefault(self.function(), set()).add(str(node.value))

    def visit_Call(self, node: ast.Call) -> None:
        called = self.name(node.func) or ""
        short = called.rsplit(".", 1)[-1]
        where, line = self.function(), node.lineno
        self.uses.setdefault(where, set()).add(short)
        if called in _CLOCK:
            self.reads.append(Hit(line, "read", f"{'.'.join(called.split('.')[-2:])}()", where))
        if called in _DAY:
            self.days.append(Hit(line, "read", f"{'.'.join(called.split('.')[-2:])}()", where))
        if short in ("datetime", "date") and _numbers(node) >= 3:
            if short == "datetime":
                self.timestamp = True
            else:
                self.date = True
        for arg in node.args:
            self._pin(arg)
            for inner in ast.walk(arg):
                self.calls[id(inner)] = short
        for keyword in node.keywords:
            if keyword.arg in _PINS:
                self.pins.setdefault(where, set()).add(keyword.arg)
        self.generic_visit(node)

    def visit_JoinedStr(self, node: ast.JoinedStr) -> None:
        for part in node.values:
            if isinstance(part, ast.Constant) and isinstance(part.value, str):
                self.timestamp |= _TIMESTAMP.search(part.value) is not None
                self.docstrings.add(id(part))
        self.generic_visit(node)

    def pinning(self) -> set[str]:
        """The functions that pin both dates, themselves or through a helper of this file they call."""
        pinning = {name for name, pins in self.pins.items() if pins >= set(_PINS)}
        while True:
            helpers = {name.rsplit(".", 1)[-1] for name in pinning}
            more = {name for name, uses in self.uses.items() if uses & helpers} - pinning
            if not more:
                return pinning
            pinning |= more

    def visit_Constant(self, node: ast.Constant) -> None:
        if not isinstance(node.value, str) or id(node) in self.docstrings:
            return
        if _TIMESTAMP.search(node.value):
            self.timestamp = True
        elif _DATE.search(node.value):
            self.date = True
        if node.value == "commit" and id(node) not in self.data:
            self.commits.append((node, "git commit", self.function()))
        elif _SHELL_COMMIT.search(node.value):
            self.commits.append((node, "git commit in a shell string", self.function()))


def _python_hits(text: str) -> list[Hit]:
    try:
        tree = ast.parse(text)
    except SyntaxError, ValueError:
        return _text_hits(text)
    reader = _Reader()
    reader.visit(tree)
    hits: list[Hit] = []
    if reader.timestamp:
        hits += reader.reads
    if reader.timestamp or reader.date:
        hits += reader.days
    if reader.timestamp:
        names_git = _GIT.search(text) is not None
        pinning = reader.pinning()
        helpers = {name.rsplit(".", 1)[-1] for name in pinning}
        for node, what, function in reader.commits:
            if what == "git commit" and not names_git:
                continue
            if function in pinning or reader.calls.get(id(node)) in helpers:
                continue
            line = getattr(node, "lineno", 0)
            hits.append(Hit(line, "commit", _UNPINNED if what == "git commit" else what, function))
    return sorted(hits, key=lambda hit: hit.line)


def _text_hits(text: str) -> list[Hit]:
    """A Python file that does not parse, read as text: erring towards failing."""
    if not _TIMESTAMP.search(text):
        return []
    commits = _GIT.search(text) is not None and not all(pin in text for pin in _PINS)
    hits = []
    for number, line in enumerate(text.splitlines(), start=1):
        if read := _TEXT_READ.search(line):
            hits.append(Hit(number, "read", read.group(0) + ")", "<module>"))
        elif commits and (_TEXT_COMMIT.search(line) or _SHELL_COMMIT.search(line)):
            hits.append(Hit(number, "commit", _UNPINNED, "<module>"))
    return hits


def _script_hits(text: str) -> list[Hit]:
    if not _JS_FIXED.search(text):
        return []
    return [
        Hit(number, "read", read.group(0).replace(" ", ""), "<module>")
        for number, line in enumerate(text.splitlines(), start=1)
        if (read := _JS_READ.search(line))
    ]


def hits(relative: str, text: str) -> list[Hit]:
    """Every hit in one test file, by line."""
    if relative.endswith(".py"):
        return _python_hits(text)
    return _script_hits(text)


def _matches(relative: str, glob: str) -> bool:
    """A glob from the root; `PurePath.full_match` where Python has it (3.13), else `fnmatch`."""
    path = PurePosixPath(relative)
    if hasattr(path, "full_match"):
        return bool(path.full_match(glob))
    return fnmatch.fnmatchcase(relative, glob)


@dataclass(frozen=True)
class Allow:
    path: str
    kind: str | None
    function: str | None
    line: int | None

    def excuses(self, relative: str, hit: Hit, count: int) -> bool:
        if not _matches(relative, self.path):
            return False
        if self.kind is None:
            return count == 1
        return (
            hit.kind == self.kind
            and (self.function is None or hit.function == self.function)
            and (self.line is None or hit.line == self.line)
        )


def _entry(entry: object) -> Allow | str:
    """One `[[allow]]` entry, or its problem."""
    if not isinstance(entry, dict):
        return "an entry is not a table"
    glob = entry.get("path")
    if not isinstance(glob, str) or not glob.strip():
        return "an entry names no path"
    reason = entry.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        return f"the entry for {glob!r} gives no reason"
    kind, function, line = entry.get("kind"), entry.get("function"), entry.get("line")
    if kind is None and (function is not None or line is not None):
        return f"the entry for {glob!r} names a function or line but no kind"
    if kind is not None:
        if kind not in KINDS:
            return f"the entry for {glob!r} has kind {kind!r}: use one of {', '.join(KINDS)}"
        if function is None and line is None:
            return f"the entry for {glob!r} names a kind but no function or line"
    if function is not None and not (isinstance(function, str) and function.strip()):
        return f"the entry for {glob!r} has a blank function"
    if line is not None and not (type(line) is int and line > 0):
        return f"the entry for {glob!r} has a line that is not a positive number"
    return Allow(glob, kind, function, line)


def _allowlist(root: Path) -> tuple[list[Allow], list[str]]:
    """The entries, and the allowlist's own problems (fail closed)."""
    path = root / ALLOWLIST
    if not path.is_file():
        return [], []
    try:
        entries = tomllib.loads(path.read_text(encoding="utf-8")).get("allow", [])
    except (OSError, UnicodeDecodeError, tomllib.TOMLDecodeError) as error:
        return [], [f"{ALLOWLIST}: cannot be read: {error}"]
    if not isinstance(entries, list):
        return [], [f"{ALLOWLIST}: `allow` is not a list of [[allow]] tables"]
    allowed: list[Allow] = []
    found: list[str] = []
    for entry in entries:
        parsed = _entry(entry)
        if isinstance(parsed, str):
            found.append(f"{ALLOWLIST}: {parsed}")
        else:
            allowed.append(parsed)
    return allowed, found


def _describe(allow: Allow) -> str:
    narrowed = "".join(
        f", {key} {value!r}"
        for key, value in (("kind", allow.kind), ("function", allow.function), ("line", allow.line))
        if value is not None
    )
    return f"{allow.path!r}{narrowed}"


def problems(root: Path) -> list[str]:
    allowed, found = _allowlist(root)
    used: set[int] = set()
    for path in test_files(root):
        relative = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as error:
            found.append(f"{relative}: cannot be read: {error}")
            continue
        file_hits = hits(relative, text)
        open_hits = []
        for hit in file_hits:
            excusing = [
                index
                for index, allow in enumerate(allowed)
                if allow.excuses(relative, hit, len(file_hits))
            ]
            used.update(excusing)
            if not excusing:
                open_hits.append(hit)
        if open_hits:
            first = open_hits[0]
            found.append(
                f"{relative}:{first.line}: wall clock ({first.what}) in a file that holds a fixed "
                "timestamp: pin the date or pass the time in"
            )
    found.extend(
        f"{ALLOWLIST}: the entry for {_describe(allow)} is stale: it excuses no hit"
        for index, allow in enumerate(allowed)
        if index not in used
    )
    return found


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) > 1:
        print("usage: python -m tools.lint.time_bombs [root]", file=sys.stderr)
        return 2
    found = problems(Path(args[0]) if args else Path.cwd())
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
