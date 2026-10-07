"""Shared helpers for ticket S14-F1's acceptance tests (not a test file).

The watcher is driven black-box, as
`scripts/factory/tests/acceptance/p6_watch_local/test_watch_local.py` drives it (its `World` copied in
the parts needed, never imported): a tmp bare `origin.git`, a `work` clone that pushes, and a `main`
clone that is the watcher's current directory; `python -m scripts.factory.watch run --once` runs as a
subprocess in `main` with `VEXTRUS_FACTORY_DIR`, `VEXTRUS_NOW` and the seams `VEXTRUS_AGENTS_FILE`
(the `claude agents --json --all` rows), `VEXTRUS_PRS_FILE`, `VEXTRUS_LEAKSCAN_CMD`, `VEXTRUS_JEV_CMD`,
`VEXTRUS_MEMINFO_FILE`, `VEXTRUS_DF_FILE` and `VEXTRUS_USAGE_FILE`.

The gates are driven as Claude Code drives them: `.claude/hooks/guard.mjs` is fed one PreToolUse event on
stdin and `.claude/hooks/stop-gate.mjs` one Stop event, each in a temporary repository.

Every commit pins its author and committer dates (`GIT_DATE`, default `NOW`); nothing real is read.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import governor, local, status

REPO = Path(__file__).resolve().parents[4]
GUARD = REPO / ".claude" / "hooks" / "guard.mjs"
STOP_GATE = REPO / ".claude" / "hooks" / "stop-gate.mjs"
NOW = "2026-10-06T10:00:00Z"
KB_PER_GB = 1024 * 1024
DROPPED = {
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_CODE_REMOTE",
    "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS",
    "CLAUDE_CODE_PLUGIN_DIRS",
    "VEXTRUS_ROLE",
}
USAGE = (
    "Current session: 12% used · resets Oct 6, 12:59pm (Asia/Dhaka)\n"
    "Current week (all models): 27% used · resets Oct 9, 2:59pm (Asia/Dhaka)\n"
)
ATTRIBUTION = (
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
    "Claude-Session: https://claude.ai/code/session_01Example\n"
)

Message = Callable[[str], str]


def node() -> str:
    found = shutil.which("node")
    assert found, "node is not on PATH: the gates are node hooks"
    return found


def t_w317(trailers: str) -> str:
    """A message in the shape of PR #443's READY commit (T-W317, session 13), synthetic words: a
    subject, a body of headed sections and list items, the factory block, a blank line, then the
    attribution block."""
    return (
        "W999: build the widget dumper from its pinned source plus one repair, pinned by hash\n"
        "\n"
        "Closes #999. The dumper now compiles the widget library from source with one repair applied,\n"
        "so the file that was held agrees, with no special rule.\n"
        "\n"
        "## Not verified\n"
        "- The owner's root run of the toolchain script with this pin (not run: it needs root).\n"
        "- The posting run was not run: it passes no dumper folder.\n"
        "\n"
        "## Verify\n"
        "- `uv run python -m scripts.verify`: pytest 0, ruff 0, ruff-format 0, mypy 0, lint-imports 0.\n"
        "\n"
        "## Cut\n"
        "None.\n"
        "\n"
        "## What changed\n"
        "- tools/widget/prepare-source.sh (new): fetches each pinned commit, one deep.\n"
        "\n"
        "Harness net: +1650 / -96 (git diff --numstat origin/main...HEAD; 868 of the added lines\n"
        "are the acceptance commit's).\n"
        "\n"
        f"{trailers}\n"
        "\n"
        f"{ATTRIBUTION}"
    )


def ready_trailers(tree: str) -> str:
    return f"Factory-State: READY\nFactory-Verify: {tree} ok"


REASON = "the acceptance tests for the refusal cannot pass: the spec names no exit code"

# The one table of commit messages every reader is tested against (issue #448's acceptance check:
# "share one table of commit messages"). Each row: the message (built from the commit's own tree) and the
# outcome trailers.md 1 gives it, READY, BLOCKED or READY-NO-VERIFY (a malformed READY).
TABLE: dict[str, tuple[Message, str]] = {
    "t-w317-ready": (lambda tree: t_w317(ready_trailers(tree)), "READY"),
    "t-w317-ready-no-verify": (lambda _tree: t_w317("Factory-State: READY"), "READY-NO-VERIFY"),
    "t-w317-blocked": (
        lambda _tree: t_w317(f"Factory-State: BLOCKED\nFactory-Reason: {REASON}"),
        "BLOCKED",
    ),
}


def outside_the_read_paragraph(tree: str) -> str:
    """The factory block in the third-to-last paragraph: a prose paragraph and the attribution block
    after it."""
    return (
        "W998: the widget\n\nBody.\n\n"
        f"{ready_trailers(tree)}\n\n"
        "A closing note in prose, after the trailers.\n\n"
        f"{ATTRIBUTION}"
    )


def stub(path: Path, body: str) -> Path:
    path.write_text(f"#!{sys.executable}\nimport json, os, sys\n{body}")
    path.chmod(0o755)
    return path


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def plain(_tree: str) -> str:
    return "wip: more of the widget\n\nNo trailer here.\n"


def clean_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith("GIT_") and not k.startswith("VEXTRUS_") and k not in DROPPED
    }
    env.update(extra or {})
    return env


class Git:
    """git cut off from the user's and the system's configuration, with pinned dates."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.date = NOW
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
                "GIT_AUTHOR_DATE": self.date,
                "GIT_COMMITTER_DATE": self.date,
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

    def new_tree(self, cwd: Path, parent: str) -> str:
        """`parent`'s tree plus one file with unique content."""
        self.counter += 1
        blob = self(cwd, "hash-object", "-w", "--stdin", stdin=f"change {self.counter}\n")
        entries = self(cwd, "ls-tree", parent)
        return self(cwd, "mktree", stdin=f"{entries}\n100644 blob {blob}\tchange-{self.counter}.txt\n")

    def commit(self, cwd: Path, message: Message, parent: str) -> str:
        tree = self.new_tree(cwd, parent)
        text = self.tmp / f"message-{self.counter}.txt"
        text.write_text(message(tree))
        return self(cwd, "commit-tree", tree, "-p", parent, "-F", str(text))


# --- the watcher
class World:
    """origin, a pushing clone, the watcher's main checkout, its run folder and its seams."""

    def __init__(self, tmp: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        self.tmp = tmp
        self.monkeypatch = monkeypatch
        self.git = Git(tmp)
        self.origin = tmp / "origin.git"
        self.work = tmp / "work"
        self.main = tmp / "main"
        self.factory = self.main / ".private" / "work" / "factory"
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
        stub(self.stubs / "claude", "sys.exit(1)\n")
        stub(self.stubs / "gh", "print('[]')\n")
        self.leakscan = stub(
            tmp / "leak-clean", "print('leakscan: hits=0 scanned=7 corpus=0123456789ab')\n"
        )
        self.jev = stub(tmp / "jev-ok", "print('jev-model ok jev-1.13.0')\n")
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

    def commit_local(self, branch: str, message: Message, parent: str) -> str:
        """What a local builder's commit in its worktree does: a commit in the main checkout's object
        store and `refs/heads/<branch>` moved to it. Origin is not pushed."""
        self.git(self.main, "fetch", "-q", "origin")
        sha = self.git.commit(self.main, message, parent)
        self.git(self.main, "update-ref", f"refs/heads/{branch}", sha)
        return sha

    # --- records and readings
    def launch_local(self, ticket: str, branch: str) -> str:
        """A local builder's launch record, by local.py's own parser and record writer; returns its
        name."""
        name = f"{ticket}-local"
        args = local.parse(
            [
                *("--ticket", ticket, "--branch", branch, "--effort", "medium"),
                *("--name", name, "--prompt-file", str(self.tmp / "prompt.md")),
            ]
        )
        self.monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(self.factory))
        self.counter += 1
        local.write_record(
            args,
            status.parse_utc(NOW),
            governor.Verdict("local"),
            "2.1.999",
            f"5f0c3a52-1b2d-4e3f-8a9b-{self.counter:012d}",
            self.main / ".claude" / "worktrees" / ticket,
            None,
            [],
        )
        return name

    def launch_cloud(self, ticket: str, branch: str) -> None:
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
            "started_at": NOW,
            "governor": {"unit": "cloud-session", "ok": True},
            "leak_scan": {"status": "interim", "line": "test"},
            "judge": {"ok": True, "code": "ok", "reason": "cloned"},
            "stop_sent": False,
            "untestable": None,
            "review": None,
        }
        stamp = NOW.replace("-", "").replace(":", "")
        (self.factory / "launches" / f"{ticket}-{stamp}.json").write_text(json.dumps(record))

    def agents(self, *rows: tuple[str, str, str]) -> None:
        """`claude agents --json --all` rows of live sessions: (name, state, status), status `busy` or
        `idle` as `claude agents` prints them."""
        made = []
        for n, (name, state, activity) in enumerate(rows):
            made.append(
                {
                    "id": f"ae575c1{n}",
                    "cwd": str(self.main / ".claude" / "worktrees" / name),
                    "kind": "background",
                    "startedAt": NOW,
                    "sessionId": f"5f0c3a52-1b2d-4e3f-8a9b-00000000000{n}",
                    "name": name,
                    "state": state,
                    "status": activity,
                    "pid": 4242 + n,
                }
            )
        self.seams["agents"].write_text(json.dumps(made))

    def env(self, now: str) -> dict[str, str]:
        env = self.git.env()
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

    def once(self, now: str = NOW) -> None:
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

    # --- outputs
    def lines(self) -> list[str]:
        log = self.factory / "events.log"
        return log.read_text().splitlines() if log.exists() else []

    def events(self, kind: str, subject: str | None = None) -> list[str]:
        """events.log lines `<UTC> <KIND> <ticket|-> <detail>` of this kind (and subject)."""
        found = []
        for line in self.lines():
            parts = line.split(" ", 3)
            assert len(parts) >= 3, f"an events.log line is not `<UTC> <KIND> <ticket|-> ...`: {line!r}"
            assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", parts[0]), line
            if parts[1] == kind and (subject is None or parts[2] == subject):
                found.append(line)
        return found

    def item(self, ticket: str) -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads((self.factory / "status.json").read_text())
        mine: list[dict[str, Any]] = [i for i in loaded["builders"]["items"] if i["ticket"] == ticket]
        assert len(mine) == 1, loaded["builders"]["items"]
        return mine[0]


def detail(line: str) -> str:
    """The `<detail...>` of an events.log line."""
    parts = line.split(" ", 3)
    return parts[3] if len(parts) == 4 else ""


def at(minutes: int) -> str:
    """`NOW` plus `minutes`."""
    return status.utc(status.parse_utc(NOW) + timedelta(minutes=minutes))


# --- the gates
class Scratch:
    """A temporary repository on `branch` with one base commit, `origin/main` at it."""

    def __init__(self, tmp: Path, name: str, branch: str) -> None:
        self.git = Git(tmp)
        self.repo = tmp / name
        self.repo.mkdir()
        self.git(self.repo, "init", "-q", "-b", branch)
        (self.repo / "work.txt").write_text("base\n")
        self.git(self.repo, "add", "work.txt")
        self.git(self.repo, "commit", "-q", "-m", "base: the first commit")
        self.base = self.git(self.repo, "rev-parse", "HEAD")
        self.git(self.repo, "update-ref", "refs/remotes/origin/main", self.base)

    def commit(self, message: Message) -> str:
        """Commits a tracked change with `message` (built from the commit's own tree); returns the
        tree."""
        self.git.counter += 1
        with (self.repo / "work.txt").open("a") as f:
            f.write(f"change {self.git.counter}\n")
        self.git(self.repo, "add", "work.txt")
        tree = self.git(self.repo, "write-tree")
        text = self.git.tmp / f"{self.repo.name}-message.txt"
        text.write_text(message(tree))
        self.git(self.repo, "commit", "-q", "-F", str(text))
        assert self.git(self.repo, "rev-parse", "HEAD^{tree}") == tree
        return tree

    def dirty(self) -> None:
        with (self.repo / "work.txt").open("a") as f:
            f.write("uncommitted\n")

    def verify_record(self, tree: str) -> None:
        """A green verify record (verify-record.schema.json) at
        `<git-common-dir>/vextrus/verify-<tree>.json`."""
        common = self.git(self.repo, "rev-parse", "--path-format=absolute", "--git-common-dir")
        folder = Path(common) / "vextrus"
        folder.mkdir(parents=True, exist_ok=True)
        checks = [
            {
                "name": name,
                "command": command,
                "exit_code": 0,
                "raw_exit_code": 0,
                "flakes": [],
                "output_file": f".private/work/check-{i}.txt",
            }
            for i, (name, command) in enumerate(
                [("pytest", "uv run pytest -rf"), ("ruff", "uv run ruff check .")]
            )
        ]
        record = {"schema_version": 1, "tree": tree, "written_at": NOW, "ok": True, "checks": checks}
        (folder / f"verify-{tree}.json").write_text(json.dumps(record))


def guard_push(own: Scratch, main: Scratch) -> str | None:
    """A cloud session's `git push origin HEAD` of its own branch, judged by the guard: the refusing
    rule's name, or None when the guard lets it through."""
    event = {
        "tool_name": "Bash",
        "tool_input": {"command": "git push origin HEAD"},
        "cwd": str(own.repo),
    }
    env = own.git.env()
    env.update(
        CLAUDE_PROJECT_DIR=str(own.repo),
        CLAUDE_CODE_REMOTE="true",
        VEXTRUS_MAIN_CHECKOUT=str(main.repo),
    )
    done = subprocess.run(
        [node(), str(GUARD)],
        input=json.dumps(event),
        cwd=own.repo,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert done.returncode == 0, show(done)
    if done.stdout.strip() == "":
        return None
    out = json.loads(done.stdout)["hookSpecificOutput"]
    assert out["permissionDecision"] == "deny", out
    rule: str = out["permissionDecisionReason"].split(":")[0]
    return rule


def stop(project: Scratch) -> dict[str, Any] | None:
    """A local builder's Stop, judged by the stop gate: its block decision, or None when it lets the stop
    through."""
    event = {
        "hook_event_name": "Stop",
        "session_id": "s",
        "stop_hook_active": False,
        "last_assistant_message": "Done.",
        "cwd": str(project.repo),
    }
    env = project.git.env()
    env.update(CLAUDE_PROJECT_DIR=str(project.repo), VEXTRUS_ROLE="builder")
    done = subprocess.run(
        [node(), str(STOP_GATE)],
        input=json.dumps(event),
        cwd=project.repo,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert done.returncode == 0, show(done)
    if done.stdout.strip() == "":
        return None
    out: dict[str, Any] = json.loads(done.stdout)
    return out
