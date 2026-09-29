"""The acceptance check (ADR 0041): acceptance tests are written before the builder starts, by the
`acceptance-writer` agent, and a builder may not weaken them. So, between the base and the head:

- every commit that changes a file under an acceptance path must say so: its message starts with
  `acceptance:`, and it changes nothing else, so the change stands alone in the history for the
  reviewer to read against the writer's report;
- no merge commit changes an acceptance path in its own resolution (`git diff-tree --cc`: what differs
  from every parent). A clean merge from main, bringing other tickets' acceptance tests, changes none;
- no other commit touches a test configuration file (a `conftest.py`, `pyproject.toml`, the web's
  Vite, Vitest or Playwright configuration) with a line that names the acceptance paths: a skip or an
  exclude aimed at them from outside. A tripwire; the runtime check (`acceptance_pytest`) catches a
  skipped or deselected acceptance test however it was done.

Standard library only.

    python -m tools.lint.acceptance <base> [<head>]

Acceptance paths: `<anything>/tests/acceptance/…` (pytest, the engine's tests among them),
`web/src/acceptance/…` (vitest) and `web/e2e/acceptance/…` (Playwright).
"""

import re
import subprocess
import sys
from pathlib import Path

ACCEPTANCE = re.compile(r"(?:^|/)tests/acceptance/|^web/(?:src|e2e)/acceptance/")
CONFIG = re.compile(
    r"(?:^|/)conftest\.py$|^pyproject\.toml$|^web/(?:vite|vitest|playwright)(?:\.[a-z]+)?\.config\.[cm]?[jt]s$"
)
NAMES_ACCEPTANCE = re.compile(r"^[+-](?![+-]{2} ).*acceptance", re.IGNORECASE | re.MULTILINE)
PREFIX = "acceptance:"


def is_acceptance(path: str) -> bool:
    return ACCEPTANCE.search(path) is not None


def _files(output: str) -> list[str]:
    return [name for name in output.split("\0") if name]


def commits(root: Path, base: str, head: str) -> list[tuple[str, str, list[str]]]:
    """Each non-merge commit in base..head, oldest first: its id, subject and the files it changes."""
    ids = _git(root, "rev-list", "--no-merges", "--reverse", f"{base}..{head}").split()
    found = []
    for commit in ids:
        subject = _git(root, "log", "-1", "--format=%s", commit).strip()
        files = _git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "-z", commit)
        found.append((commit, subject, _files(files)))
    return found


def merges(root: Path, base: str, head: str) -> list[tuple[str, list[str]]]:
    """Each merge commit in base..head: its id and the files its own resolution changes."""
    ids = _git(root, "rev-list", "--merges", "--reverse", f"{base}..{head}").split()
    resolved = "diff-tree", "--no-commit-id", "--cc", "--name-only", "-r", "-z"
    return [(commit, _files(_git(root, *resolved, commit))) for commit in ids]


def problems(root: Path, base: str, head: str = "HEAD") -> list[str]:
    found = []
    for commit, subject, files in commits(root, base, head):
        touched = [name for name in files if is_acceptance(name)]
        labelled = subject.startswith(PREFIX)
        if touched and not labelled:
            found.append(
                f"{commit[:12]} changes {touched[0]} (an acceptance test) but its message does not "
                f"start with {PREFIX!r}: only the acceptance-writer's commits change acceptance tests"
            )
        if labelled and (other := [name for name in files if not is_acceptance(name)]):
            found.append(
                f"{commit[:12]} is an {PREFIX!r} commit but also changes {other[0]}: an acceptance "
                "commit changes acceptance tests only"
            )
        for name in filter(CONFIG.search, files):
            diff = _git(root, "show", "--format=", "--unified=0", commit, "--", name)
            if NAMES_ACCEPTANCE.search(diff):
                found.append(
                    f"{commit[:12]} changes a line naming the acceptance tests in {name}: acceptance "
                    "tests are never skipped, excluded or reconfigured from outside"
                )
    for commit, files in merges(root, base, head):
        if touched := [name for name in files if is_acceptance(name)]:
            found.append(
                f"{commit[:12]} is a merge whose own resolution changes {touched[0]} (an acceptance "
                "test): resolve it to one side, then change it only in an acceptance commit"
            )
    return found


def _git(root: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise SystemExit(f"acceptance: git {' '.join(args)} failed: {done.stderr.strip()}")
    return done.stdout


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not args or len(args) > 2:
        print("usage: python -m tools.lint.acceptance <base> [<head>]", file=sys.stderr)
        return 2
    found = problems(Path.cwd(), args[0], args[1] if len(args) == 2 else "HEAD")
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
