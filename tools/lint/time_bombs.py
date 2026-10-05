"""The time-bomb lint (#308). A Python test file that fixes a timestamp and also reads the wall clock,
or makes a git commit at the wall clock's time, passes until the clock moves past the fixed time and
then fails: in #293 two test files fixed verdict times (`T1 = "2026-10-05T01:00:00Z"`) but committed
"now", `scripts/walk/ready.py` rightly dropped a verdict over 10 minutes older than its head's commit,
and CI went red after 01:10Z (fixed by pinning `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`).

A **test file** is `test_*.py`, `*_test.py`, `conftest.py` or any `.py` under a `tests/` folder
(folders starting with `.`, and `node_modules`, are skipped). It is a problem when it holds a **fixed
timestamp** (`YYYY-MM-DD` then `T` or a space then `HH:MM`) and either a **wall-clock read**
(`datetime.now(`, `datetime.utcnow(`, `date.today(`, `time.time(`, `time.time_ns(`) or a **wall-clock
commit**: the string literal "commit" not followed by `:` (a dict key is data), in a file naming git,
without a mention of both git date variables. The line named is the first read or commit.

It reads files as text, comments included, and so errs towards failing. A hit whose time is never
compared with a commit time goes in the allowlist (`time_bombs_allowlist.toml`): each entry a `path`
glob from the root and a `reason`; an entry with no reason, or matching no hit, fails. Standard library
only.

    python -m tools.lint.time_bombs [root]
"""

import fnmatch
import os
import re
import sys
import tomllib
from collections.abc import Iterator
from pathlib import Path, PurePosixPath

ALLOWLIST = "tools/lint/time_bombs_allowlist.toml"

_SKIPPED_DIRS = {"node_modules", ".venv"}
_TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}")
_CLOCK = re.compile(r"\b(?:datetime\.now|datetime\.utcnow|date\.today|time\.time|time\.time_ns)\(")
_COMMIT = re.compile(r"""(["'])commit\1(?!\s*:)""")
_GIT = re.compile(r"\bgit\b")
_PINS = ("GIT_AUTHOR_DATE", "GIT_COMMITTER_DATE")


def _matches(relative: str, glob: str) -> bool:
    """A glob from the root; `PurePath.full_match` where Python has it (3.13), else `fnmatch`."""
    path = PurePosixPath(relative)
    if hasattr(path, "full_match"):
        return bool(path.full_match(glob))
    return fnmatch.fnmatchcase(relative, glob)


def _is_test_file(relative: PurePosixPath) -> bool:
    name = relative.name
    if not name.endswith(".py"):
        return False
    return (
        name.startswith("test_")
        or name.endswith("_test.py")
        or name == "conftest.py"
        or "tests" in relative.parts[:-1]
    )


def test_files(root: Path) -> Iterator[Path]:
    """Every Python test file under `root`, in a stable order."""
    for folder, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d not in _SKIPPED_DIRS)
        for name in sorted(files):
            path = Path(folder) / name
            if _is_test_file(PurePosixPath(path.relative_to(root).as_posix())):
                yield path


def bomb(text: str) -> tuple[int, str] | None:
    """The line and the name of the first wall-clock read or commit, if the text is a bomb."""
    if not _TIMESTAMP.search(text):
        return None
    commits = _GIT.search(text) is not None and not all(pin in text for pin in _PINS)
    for number, line in enumerate(text.splitlines(), start=1):
        if read := _CLOCK.search(line):
            return number, read.group(0) + ")"
        if commits and _COMMIT.search(line):
            return number, "a git commit without GIT_AUTHOR_DATE and GIT_COMMITTER_DATE"
    return None


def _allowlist(root: Path) -> tuple[list[str], list[str]]:
    """The allowed path globs, and the allowlist's own problems (fail closed)."""
    path = root / ALLOWLIST
    if not path.is_file():
        return [], []
    try:
        entries = tomllib.loads(path.read_text(encoding="utf-8")).get("allow", [])
    except (OSError, UnicodeDecodeError, tomllib.TOMLDecodeError) as error:
        return [], [f"{ALLOWLIST}: cannot be read: {error}"]
    if not isinstance(entries, list):
        return [], [f"{ALLOWLIST}: `allow` is not a list of [[allow]] tables"]
    globs, found = [], []
    for entry in entries:
        glob = entry.get("path") if isinstance(entry, dict) else None
        if not isinstance(glob, str) or not glob.strip():
            found.append(f"{ALLOWLIST}: an entry names no path")
            continue
        reason = entry.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            found.append(f"{ALLOWLIST}: the entry for {glob!r} gives no reason")
            continue
        globs.append(glob)
    return globs, found


def problems(root: Path) -> list[str]:
    globs, found = _allowlist(root)
    used: set[str] = set()
    for path in test_files(root):
        relative = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as error:
            found.append(f"{relative}: cannot be read: {error}")
            continue
        hit = bomb(text)
        if hit is None:
            continue
        allowed = [glob for glob in globs if _matches(relative, glob)]
        if allowed:
            used.update(allowed)
            continue
        line, what = hit
        found.append(
            f"{relative}:{line}: wall clock ({what}) in a file that holds a fixed timestamp: "
            "pin the date or pass the time in"
        )
    found.extend(
        f"{ALLOWLIST}: the entry for {glob!r} is stale: it matches no hit"
        for glob in globs
        if glob not in used
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
