"""The acceptance check (ADR 0041): acceptance tests are written before the builder starts, by the
`acceptance-writer` agent, and a builder may not weaken them. So every commit between the base and the
head that changes a file under an acceptance path must say so: its message starts with `acceptance:`,
and it changes nothing else, so the change stands alone in the history for the reviewer to read against
the writer's report. Merge commits are left out (a merge from main brings other tickets' acceptance
tests); the reviewer reads a merge's own resolution. Standard library only.

    python -m tools.lint.acceptance <base> [<head>]

Acceptance paths: `<anything>/tests/acceptance/…` (pytest, the engine's tests among them),
`web/src/acceptance/…` (vitest) and `web/e2e/acceptance/…` (Playwright).
"""

import re
import subprocess
import sys
from pathlib import Path

ACCEPTANCE = re.compile(r"(?:^|/)tests/acceptance/|^web/(?:src|e2e)/acceptance/")
PREFIX = "acceptance:"


def is_acceptance(path: str) -> bool:
    return ACCEPTANCE.search(path) is not None


def commits(root: Path, base: str, head: str) -> list[tuple[str, str, list[str]]]:
    """Each non-merge commit in base..head, oldest first: its id, subject and the files it changes."""
    ids = _git(root, "rev-list", "--no-merges", "--reverse", f"{base}..{head}").split()
    found = []
    for commit in ids:
        subject = _git(root, "log", "-1", "--format=%s", commit).strip()
        files = _git(
            root, "diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "-z", commit
        ).split("\0")
        found.append((commit, subject, [name for name in files if name]))
    return found


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
