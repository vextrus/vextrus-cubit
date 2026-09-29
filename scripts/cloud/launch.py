"""Launch one cloud session and refuse to call it launched unless it was cloned from GitHub.

`claude --cloud` silently uploads a local copy of the checkout (a git bundle, no `origin`) when the
Claude GitHub App does not cover the repository; such a session cannot push or open a PR. Session 05's
six cloud tickets and session 06's first diagnostics came up that way (29 Sep 2026; the cause was read
from the CLI's own debug log: "GitHub app is not installed ... Bundling (reason:
github_preflight_failed)").
This wrapper runs the launch with a debug log and judges that log, so the class fails loudly at launch.

    uv run python -m scripts.cloud.launch --branch 19a-takeoff-step1 --prompt-file <file> [--model M]
        [--effort E] [--log <debug log>]

Run it from the ticket's worktree, on the ticket's branch, pushed: the CLI sends the current branch as
the session's revision. Exit 0: cloned at that branch (the session id is printed). Exit 2: bundled, or
another revision; delete that session in the web UI.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

BUNDLED = re.compile(r"\[teleportToRemote\] Bundling \(reason: ([^)]*)\)")
SOURCE = re.compile(r"\[teleportToRemote\] Git source: (\S+), revision: (\S+)")
CREATED = re.compile(r"Successfully created remote session: (session_\w+)")


@dataclass(frozen=True)
class Verdict:
    ok: bool
    reason: str
    session: str | None = None


def judge(log: str, *, repository: str, branch: str) -> Verdict:
    """Read a `claude --debug-file` log of one `--cloud` launch."""
    session = m.group(1) if (m := CREATED.search(log)) else None
    if bundled := BUNDLED.search(log):
        why = f"bundled, not cloned ({bundled.group(1)}): the session has no origin"
        return Verdict(False, why, session)
    source = SOURCE.search(log)
    if source is None:
        return Verdict(False, "the log names no git source: how it was seeded is unknown", session)
    if source.group(1) != repository:
        return Verdict(False, f"cloned {source.group(1)}, not {repository}", session)
    if source.group(2) != branch:
        why = f"cloned at revision {source.group(2)}, not the ticket's branch {branch}"
        return Verdict(False, why, session)
    if session is None:
        return Verdict(False, "cloned, but no session was created", None)
    return Verdict(True, f"cloned {repository} at {branch}", session)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="scripts.cloud.launch")
    p.add_argument("--branch", required=True)
    p.add_argument("--prompt-file", required=True, type=Path)
    p.add_argument("--model")
    p.add_argument("--effort")
    p.add_argument("--log", type=Path, default=Path(".private/work/cloud-launch.debug.log"))
    p.add_argument("--repository", default="github.com/vextrus/vextrus-cubit")
    a = p.parse_args(argv)
    a.log.parent.mkdir(parents=True, exist_ok=True)
    a.log.unlink(missing_ok=True)  # an earlier launch's lines must never judge this one
    command = ["claude", "--debug-file", str(a.log)]
    command += ["--model", a.model] if a.model else []
    command += ["--effort", a.effort] if a.effort else []
    command += ["--cloud", a.prompt_file.read_text()]
    # The CLI wants a terminal; `script` gives it one and keeps its screen out of ours.
    subprocess.run(
        ["script", "-q", "-c", " ".join(_quote(c) for c in command), "/dev/null"],
        stdout=subprocess.DEVNULL,
        check=False,
    )
    verdict = judge(a.log.read_text(errors="replace"), repository=a.repository, branch=a.branch)
    session = f" {verdict.session}" if verdict.session else ""
    print(("OK " if verdict.ok else "REFUSED ") + verdict.reason + session)
    return 0 if verdict.ok else 2


def _quote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


if __name__ == "__main__":
    sys.exit(main())
