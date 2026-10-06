"""The READY gate the workflows' light job runs before any heavy job (issue #466, part A).

    GITHUB_EVENT_NAME=<event> python3 -m scripts.factory.ci_gate <sha40>

Prints exactly one line, `ready=true` or `ready=false` (a step appends it to `$GITHUB_OUTPUT`), and exits
0; anything else it says goes to stderr. Standard library only: the light job installs nothing.

- Any event but `pull_request` (a push to main, a run by hand) is `ready=true`: main is never gated.
- On a `pull_request` run the commit is READY when its message reads READY by the trailer rule
  (`scripts.factory.trailers`, docs/specs/factory/contracts/trailers.md 1) with its Factory-Verify line
  naming this commit's tree; or when it is a merge of main onto a commit that is READY by this same rule
  (GitHub's "Update branch" and `land update` make the head that lands such a merge). A merge onto a head
  that is not READY, or of anything but main, is not READY.
- A commit git cannot read exits non-zero, so the step fails closed, as the workflows' path steps do.
"""

from __future__ import annotations

import os
import subprocess
import sys

from scripts.factory.trailers import read

MAIN_REFS = ("refs/remotes/origin/main", "refs/heads/main")


class Unreadable(RuntimeError):
    """A commit or ref git cannot read."""


def _git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    done = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    if check and done.returncode != 0:
        raise Unreadable(f"git {' '.join(args)}: {done.stderr.strip() or done.returncode}")
    return done


def _commit(sha: str) -> str:
    """The full id of the commit `sha` names; Unreadable when it names none."""
    return _git("rev-parse", "--verify", "--quiet", f"{sha}^{{commit}}").stdout.strip()


def _reads_ready(sha: str) -> bool:
    message = _git("show", "-s", "--format=%B", sha).stdout
    tree = _git("rev-parse", f"{sha}^{{tree}}").stdout.strip()
    return read(message, tree).outcome == "READY"


def _on_main(sha: str) -> bool:
    """Whether `sha` is main's tip or in its history (origin's copy first, then a local one)."""
    for ref in MAIN_REFS:
        if _git("rev-parse", "--verify", "--quiet", ref, check=False).returncode != 0:
            continue
        if _git("merge-base", "--is-ancestor", sha, ref, check=False).returncode == 0:
            return True
    return False


def is_ready(sha: str) -> bool:
    """READY by the trailer rule, or a chain of merges of main onto a commit that is."""
    current = _commit(sha)
    while True:
        if _reads_ready(current):
            return True
        parents = _git("rev-list", "--parents", "-n", "1", current).stdout.split()[1:]
        if len(parents) != 2 or not _on_main(parents[1]):
            return False
        current = parents[0]


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(
            "usage: GITHUB_EVENT_NAME=<event> python3 -m scripts.factory.ci_gate <sha>", file=sys.stderr
        )
        return 2
    if os.environ.get("GITHUB_EVENT_NAME") != "pull_request":
        print("ready=true")
        return 0
    try:
        ready = is_ready(argv[0])
    except Unreadable as error:
        print(f"ci_gate: cannot read the commit: {error}", file=sys.stderr)
        return 1
    print(f"ready={'true' if ready else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
