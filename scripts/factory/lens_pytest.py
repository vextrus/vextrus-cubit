"""`uv run python <harness>/scripts/factory/lens_pytest.py [flags] <test path> ...`: the one test
command a review lens may run (`scripts/factory/review.py`), in its `rv<N>` worktree.

A lens's `Bash(uv run pytest:*)` let it pass any pytest option, and some write or delete outside the
worktree: `--basetemp=<dir>` empties that folder first, `--junitxml`/`--result-log` write files,
`-o`/`-c`/`--rootdir`/`-p` change what runs (S14-R1 review, round 1). This wrapper is run by absolute
path from the review code's own checkout, never from the PR head, and:

- takes only test paths inside the cwd (`tests/x.py`, `tests/x.py::test_y`, a folder) and the flags
  `-q -v -vv -x -s -rf -ra -rA -rfE`, `--tb=short|long|line|no|native` and `-k <expression>`;
- runs `python -m pytest -p no:cacheprovider <them>` under the main checkout's
  `.private/work/factory/pytest.lock`, so the lenses of one run, sharing a worktree and a database, never
  run tests at the same time; `PYTEST_ADDOPTS` and `PYTEST_PLUGINS` are dropped.

Exit 2 (nothing run) for anything else; otherwise pytest's own exit code. Standard library only: it runs
on the worktree's interpreter.
"""

import fcntl
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

FLAGS = {"-q", "-v", "-vv", "-x", "-s", "-rf", "-ra", "-rA", "-rfE"}
TB = re.compile(r"--tb=(?:short|long|line|no|native)")
EXPRESSION = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_ .:()\[\]-]*")
NODE = re.compile(r"([A-Za-z0-9_][A-Za-z0-9_./-]*)((?:::[A-Za-z0-9_\[\]-]+)*)")
DROPPED = ("PYTEST_ADDOPTS", "PYTEST_PLUGINS")


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


def main(argv: list[str] | None = None) -> int:
    cwd = Path.cwd()
    try:
        args = check(sys.argv[1:] if argv is None else argv, cwd)
        lock = lock_path(cwd)
    except Refused as error:
        print(f"lens_pytest: refused: {error}", file=sys.stderr)
        return 2
    lock.parent.mkdir(parents=True, exist_ok=True)
    env = {key: value for key, value in os.environ.items() if key not in DROPPED}
    with lock.open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        done = subprocess.run(
            [sys.executable, "-m", "pytest", "-p", "no:cacheprovider", *args],
            cwd=cwd,
            env=env,
            check=False,
        )
    return done.returncode


if __name__ == "__main__":
    sys.exit(main())
