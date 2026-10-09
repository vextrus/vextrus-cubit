"""The acceptance check (ADR 0041): acceptance tests are written before the builder starts, by the
`acceptance-writer` agent, and a builder may not weaken them. So, between the base and the head:

- every commit that changes a file under an acceptance path must say so: its message starts with
  `acceptance:`, and it changes nothing else, so the change stands alone in the history for the
  reviewer to read against the writer's report;
- no merge commit changes an acceptance path in its own resolution: an acceptance file whose content in
  the merge differs from git's own merge of the two parents (`git merge-tree --write-tree`). A clean
  merge from main, bringing other tickets' acceptance tests, changes none. A file git could not merge
  (a conflict) passes only when the merge holds exactly one parent's version of it ("resolved to one
  side"; change it afterwards in an `acceptance:` commit); conflict markers of any label, or a mix of
  the two sides, stay flagged. A merge of 3 or more parents uses `git diff-tree --cc`;
- every `acceptance:` commit carries its counts (`docs/specs/factory/contracts/trailers.md` 3), each on
  its own line anywhere in the message: `red-on-main: <n> failed` (the new tests failing on main) and
  `green-on-throwaway: <n> passed` (passing on a throwaway implementation), both 1 or more and green
  never below red. Exempt: a commit that only deletes acceptance files (a cut withdrawn), and a carried
  branch's older commit listed by full sha in `tools/lint/acceptance_legacy.txt` as that file is at
  the base (a PR cannot exempt itself);
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
RED = re.compile(r"^red-on-main: ([0-9]+) failed$", re.MULTILINE)
GREEN = re.compile(r"^green-on-throwaway: ([0-9]+) passed$", re.MULTILINE)
LEGACY = "tools/lint/acceptance_legacy.txt"
SHA = re.compile(r"[0-9a-f]{40}")


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


def legacy(root: Path, base: str) -> set[str]:
    """The full shas listed in the legacy file as it is at the base (missing: none)."""
    done = subprocess.run(
        ["git", "-C", str(root), "show", f"{base}:{LEGACY}"], capture_output=True, text=True, check=False
    )
    if done.returncode != 0:
        return set()
    lines = (line.strip() for line in done.stdout.splitlines())
    return {line for line in lines if SHA.fullmatch(line)}


def count_problems(message: str) -> list[str]:
    """What is wrong with an acceptance commit's two count lines (empty: they are right)."""
    found = []
    red, green = RED.findall(message), GREEN.findall(message)
    if len(red) != 1:
        found.append("needs exactly one line 'red-on-main: <n> failed'")
    elif int(red[0]) < 1:
        found.append("has 'red-on-main: 0 failed': new tests that pass on main pin nothing")
    if len(green) != 1:
        found.append("needs exactly one line 'green-on-throwaway: <n> passed'")
    elif int(green[0]) < 1:
        found.append("has 'green-on-throwaway: 0 passed': no test was shown to pass")
    if len(red) == len(green) == 1 and 0 < int(green[0]) < int(red[0]):
        found.append(
            f"has green-on-throwaway: {green[0]} passed below red-on-main: {red[0]} failed: every red "
            "test must pass on the throwaway"
        )
    return found


def only_deletes(root: Path, commit: str) -> bool:
    status = _git(root, "diff-tree", "--no-commit-id", "--name-status", "-r", "--root", "-z", commit)
    fields = _files(status)
    kinds = fields[0::2]
    return bool(kinds) and all(kind == "D" for kind in kinds)


def merges(root: Path, base: str, head: str) -> list[tuple[str, list[str]]]:
    """Each merge commit in base..head: its id and the files its own resolution changes. For two
    parents that is what differs from git's own merge of them (exit code ignored), except a conflicted
    path the merge resolved to exactly one parent's version; for 3 or more, or if git cannot merge
    them, what differs from every parent."""
    ids = _git(root, "rev-list", "--merges", "--reverse", f"{base}..{head}").split()
    found = []
    for commit in ids:
        parents = _git(root, "rev-list", "--parents", "-n", "1", commit).split()[1:]
        own = _own_merge(root, parents) if len(parents) == 2 else None
        if own is None:
            cc = _git(root, "diff-tree", "--no-commit-id", "--cc", "--name-only", "-r", "-z", commit)
            found.append((commit, _files(cc)))
            continue
        tree, conflicted = own
        names = _files(
            _git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "-z", tree, commit)
        )
        # A conflicted path needs exactly one side whether or not it differs from merge-tree's tree
        # (which holds markers labelled with the two shas).
        every = [*names, *sorted(conflicted.difference(names))]
        found.append(
            (
                commit,
                [n for n in every if n not in conflicted or not _is_one_side(root, commit, parents, n)],
            )
        )
    return found


def _own_merge(root: Path, parents: list[str]) -> tuple[str, set[str]] | None:
    """The tree git itself makes of merging two parents and the paths it could not merge, or None if
    it makes no tree."""
    done = subprocess.run(
        ["git", "-C", str(root), "merge-tree", "--write-tree", "--name-only", "-z", *parents],
        capture_output=True,
        text=True,
        check=False,
    )
    fields = done.stdout.split("\0")
    if not SHA.fullmatch(fields[0]):
        return None
    # After the tree: the conflicted paths, then an empty field, then informational messages.
    conflicted = set()
    for field in fields[1:]:
        if not field:
            break
        conflicted.add(field)
    return fields[0], conflicted


def _blob(root: Path, rev: str, path: str) -> str | None:
    done = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "--verify", "-q", f"{rev}:{path}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return done.stdout.strip() if done.returncode == 0 else None


def _is_one_side(root: Path, commit: str, parents: list[str], path: str) -> bool:
    """Whether the merge holds exactly one parent's version of the path (or absence)."""
    return _blob(root, commit, path) in {_blob(root, parent, path) for parent in parents}


def problems(root: Path, base: str, head: str = "HEAD") -> list[str]:
    found = []
    exempt = legacy(root, base)
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
        if labelled and commit not in exempt and not only_deletes(root, commit):
            message = _git(root, "log", "-1", "--format=%B", commit)
            found.extend(
                f"{commit[:12]} is an {PREFIX!r} commit whose message {problem} "
                "(docs/specs/factory/contracts/trailers.md 3)"
                for problem in count_problems(message)
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
                "test) from git's own merge of the parents: let git merge it; for a conflict take "
                "exactly one side's file (not conflict markers, not a mix), then change it only in "
                "an acceptance commit"
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
