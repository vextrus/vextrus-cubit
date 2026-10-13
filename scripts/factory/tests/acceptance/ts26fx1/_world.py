"""Shared helpers for ticket S26-FX1's watcher tests (not a test file).

Copied in the parts needed from `p6_watch_local/test_watch_local.py`'s `World` (never imported): a tmp
bare `origin.git`, a `work` clone that pushes, and a `main` clone that is the watcher's current
directory; `python -m scripts.factory.watch run --once` runs as a subprocess in `main` with
`VEXTRUS_FACTORY_DIR`, `VEXTRUS_NOW` and the seams `VEXTRUS_AGENTS_FILE`, `VEXTRUS_PRS_FILE`,
`VEXTRUS_LEAKSCAN_CMD` (a clean stub) and `VEXTRUS_JEV_CMD`. Added here: a cloud record started at a
given time, `session.json`, the PR list, an empty commit (its tree its parent's), a worktree for a local
builder at the path its launch record names, and the G1 walk folder. Every commit pins its dates.
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

from scripts.factory import governor, local, status

REPO = Path(__file__).resolve().parents[5]
NOW = "2026-10-04T21:08:00Z"
LATER = "2026-10-04T21:23:00Z"
OLD_DATE = "2026-01-01T00:00:00+0000"
KB_PER_GB = 1024 * 1024
DROPPED = {"CLAUDE_PROJECT_DIR", "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS", "CLAUDE_CODE_PLUGIN_DIRS"}
USAGE = (
    "Current session: 12% used · resets Oct 5, 12:59am (Asia/Dhaka)\n"
    "Current week (all models): 27% used · resets Oct 9, 2:59pm (Asia/Dhaka)\n"
)
ATTRIBUTION = (
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
    "Claude-Session: https://claude.ai/code/session_01Example\n"
)

Message = Callable[[str], str]


def ready(tree: str) -> str:
    return f"factory: the thing\n\nBody.\n\nFactory-State: READY\nFactory-Verify: {tree} ok\n"


def plain(_tree: str) -> str:
    return "wip: more of the thing\n\nNo trailer here.\n"


def status_reply(line: str) -> Message:
    """A builder's answer to a status message: `Factory-Status: <line>`, then its attribution."""
    return lambda _tree: f"status: answer\n\nFactory-Status: {line}\n\n{ATTRIBUTION}"


def stub(path: Path, body: str) -> Path:
    path.write_text(f"#!{sys.executable}\nimport json, os, sys\n{body}")
    path.chmod(0o755)
    return path


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


class World:
    """origin, a pushing clone, the watcher's main checkout, its run folder and its seams."""

    def __init__(self, tmp: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        self.tmp = tmp
        self.monkeypatch = monkeypatch
        self.origin = tmp / "origin.git"
        self.work = tmp / "work"
        self.main = tmp / "main"
        self.factory = self.main / ".private" / "work" / "factory"
        self.walks = self.main / ".private" / "work" / "walks"
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )
        self.counter = 0
        self.work.mkdir()
        self.git(self.work, "init", "-q", "-b", "main")
        (self.work / "README").write_text("seed\n")
        self.git(self.work, "add", "README")
        self.git(self.work, "commit", "-q", "-m", "seed")
        self.git(tmp, "clone", "-q", "--bare", str(self.work), str(self.origin))
        self.git(self.work, "remote", "add", "origin", str(self.origin))
        self.git(tmp, "clone", "-q", str(self.origin), str(self.main))
        (self.factory / "launches").mkdir(parents=True)

        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.calls = tmp / "calls"
        self.calls.mkdir()
        record = "open(os.path.join({d!r}, {n!r}), 'a').write(json.dumps(sys.argv[1:]) + '\\n')\n"
        stub(self.stubs / "claude", record.format(d=str(self.calls), n="claude") + "sys.exit(1)\n")
        stub(self.stubs / "gh", record.format(d=str(self.calls), n="gh") + "print('[]')\n")
        self.leakscan = stub(
            tmp / "leak-clean",
            record.format(d=str(self.calls), n="leakscan")
            + "print('leakscan: hits=0 scanned=7 corpus=0123456789ab')\n",
        )
        self.jev = stub(
            tmp / "jev-ok",
            record.format(d=str(self.calls), n="jev") + "print('jev-model ok jev-1.13.0')\n",
        )
        self.seams = {name: tmp / f"{name}.txt" for name in ("meminfo", "df", "usage", "agents", "prs")}
        self.seams["meminfo"].write_text(
            f"MemTotal: {27 * KB_PER_GB} kB\nMemFree: {KB_PER_GB} kB\n"
            f"MemAvailable: {16 * KB_PER_GB} kB\nSwapTotal: {8 * KB_PER_GB} kB\n"
            f"SwapFree: {8 * KB_PER_GB} kB\n"
        )
        self.seams["df"].write_text(f"    Avail\n{60 * KB_PER_GB}\n")
        self.seams["usage"].write_text(USAGE)
        self.seams["agents"].write_text("[]")
        self.seams["prs"].write_text("[]")

    # --- git
    def git_env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        env.update(
            GIT_CONFIG_GLOBAL=str(self.gitconfig),
            GIT_CONFIG_NOSYSTEM="1",
            GIT_ALLOW_PROTOCOL="file",
            GIT_AUTHOR_DATE=OLD_DATE,
            GIT_COMMITTER_DATE=OLD_DATE,
        )
        return env

    def git(self, cwd: Path, *args: str, stdin: str | None = None) -> str:
        done = subprocess.run(
            ["git", *args],
            cwd=cwd,
            env=self.git_env(),
            input=stdin,
            capture_output=True,
            text=True,
            check=False,
        )
        assert done.returncode == 0, f"git {args}: {done.stderr}"
        return done.stdout.strip()

    def tip(self, branch: str) -> str | None:
        out = self.git(self.work, "ls-remote", "origin", f"refs/heads/{branch}")
        return out.split()[0] if out else None

    def new_tree(self, cwd: Path, parent: str) -> str:
        """`parent`'s tree plus one file with unique content."""
        self.counter += 1
        blob = self.git(cwd, "hash-object", "-w", "--stdin", stdin=f"change {self.counter}\n")
        entries = self.git(cwd, "ls-tree", parent)
        return self.git(
            cwd, "mktree", stdin=f"{entries}\n100644 blob {blob}\tchange-{self.counter}.txt\n"
        )

    def commit(self, cwd: Path, message: Message, *parents: str, empty: bool = False) -> str:
        """A commit on `parents`: a new file in it, or (`empty`) its first parent's tree unchanged."""
        tree = self.tree_in(cwd, parents[0]) if empty else self.new_tree(cwd, parents[0])
        self.counter += 1
        text = self.tmp / f"message-{self.counter}.txt"
        text.write_text(message(tree))
        flags = [flag for parent in parents for flag in ("-p", parent)]
        return self.git(cwd, "commit-tree", tree, *flags, "-F", str(text))

    def push(self, branch: str, message: Message, *parents: str, empty: bool = False) -> str:
        """A new commit on origin's `branch` (parents default to its tip, else main's)."""
        if not parents:
            parent = self.tip(branch) or self.tip("main")
            assert parent
            parents = (parent,)
        self.git(self.work, "fetch", "-q", "origin")
        sha = self.commit(self.work, message, *parents, empty=empty)
        self.git(self.work, "push", "-q", "origin", f"+{sha}:refs/heads/{branch}")
        return sha

    def commit_local(self, branch: str, message: Message, parent: str, *, empty: bool = False) -> str:
        """A local builder's commit: in the main checkout's object store, `refs/heads/<branch>` moved
        to it (its worktree shares these refs). Origin is not pushed."""
        self.git(self.main, "fetch", "-q", "origin")
        sha = self.commit(self.main, message, parent, empty=empty)
        self.git(self.main, "update-ref", f"refs/heads/{branch}", sha)
        return sha

    def tree_in(self, cwd: Path, sha: str) -> str:
        return self.git(cwd, "rev-parse", f"{sha}^{{tree}}")

    def tree_of(self, sha: str) -> str:
        return self.tree_in(self.work, sha)

    # --- records and readings
    def launch_local(self, ticket: str, branch: str) -> tuple[str, Path]:
        """A local builder's launch record, by local.py's own parser and record writer: its name and
        the worktree path the record names."""
        name = f"{ticket}-local"
        prompt = str(self.tmp / "prompt.md")
        args = local.parse(
            [
                *("--ticket", ticket, "--branch", branch, "--effort", "medium"),
                *("--name", name, "--prompt-file", prompt),
            ]
        )
        self.monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(self.factory))
        self.counter += 1
        worktree = self.main / ".claude" / "worktrees" / ticket
        local.write_record(
            args,
            status.parse_utc(NOW),
            governor.Verdict("local"),
            "2.1.999",
            f"5f0c3a52-1b2d-4e3f-8a9b-{self.counter:012d}",
            worktree,
            None,
            [],
        )
        return name, worktree

    def launch_cloud(self, ticket: str, branch: str, started_at: str = NOW) -> None:
        record: dict[str, Any] = {
            "ticket": ticket,
            "branch": branch,
            "where": "cloud",
            "role": "builder",
            "effort": "medium",
            "model": "claude-opus-5-5",
            "budget_minutes": None,
            "session_id": f"session_01Example{ticket}",
            "cli_version": "2.1.999",
            "started_at": started_at,
            "governor": {"unit": "cloud-session", "ok": True},
            "leak_scan": {"status": "interim", "line": "test"},
            "judge": {"ok": True, "code": "ok", "reason": "cloned"},
            "stop_sent": False,
            "untestable": None,
            "review": None,
        }
        stamp = started_at.replace("-", "").replace(":", "")
        (self.factory / "launches" / f"{ticket}-{stamp}.json").write_text(json.dumps(record))

    def session(self, started_utc: str, budget_minutes: int = 600) -> None:
        """session.json: the session running since `started_utc`."""
        text = json.dumps({"started_utc": started_utc, "budget_minutes": budget_minutes, "phases": []})
        (self.factory / "session.json").write_text(text)

    def open_pr(self, number: int, branch: str, head: str) -> None:
        row = {
            "number": number,
            "headRefName": branch,
            "headRefOid": head,
            "state": "OPEN",
            "statusCheckRollup": [],
        }
        self.seams["prs"].write_text(json.dumps([row]))

    def agents(self, *rows: tuple[str, str]) -> None:
        """`claude agents --json --all` rows: (name, state)."""
        made = []
        for n, (name, state) in enumerate(rows):
            row: dict[str, Any] = {
                "id": f"ae575c1{n}",
                "cwd": str(self.main / ".claude" / "worktrees" / name),
                "kind": "background",
                "startedAt": NOW,
                "sessionId": f"5f0c3a52-1b2d-4e3f-8a9b-00000000000{n}",
                "name": name,
                "state": state,
            }
            if state in ("working", "blocked"):
                row["pid"] = 4242 + n
            made.append(row)
        self.seams["agents"].write_text(json.dumps(made))

    # --- the watcher
    def env(self, now: str) -> dict[str, str]:
        env = {
            k: v for k, v in self.git_env().items() if not k.startswith("VEXTRUS_") and k not in DROPPED
        }
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_NOW=now,
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_MEMINFO_FILE=str(self.seams["meminfo"]),
            VEXTRUS_DF_FILE=str(self.seams["df"]),
            VEXTRUS_USAGE_FILE=str(self.seams["usage"]),
            VEXTRUS_AGENTS_FILE=str(self.seams["agents"]),
            VEXTRUS_PRS_FILE=str(self.seams["prs"]),
            VEXTRUS_LEAKSCAN_CMD=str(self.leakscan),
            VEXTRUS_JEV_CMD=str(self.jev),
        )
        return env

    def once(self, now: str = NOW) -> subprocess.CompletedProcess[str]:
        done = subprocess.run(
            [sys.executable, "-m", "scripts.factory.watch", "run", "--once"],
            cwd=self.main,
            env=self.env(now),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
        assert done.returncode == 0, show(done)
        return done

    # --- outputs
    def lines(self) -> list[str]:
        log = self.factory / "events.log"
        return log.read_text().splitlines() if log.exists() else []

    def events(self, kind: str, subject: str | None = None) -> list[str]:
        found = []
        for line in self.lines():
            parts = line.split(" ", 3)
            assert len(parts) >= 3, f"an events.log line is not `<UTC> <KIND> <ticket|-> ...`: {line!r}"
            assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", parts[0]), line
            if parts[1] == kind and (subject is None or parts[2] == subject):
                found.append(line)
        return found

    def items(self, ticket: str) -> list[dict[str, Any]]:
        loaded: dict[str, Any] = json.loads((self.factory / "status.json").read_text())
        return [item for item in loaded["builders"]["items"] if item["ticket"] == ticket]


def detail(line: str) -> str:
    """The `<detail...>` of an events.log line."""
    parts = line.split(" ", 3)
    return parts[3] if len(parts) == 4 else ""
