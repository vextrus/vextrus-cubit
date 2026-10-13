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
- A builder's answer to a status message (the owner's Q-R6) keeps READY: an empty commit (its tree its
  parent's) whose only `Factory-` trailer is `Factory-Status:`, on a head that is READY by these rules; a
  chain of them too. A commit with any file change never does, whatever trailers it carries.
- A commit git cannot read exits non-zero, so the step fails closed, as the workflows' path steps do.
"""

from __future__ import annotations

import os
import subprocess
import sys

from scripts.factory.trailers import read, status_line

MAIN_REFS = ("refs/remotes/origin/main", "refs/heads/main")


class Unreadable(RuntimeError):
    """A commit or ref git cannot read."""


def _git(
    *args: str, check: bool = True, cwd: str | os.PathLike[str] | None = None
) -> subprocess.CompletedProcess[str]:
    done = subprocess.run(["git", *args], capture_output=True, text=True, check=False, cwd=cwd)
    if check and done.returncode != 0:
        raise Unreadable(f"git {' '.join(args)}: {done.stderr.strip() or done.returncode}")
    return done


def _commit(sha: str, cwd: str | os.PathLike[str] | None = None) -> str:
    """The full id of the commit `sha` names; Unreadable when it names none."""
    return _git("rev-parse", "--verify", "--quiet", f"{sha}^{{commit}}", cwd=cwd).stdout.strip()


def _reads_ready(sha: str, cwd: str | os.PathLike[str] | None = None) -> bool:
    message = _git("show", "-s", "--format=%B", sha, cwd=cwd).stdout
    tree = _git("rev-parse", f"{sha}^{{tree}}", cwd=cwd).stdout.strip()
    return read(message, tree).outcome == "READY"


def _on_main(sha: str, cwd: str | os.PathLike[str] | None = None) -> bool:
    """Whether `sha` is main's tip or in its history (origin's copy first, then a local one)."""
    for ref in MAIN_REFS:
        if _git("rev-parse", "--verify", "--quiet", ref, check=False, cwd=cwd).returncode != 0:
            continue
        if _git("merge-base", "--is-ancestor", sha, ref, check=False, cwd=cwd).returncode == 0:
            return True
    return False


def _is_status_reply(sha: str, parent: str, cwd: str | os.PathLike[str] | None = None) -> bool:
    """Whether `sha` is an empty commit on `parent` (same tree) whose only factory trailer is a
    `Factory-Status:` line."""
    if status_line(_git("show", "-s", "--format=%B", sha, cwd=cwd).stdout) is None:
        return False
    trees = [_git("rev-parse", f"{commit}^{{tree}}", cwd=cwd).stdout for commit in (sha, parent)]
    return trees[0] == trees[1]


def ready_commit(sha: str, cwd: str | os.PathLike[str] | None = None) -> str | None:
    """The commit that reads READY under `sha`: `sha` itself, or the first one found by walking back
    over merges of main and empty status replies (the newest commit on that chain carrying the trailer);
    None when the chain reaches a commit that is neither."""
    current = _commit(sha, cwd)
    while True:
        if _reads_ready(current, cwd):
            return current
        parents = _git("rev-list", "--parents", "-n", "1", current, cwd=cwd).stdout.split()[1:]
        merge = len(parents) == 2 and _on_main(parents[1], cwd)
        if not (merge or (len(parents) == 1 and _is_status_reply(current, parents[0], cwd))):
            return None
        current = parents[0]


def is_ready(sha: str) -> bool:
    """READY by the trailer rule, or a chain of merges of main and empty status replies onto a commit
    that is."""
    return ready_commit(sha) is not None


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
