"""`uv run python <harness>/scripts/factory/lens_pytest.py [flags] <test path> ...`: the one test
command a review lens may run (`scripts/factory/review.py`), in its `rv<N>` worktree.

A lens's `Bash(uv run pytest:*)` let it pass any pytest option, and some write or delete outside the
worktree: `--basetemp=<dir>` empties that folder first, `--junitxml`/`--result-log` write files,
`-o`/`-c`/`--rootdir`/`-p` change what runs (S14-R1 review, round 1). This wrapper is run by absolute
path from the review code's own checkout, never from the PR head, and:

- takes only test paths inside the cwd (`tests/x.py`, `tests/x.py::test_y`, a folder) and the flags
  `-q -v -vv -x -s -rf -ra -rA -rfE`, `--tb=short|long|line|no|native`, `-k <expression>` and
  `-m <expression>` of the markers `pyproject.toml` declares (`needs_toolchain`, ...) and and/or/not;
- never selects `live` (an outside service): `-m` may not name it, and every `-m` gets `and not live`;
- bounds the wait for the lock and the run (20 minutes each), kills pytest's whole process group at
  the limit, and dies with its parent (pytest with it);
- runs `python -m pytest -p no:cacheprovider <them>` under the main checkout's
  `.private/work/factory/pytest.lock`, so the lenses of one run, sharing a worktree and a database, never
  run tests at the same time; `PYTEST_ADDOPTS` and `PYTEST_PLUGINS` are dropped.

Exit 2 (nothing run) for anything else; otherwise pytest's own exit code. Standard library only: it runs
on the worktree's interpreter.
"""

import contextlib
import ctypes
import fcntl
import os
import re
import signal
import subprocess
import sys
import time
import tomllib
from pathlib import Path, PurePosixPath
from typing import Any

FLAGS = ("-q", "-v", "-vv", "-x", "-s", "-rf", "-ra", "-rA", "-rfE")
TB_STYLES = ("short", "long", "line", "no", "native")
TB = re.compile(rf"--tb=(?:{'|'.join(TB_STYLES)})")
EXPRESSION = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_ .:()\[\]-]*")
NODE = re.compile(r"([A-Za-z0-9_][A-Za-z0-9_./-]*)((?:::[A-Za-z0-9_\[\]-]+)*)")
DROPPED = ("PYTEST_ADDOPTS", "PYTEST_PLUGINS")
HARNESS = Path(__file__).resolve().parents[2]
# `live` calls an outside service with the owner's key: never selectable, and every -m expression
# gets `and not live` (PR #478 review, round 1).
FORBIDDEN_MARKERS = frozenset({"live"})
# A test run and the wait for the lock are bounded, so a hung attack test never holds the
# machine-wide pytest lock for long; a variable may only lower them (the tests use that).
TIMEOUT = 20 * 60
LOCK_WAIT = 20 * 60
PR_SET_PDEATHSIG = 1


class Refused(Exception):
    pass


def check(argv: list[str], cwd: Path) -> list[str]:
    """The arguments pytest gets, or Refused naming the first one a lens may not pass."""
    out: list[str] = []
    paths = 0
    index = 0
    while index < len(argv):
        part = argv[index]
        if part in FLAGS or TB.fullmatch(part):
            out.append(part)
        elif part == "-k":
            if index + 1 >= len(argv) or not EXPRESSION.fullmatch(argv[index + 1]):
                raise Refused("-k needs a plain expression (words, and/or/not, brackets)")
            out += ["-k", argv[index + 1]]
            index += 1
        elif part == "-m":
            if index + 1 >= len(argv) or not marker_expression(argv[index + 1]):
                raise Refused(
                    "-m takes only the markers declared in pyproject.toml with and/or/not and brackets"
                )
            out += ["-m", f"({argv[index + 1]}) and not {' and not '.join(sorted(FORBIDDEN_MARKERS))}"]
            index += 1
        elif part.startswith("-"):
            raise Refused(f"{part.split('=', 1)[0]} is not an option a lens may pass")
        else:
            found = NODE.fullmatch(part)
            pure = PurePosixPath(found[1]) if found else None
            if pure is None or pure.is_absolute() or ".." in pure.parts:
                raise Refused(f"{part!r} is not a test path inside this worktree")
            target = (cwd / pure).resolve()
            if not target.is_relative_to(cwd.resolve()) or not target.exists():
                raise Refused(f"{part!r} is not a test path inside this worktree")
            out.append(part)
            paths += 1
        index += 1
    if not paths:
        raise Refused("name the test files to run (the PR's changed tests and your own)")
    return out


def declared_markers() -> set[str]:
    """The marker names `pyproject.toml` declares, read from the review code's own checkout (the
    repo's addopts deselect `needs_toolchain`, `needs_bwrap` and `live` unless `-m` names them)."""
    try:
        config = tomllib.loads((HARNESS / "pyproject.toml").read_text())
        entries = config["tool"]["pytest"]["ini_options"]["markers"]
    except OSError, ValueError, KeyError, TypeError:
        return set()
    return {str(entry).split(":", 1)[0].strip() for entry in entries if isinstance(entry, str)}


def marker_expression(text: str) -> bool:
    """True when every word of `text` is a declared marker or and/or/not, between brackets."""
    words = re.findall(r"[()]|[^\s()]+", text)
    allowed = (declared_markers() - FORBIDDEN_MARKERS) | {"and", "or", "not", "(", ")"}
    return bool(words) and any(w not in "()" for w in words) and all(w in allowed for w in words)


def options_text() -> str:
    """The options this wrapper takes, in words for a lens's brief (review.py builds the brief from
    this, so the brief never names an option the wrapper refuses, nor leaves one out)."""
    markers = ", ".join(sorted(declared_markers() - FORBIDDEN_MARKERS))
    return (
        f"{' '.join(FLAGS)}; --tb={'|'.join(TB_STYLES)}; -k <test-name expression>; "
        f"-m <expression of the markers {markers} with and/or/not and brackets>"
    )


def lock_path(cwd: Path) -> Path:
    done = subprocess.run(
        ["git", "-C", str(cwd), "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True,
        text=True,
        check=False,
    )
    if done.returncode != 0:
        raise Refused("run from inside a review worktree")
    return Path(done.stdout.strip()).parent / ".private" / "work" / "factory" / "pytest.lock"


def bounded(name: str, default: int) -> int:
    """`default`, or the variable `name` when it is a smaller positive number of seconds."""
    try:
        value = int(os.environ.get(name, ""))
    except ValueError:
        return default
    return value if 0 < value < default else default


def die_with_parent(sig: int) -> None:
    """Have the kernel send `sig` to this process when its parent dies (Linux; elsewhere nothing)."""
    with contextlib.suppress(OSError, AttributeError):
        ctypes.CDLL(None, use_errno=True).prctl(PR_SET_PDEATHSIG, sig)


def wait_for(handle: Any, seconds: int) -> bool:
    """Take the exclusive lock within `seconds`; False when it stays busy."""
    deadline = time.monotonic() + seconds
    while True:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except BlockingIOError:
            if time.monotonic() >= deadline:
                return False
            time.sleep(0.2)


def main(argv: list[str] | None = None) -> int:
    cwd = Path.cwd()
    try:
        args = check(sys.argv[1:] if argv is None else argv, cwd)
        lock = lock_path(cwd)
    except Refused as error:
        print(f"lens_pytest: refused: {error}", file=sys.stderr)
        return 2
    die_with_parent(signal.SIGTERM)
    lock.parent.mkdir(parents=True, exist_ok=True)
    env = {key: value for key, value in os.environ.items() if key not in DROPPED}
    timeout = bounded("VEXTRUS_LENS_PYTEST_TIMEOUT", TIMEOUT)
    with lock.open("a") as handle:
        if not wait_for(handle, bounded("VEXTRUS_LENS_PYTEST_LOCK_WAIT", LOCK_WAIT)):
            print("lens_pytest: the pytest lock stayed busy: nothing run, try again", file=sys.stderr)
            return 75
        child = subprocess.Popen(
            [sys.executable, "-m", "pytest", "-p", "no:cacheprovider", *args],
            cwd=cwd,
            env=env,
            start_new_session=True,  # its own process group: killed whole, with every child
            preexec_fn=lambda: die_with_parent(signal.SIGKILL),
        )

        def stop(signum: int, _frame: object) -> None:
            kill_group(child.pid)
            sys.exit(128 + signum)

        for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            signal.signal(signum, stop)
        try:
            return child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            kill_group(child.pid)
            child.wait()
            print(f"lens_pytest: the run passed {timeout} seconds and was stopped", file=sys.stderr)
            return 124


def kill_group(pid: int) -> None:
    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(pid, signal.SIGKILL)


if __name__ == "__main__":
    sys.exit(main())
