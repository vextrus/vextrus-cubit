"""Shared helpers for ticket S14-S1's acceptance tests (not a test file).

`python -m scripts.factory.state [--resume-md <path>]` is driven black-box, as a subprocess whose current
directory is the main checkout (as `scripts.factory.watch` runs). The world is built only from the tools'
own stand-ins and the repo's own writers:

- git: a tmp bare `origin.git`, a `work` clone that pushes ticket branches, and a `main` clone (the main
  checkout). A local builder's commit moves `refs/heads/<branch>` in `main` and is never pushed (its
  worktree shares the main checkout's refs), as watch.py reads it.
- gh: a fake `gh` first on PATH answering `gh pr list` and `gh pr view <number|branch>` with `--json
  <fields>` (only the asked fields, as gh prints them; `--state open|closed|merged|all`, open by default;
  `--head`; `--repo` and `--limit` ignored). It refuses `--jq`/`--template` and every other command
  (exit 1). The same rows, every field, are also in the file `VEXTRUS_PRS_FILE` names (watch.py's seam
  for `gh pr list --state all`). CI is each row's `statusCheckRollup`, as `scripts/land.py` reads it.
- the ledger: records written by `scripts.ledger`'s own `decide` and `commit_record` (a fake leak scan
  and poster) into `$VEXTRUS_FACTORY_DIR/ledger`, the folder the watcher reads.
- `claude agents --json --all`: a fake `claude` first on PATH printing the rows, and the same rows in the
  file `VEXTRUS_AGENTS_FILE` names (governor.py's seam).
- launch records: by `scripts.factory.local`'s own parser and record writer (local builders) and in
  launch-cli.md 5's shape (cloud), under `$VEXTRUS_FACTORY_DIR/launches`.
- the real-drawing lock: `$VEXTRUS_FACTORY_DIR/rdlock.json` in rdlock.py's shape.

The clock is `VEXTRUS_NOW`; every commit pins its dates. Nothing real is read and nothing touches the
network.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import governor, local, status

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-06T10:00:00Z"
DROPPED = {
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_CODE_REMOTE",
    "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS",
    "CLAUDE_CODE_PLUGIN_DIRS",
    "VEXTRUS_ROLE",
}
ATTRIBUTION = (
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
    "Claude-Session: https://claude.ai/code/session_01Example\n"
)

Message = Callable[[str], str]


def ready(tree: str) -> str:
    """A READY commit in the shape of PR #443's (T-W317, session 13): the factory block, a blank line,
    then the attribution block. The shared reader (trailers.py) reads it READY; a last-paragraph reading
    (the session-13 watcher bug) does not."""
    return (
        "W999: build the widget\n\n"
        "## Verify\n- `uv run python -m scripts.verify`: pytest 0, ruff 0.\n\n"
        f"Factory-State: READY\nFactory-Verify: {tree} ok\n\n{ATTRIBUTION}"
    )


def ready_no_verify(_tree: str) -> str:
    """A malformed READY (no Factory-Verify): READY-NO-VERIFY by trailers.md 1."""
    return f"W999: the widget\n\nBody.\n\nFactory-State: READY\n\n{ATTRIBUTION}"


def blocked(_tree: str) -> str:
    return (
        "W999: the widget\n\nBody.\n\n"
        "Factory-State: BLOCKED\nFactory-Reason: the spec names no exit code\n\n"
        f"{ATTRIBUTION}"
    )


def plain(_tree: str) -> str:
    return "wip: more of the widget\n\nNo trailer here.\n"


def stub(path: Path, body: str) -> Path:
    path.write_text(f"#!{sys.executable}\nimport json, os, sys\n{body}")
    path.chmod(0o755)
    return path


FAKE_GH = """
PRS = {prs!r}
args = sys.argv[1:]
def value(*names, default=None):
    for name in names:
        if name in args:
            at = args.index(name)
            return args[at + 1] if at + 1 < len(args) else default
    return default
def refuse(why):
    print("fake gh: " + why, file=sys.stderr)
    sys.exit(1)
if any(flag in args for flag in ("-q", "--jq", "-t", "--template")):
    refuse("--jq and --template are not answered: read --json")
fields = value("--json")
if fields is None:
    refuse("only --json output is answered")
fields = fields.split(",")
rows = json.load(open(PRS))
def shown(row):
    return {{name: row.get(name) for name in fields}}
if args[:2] == ["pr", "list"]:
    state = (value("--state", "-s", default="open") or "open").lower()
    wanted = {{"open": {{"OPEN"}}, "closed": {{"CLOSED", "MERGED"}}, "merged": {{"MERGED"}}}}
    if state != "all":
        rows = [row for row in rows if row["state"] in wanted.get(state, set())]
    head = value("--head", "-H")
    if head is not None:
        rows = [row for row in rows if row["headRefName"] == head]
    print(json.dumps([shown(row) for row in rows]))
elif args[:2] == ["pr", "view"] and len(args) > 2 and not args[2].startswith("-"):
    target = args[2]
    mine = [row for row in rows if str(row["number"]) == target or row["headRefName"] == target]
    if not mine:
        refuse("no pull requests found for " + target)
    mine.sort(key=lambda row: (row["state"] == "OPEN", row["number"]))
    print(json.dumps(shown(mine[-1])))
else:
    refuse("not answered: " + " ".join(args))
"""

FAKE_CLAUDE = """
AGENTS = {agents!r}
args = sys.argv[1:]
if args[:1] == ["agents"] and "--json" in args:
    print(open(AGENTS).read())
    sys.exit(0)
print("fake claude: not answered", file=sys.stderr)
sys.exit(1)
"""


def clean_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith("GIT_") and not k.startswith("VEXTRUS_") and k not in DROPPED
    }
    env.update(extra or {})
    return env


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


class Git:
    """git cut off from the user's and the system's configuration, with pinned dates."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )
        self.counter = 0

    def env(self) -> dict[str, str]:
        return clean_env(
            {
                "GIT_CONFIG_GLOBAL": str(self.gitconfig),
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_ALLOW_PROTOCOL": "file",
                "GIT_AUTHOR_DATE": NOW,
                "GIT_COMMITTER_DATE": NOW,
            }
        )

    def __call__(self, cwd: Path, *args: str, stdin: str | None = None) -> str:
        done = subprocess.run(
            ["git", *args],
            cwd=cwd,
            env=self.env(),
            input=stdin,
            capture_output=True,
            text=True,
            check=False,
        )
        assert done.returncode == 0, f"git {args}: {done.stderr}"
        return done.stdout.strip()

    def commit(self, cwd: Path, message: Message, parent: str) -> str:
        """A commit on `parent` adding one file with unique content, its message built from its tree."""
        self.counter += 1
        blob = self(cwd, "hash-object", "-w", "--stdin", stdin=f"change {self.counter}\n")
        entries = self(cwd, "ls-tree", parent)
        tree = self(cwd, "mktree", stdin=f"{entries}\n100644 blob {blob}\tchange-{self.counter}.txt\n")
        text = self.tmp / f"message-{self.counter}.txt"
        text.write_text(message(tree))
        return self(cwd, "commit-tree", tree, "-p", parent, "-F", str(text))


class World:
    """origin, a pushing clone, the main checkout, its factory folder and the tools' stand-ins."""

    def __init__(self, tmp: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        self.tmp = tmp
        self.monkeypatch = monkeypatch
        self.git = Git(tmp)
        self.origin = tmp / "origin.git"
        self.work = tmp / "work"
        self.main = tmp / "main"
        self.factory = self.main / ".private" / "work" / "factory"
        self.launched = 0
        self.comments = 0
        self.work.mkdir()
        self.git(self.work, "init", "-q", "-b", "main")
        (self.work / "README").write_text("seed\n")
        self.git(self.work, "add", "README")
        self.git(self.work, "commit", "-q", "-m", "seed")
        self.git(tmp, "clone", "-q", "--bare", str(self.work), str(self.origin))
        self.git(self.work, "remote", "add", "origin", str(self.origin))
        self.git(tmp, "clone", "-q", str(self.origin), str(self.main))
        (self.factory / "launches").mkdir(parents=True)

        self.prs_file = tmp / "prs.json"
        self.agents_file = tmp / "agents.json"
        self.prs: list[dict[str, Any]] = []
        self.rows: list[dict[str, Any]] = []
        self._write_seams()
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        stub(self.stubs / "gh", FAKE_GH.format(prs=str(self.prs_file)))
        stub(self.stubs / "claude", FAKE_CLAUDE.format(agents=str(self.agents_file)))

    def _write_seams(self) -> None:
        self.prs_file.write_text(json.dumps(self.prs))
        self.agents_file.write_text(json.dumps(self.rows))

    # --- git
    def tip(self, branch: str) -> str | None:
        out = self.git(self.work, "ls-remote", "origin", f"refs/heads/{branch}")
        return out.split()[0] if out else None

    def push(self, branch: str, message: Message) -> str:
        """A new commit on origin's `branch` (its parent: the branch's tip, else main's)."""
        parent = self.tip(branch) or self.tip("main")
        assert parent
        self.git(self.work, "fetch", "-q", "origin")
        sha = self.git.commit(self.work, message, parent)
        self.git(self.work, "push", "-q", "origin", f"+{sha}:refs/heads/{branch}")
        return sha

    def commit_local(self, branch: str, message: Message) -> str:
        """A local builder's commit: in the main checkout's object store, `refs/heads/<branch>` moved to
        it, origin not pushed. Its parent is the local ref, else origin's tip."""
        self.git(self.main, "fetch", "-q", "origin")
        here = self.git(self.main, "for-each-ref", "--format=%(objectname)", f"refs/heads/{branch}")
        parent = here or self.tip(branch)
        assert parent
        sha = self.git.commit(self.main, message, parent)
        self.git(self.main, "update-ref", f"refs/heads/{branch}", sha)
        return sha

    # --- gh
    def pr(
        self, number: int, branch: str, head: str, *, state: str = "OPEN", ci: str = "SUCCESS"
    ) -> None:
        """A pull request row as `gh pr list --json ...` prints it; `ci` is the `ci` check's conclusion
        (`SUCCESS` or `FAILURE`), the other check green."""

        def check(name: str, conclusion: str) -> dict[str, Any]:
            return {
                "__typename": "CheckRun",
                "name": name,
                "workflowName": name,
                "status": "COMPLETED",
                "conclusion": conclusion,
                "startedAt": NOW,
                "completedAt": NOW,
                "detailsUrl": f"https://github.com/vextrus/vextrus-cubit/actions/runs/1/job/{number}",
            }

        self.prs.append(
            {
                "number": number,
                "title": f"{branch}: the widget",
                "url": f"https://github.com/vextrus/vextrus-cubit/pull/{number}",
                "headRefName": branch,
                "headRefOid": head,
                "baseRefName": "main",
                "state": state,
                "isDraft": False,
                "mergeable": "MERGEABLE",
                "statusCheckRollup": [check("ci", ci), check("lint", "SUCCESS")],
            }
        )
        self._write_seams()

    # --- the ledger, through scripts.ledger's own functions
    def verdict(self, pr: int, head: str, round_: int, word: str) -> None:
        self.monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)
        decision = ledger.decide(f"VERDICT: {word} at {head}\n".encode(), head)
        self.comments += 1
        comment = 9000 + self.comments
        ledger.commit_record(
            pr=pr,
            head=head,
            round_=round_,
            decision=decision,
            exception=None,
            source="review-pr",
            scan=lambda _text: 0,
            post=lambda _pr, _body: comment,
            ledger_dir=self.factory / "ledger",
        )

    # --- launches and sessions
    def launch_local(self, ticket: str, branch: str) -> tuple[str, str]:
        """A local builder's launch record, by local.py's own parser and writer; (its name, its
        session id)."""
        name = f"{ticket}-local"
        args = local.parse(
            [
                *("--ticket", ticket, "--branch", branch, "--effort", "medium"),
                *("--name", name, "--prompt-file", str(self.tmp / "prompt.md")),
            ]
        )
        self.monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(self.factory))
        self.launched += 1
        session = f"5f0c3a52-1b2d-4e3f-8a9b-{self.launched:012d}"
        local.write_record(
            args,
            status.parse_utc(NOW),
            governor.Verdict("local"),
            "2.1.999",
            session,
            self.main / ".claude" / "worktrees" / ticket,
            None,
            [],
        )
        return name, session

    def live(self, name: str, session: str) -> None:
        """`claude agents --json --all`'s row of a live session whose turn is running."""
        self.rows.append(
            {
                "id": f"ae575c{len(self.rows):02d}",
                "cwd": str(self.main / ".claude" / "worktrees" / name),
                "kind": "background",
                "startedAt": NOW,
                "sessionId": session,
                "name": name,
                "state": "working",
                "status": "busy",
                "pid": 4242 + len(self.rows),
            }
        )
        self._write_seams()

    def ended(self, name: str, session: str) -> None:
        """`claude agents --json --all`'s row of a session that has exited: state done, no pid, no
        status (as `claude agents` prints it)."""
        self.rows.append(
            {
                "id": f"ae575c{len(self.rows):02d}",
                "cwd": str(self.main / ".claude" / "worktrees" / name),
                "kind": "background",
                "startedAt": NOW,
                "sessionId": session,
                "name": name,
                "state": "done",
            }
        )
        self._write_seams()

    # --- the real-drawing lock
    def lock(self, ticket: str, head: str) -> None:
        """rdlock.json with a live holder (this test's own pid, so rdlock's dead-pid rule keeps it)."""
        holder = {"kind": "posting", "head": head, "ticket": ticket, "pid": os.getpid(), "since": NOW}
        (self.factory / "rdlock.json").write_text(json.dumps({"holder": holder, "waiters": []}))

    # --- the command
    def env(self) -> dict[str, str]:
        env = self.git.env()
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_NOW=NOW,
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_AGENTS_FILE=str(self.agents_file),
            VEXTRUS_PRS_FILE=str(self.prs_file),
        )
        return env

    def run(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.state", *args],
            cwd=self.main,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def table(self, *args: str) -> str:
        done = self.run(*args)
        assert done.returncode == 0, show(done)
        return done.stdout


def rows(text: str, branch: str) -> list[str]:
    """The lines of `text` naming `branch` as a whole word (not a longer branch name)."""
    word = re.compile(rf"(?<![\w/.-]){re.escape(branch)}(?![\w/.-])")
    return [line for line in text.splitlines() if word.search(line)]


def row(text: str, branch: str) -> str:
    """The one line of `text` naming `branch`: one row per ticket branch."""
    found = rows(text, branch)
    assert len(found) == 1, f"{branch}: {len(found)} rows, one wanted\n{text}"
    return found[0]
