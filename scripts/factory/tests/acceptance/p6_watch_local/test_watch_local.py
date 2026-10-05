"""Ticket T-WATCH-LOCAL (session 12 phase 6), section 3 A and addendum 1 (its first rule amended in
PR #372 round 1): the watcher reads a local builder's own commits, reads the Factory-* trailers from
the last paragraph only (as the guard does), and reads a merge of main on top of an outcome.

Black-box, as `scripts/factory/tests/acceptance/test_watch.py` (its `World` helper copied in the parts
needed, never imported): a tmp bare `origin.git`, a `work` clone that pushes, and a `main` clone that is
the watcher's current directory; `python -m scripts.factory.watch run --once` runs as a subprocess in
`main` with `VEXTRUS_FACTORY_DIR`, `VEXTRUS_NOW` and the seams `VEXTRUS_AGENTS_FILE`, `VEXTRUS_PRS_FILE`,
`VEXTRUS_LEAKSCAN_CMD` (a stub recording its calls) and `VEXTRUS_JEV_CMD`.

A local launch record is written by `scripts/factory/local.py`'s own `write_record` (arguments from its
own `parse`). A local builder's worktree shares the main checkout's refs, so its commit is made here in
`main` with `git commit-tree` and `git update-ref refs/heads/<branch> <sha>`, and origin is not pushed.
Every commit pins `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`.
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
LATER = "2026-10-04T21:23:00Z"  # 15 minutes on: past READY-WAITING's 10
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


def blocked(reason: str) -> Message:
    return lambda _tree: f"factory: stop\n\nFactory-State: BLOCKED\nFactory-Reason: {reason}\n"


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

    def commit(self, cwd: Path, message: Message, *parents: str) -> str:
        tree = self.new_tree(cwd, parents[0])
        text = self.tmp / "message.txt"
        text.write_text(message(tree))
        flags = [flag for parent in parents for flag in ("-p", parent)]
        return self.git(cwd, "commit-tree", tree, *flags, "-F", str(text))

    def push(self, branch: str, message: Message, *parents: str) -> str:
        """A new commit on origin's `branch` (parents default to its tip, else main's)."""
        if not parents:
            parent = self.tip(branch) or self.tip("main")
            assert parent
            parents = (parent,)
        self.git(self.work, "fetch", "-q", "origin")
        sha = self.commit(self.work, message, *parents)
        self.git(self.work, "push", "-q", "origin", f"+{sha}:refs/heads/{branch}")
        return sha

    def commit_local(self, branch: str, message: Message, parent: str) -> str:
        """What a local builder's commit in its worktree does: a commit in the main checkout's object
        store and `refs/heads/<branch>` moved to it. Origin is not pushed."""
        self.git(self.main, "fetch", "-q", "origin")
        sha = self.commit(self.main, message, parent)
        self.set_local(branch, sha)
        return sha

    def set_local(self, branch: str, sha: str) -> None:
        self.git(self.main, "fetch", "-q", "origin")
        self.git(self.main, "update-ref", f"refs/heads/{branch}", sha)

    def tree_of(self, sha: str) -> str:
        return self.git(self.work, "rev-parse", f"{sha}^{{tree}}")

    # --- records and readings
    def launch_local(self, ticket: str, branch: str, *, name: str | None = None) -> str:
        """A local builder's launch record, by local.py's own parser and record writer."""
        name = name or f"{ticket}-local"
        prompt = str(self.tmp / "prompt.md")
        args = local.parse(
            [
                *("--ticket", ticket, "--branch", branch, "--effort", "medium"),
                *("--name", name, "--prompt-file", prompt),
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

    def status(self) -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads((self.factory / "status.json").read_text())
        return loaded

    def item(self, ticket: str) -> dict[str, Any]:
        mine: list[dict[str, Any]] = [
            item for item in self.status()["builders"]["items"] if item["ticket"] == ticket
        ]
        assert len(mine) == 1, self.status()["builders"]["items"]
        return mine[0]

    def alarms(self, code: str, ticket: str) -> list[dict[str, Any]]:
        return [a for a in self.status()["alarms"] if a["code"] == code and a["subject"] == ticket]

    def calls_of(self, name: str) -> list[list[str]]:
        log = self.calls / name
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def detail(line: str) -> str:
    """The `<detail...>` of an events.log line."""
    return line.split(" ", 3)[3] if len(line.split(" ", 3)) == 4 else ""


def local_builder(world: World, ticket: str, *, row: str = "working") -> str:
    """A local builder launched at origin's tip L of its branch; returns L."""
    branch = f"{ticket}-branch"
    name = world.launch_local(ticket, branch)
    world.agents((name, row))
    return world.push(branch, plain)


# A1
def test_a1_a_local_ready_head_is_seen_without_a_push(world: World) -> None:
    launch_tip = local_builder(world, "tl1")
    head = world.commit_local("tl1-branch", ready, launch_tip)
    assert world.tip("tl1-branch") == launch_tip  # origin is not pushed
    world.once()

    events = world.events("READY", "tl1")
    assert len(events) == 1, world.lines()
    assert detail(events[0]).startswith(head[:8]), events
    item = world.item("tl1")
    assert (item["state"], item["head"], item["where"]) == ("ready", head, "local"), item
    assert not [line for line in world.events("PUSH") if head[:8] in line], world.lines()


# A2
def test_a2_a_local_blocked_head_is_seen_without_a_push(world: World) -> None:
    launch_tip = local_builder(world, "tl2")
    head = world.commit_local("tl2-branch", blocked("the ticket names no exit code"), launch_tip)
    world.once()

    events = world.events("BLOCKED", "tl2")
    assert len(events) == 1, world.lines()
    assert detail(events[0]) == f"{head[:8]} the ticket names no exit code", events
    item = world.item("tl2")
    assert (item["state"], item["head"]) == ("blocked", head), item


# A3
def test_a3_a_new_local_head_replaces_an_old_ready_during_a_fix_round(world: World) -> None:
    name = world.launch_local("tl3", "tl3-branch")
    world.agents((name, "working"))
    first = world.push("tl3-branch", ready)  # pushed by the orchestrator for review
    world.set_local("tl3-branch", first)
    world.once(NOW)
    assert len(world.events("READY", "tl3")) == 1, world.lines()
    assert world.item("tl3")["state"] == "ready"

    second = world.commit_local("tl3-branch", plain, first)  # the fix round, not pushed
    world.agents((name, "working"))
    world.once(LATER)
    item = world.item("tl3")
    assert (item["head"], item["state"]) == (second, "working"), item
    assert world.events("READY-WAITING", "tl3") == [], world.lines()
    assert world.alarms("READY-WAITING", "tl3") == []


# A4
def test_a4_a_malformed_local_ready_raises_one_ready_no_verify(world: World) -> None:
    launch_tip = local_builder(world, "tl4")
    other_tree = world.tree_of(launch_tip)
    head = world.commit_local(
        "tl4-branch",
        lambda _tree: f"factory: y\n\nFactory-State: READY\nFactory-Verify: {other_tree} ok\n",
        launch_tip,
    )
    world.once()
    world.once()

    events = world.events("READY-NO-VERIFY", "tl4")
    assert len(events) == 1, world.lines()
    assert detail(events[0]).startswith(head[:8]), events
    assert world.events("READY", "tl4") == []


# A5
def test_a5_the_launch_tip_in_the_local_ref_raises_no_event(world: World) -> None:
    launch_tip = local_builder(world, "tl5")
    world.set_local("tl5-branch", launch_tip)  # the worktree exists; nothing committed yet
    world.once()

    assert world.events("PUSH", "tl5") == [], world.lines()
    assert world.events("COMMIT", "tl5") == [], world.lines()


def test_a5_a_local_commit_raises_one_commit_event_never_a_push(world: World) -> None:
    launch_tip = local_builder(world, "tl6")
    head = world.commit_local("tl6-branch", plain, launch_tip)
    world.once()
    world.once()

    commits = world.events("COMMIT", "tl6")
    assert len(commits) == 1, world.lines()
    assert detail(commits[0]) == head[:8], commits
    assert world.events("PUSH", "tl6") == [], world.lines()
    item = world.item("tl6")
    assert (item["head"], item["state"]) == (head, "working"), item


# A6 (green today: the leak scan is cloud-only; the pre-push hook scans a local head when it is pushed)
def test_a6_no_leak_scan_on_a_local_head(world: World) -> None:
    launch_tip = local_builder(world, "tl7")
    world.commit_local("tl7-branch", ready, launch_tip)
    world.once()

    assert world.calls_of("leakscan") == []


# A7
def test_a7a_a_local_branch_without_a_local_ref_reads_origins_tip(world: World) -> None:
    launch_tip = local_builder(world, "tl8")  # no worktree yet: no refs/heads/tl8-branch in main
    world.once()

    item = world.item("tl8")
    assert (item["head"], item["state"]) == (launch_tip, "working"), item


def test_a7b_a_branch_git_refuses_as_a_ref_never_crashes_the_pass(world: World) -> None:
    name = world.launch_local("tl9", "a..b")
    world.agents((name, "working"))
    world.once()  # exit 0

    assert world.item("tl9")["head"] is None


def test_a7c_a_local_ready_head_is_seen_with_origin_unreadable(world: World) -> None:
    launch_tip = local_builder(world, "tl10")
    head = world.commit_local("tl10-branch", ready, launch_tip)
    world.git(world.main, "remote", "set-url", "origin", str(world.tmp / "missing.git"))
    world.once()

    events = world.events("READY", "tl10")
    assert len(events) == 1, world.lines()
    assert detail(events[0]).startswith(head[:8]), events
    item = world.item("tl10")
    assert (item["state"], item["head"]) == ("ready", head), item


# A8 (green today)
def test_a8_a_cloud_builder_still_reports_origins_head(world: World) -> None:
    world.launch_cloud("tc1", "tc1-branch")
    pushed = world.push("tc1-branch", ready)
    world.commit_local("tc1-branch", plain, pushed)  # a stray local ref of the same name
    world.once()

    item = world.item("tc1")
    assert (item["head"], item["state"], item["where"]) == (pushed, "ready", "cloud"), item
    events = world.events("READY", "tc1")
    assert len(events) == 1, world.lines()
    assert detail(events[0]).startswith(pushed[:8]), events


# A9 (green today: the count the band prints)
def test_a9_a_finished_local_builder_is_counted_done(world: World) -> None:
    launch_tip = local_builder(world, "tl11", row="done")
    world.commit_local("tl11-branch", plain, launch_tip)
    world.once()

    assert world.item("tl11")["state"] == "done"
    assert world.status()["builders"]["local"]["done"] == 1


# Addendum 1.1, as amended (PR #372 round 1, the orchestrator's decision): ONE rule everywhere, the
# guard's READY push gate and stop-gate.mjs included. Factory-* trailers count only in the LAST
# paragraph, which may also hold the Co-Authored-By and Claude-Session lines; trailers in the
# paragraph before an attribution-only last paragraph are not read.
def test_b1_a_ready_before_an_attribution_paragraph_is_not_ready(world: World) -> None:
    world.launch_cloud("tc2", "tc2-branch")
    world.push("tc2-branch", lambda tree: f"{ready(tree)}\n{ATTRIBUTION}")
    world.once()

    for kind in ("READY", "BLOCKED", "READY-NO-VERIFY"):
        assert world.events(kind, "tc2") == [], world.lines()
    assert world.item("tc2")["state"] == "working"


def test_b1_a_blocked_before_an_attribution_paragraph_is_not_blocked(world: World) -> None:
    world.launch_cloud("tc6", "tc6-branch")
    reason = "the spec names no exit code"
    world.push("tc6-branch", lambda tree: f"{blocked(reason)(tree)}\n{ATTRIBUTION}")
    world.once()

    for kind in ("READY", "BLOCKED", "READY-NO-VERIFY"):
        assert world.events(kind, "tc6") == [], world.lines()
    assert world.item("tc6")["state"] == "working"


def test_b1_a_ready_sharing_the_last_paragraph_with_attribution_is_ready(world: World) -> None:
    world.launch_cloud("tc7", "tc7-branch")
    head = world.push(
        "tc7-branch",
        lambda tree: (
            f"factory: the thing\n\nBody.\n\n"
            f"Factory-State: READY\nFactory-Verify: {tree} ok\n{ATTRIBUTION}"
        ),
    )
    world.once()

    events = world.events("READY", "tc7")
    assert len(events) == 1, world.lines()
    assert detail(events[0]).startswith(head[:8]), events
    assert world.item("tc7")["state"] == "ready"


def test_b1_trailers_in_free_text_earlier_in_the_body_are_never_read(world: World) -> None:
    world.launch_cloud("tc3", "tc3-branch")
    world.push(
        "tc3-branch",
        lambda tree: (
            f"factory: x\n\nFactory-State: READY\nFactory-Verify: {tree} ok\n\n"
            f"A closing note in prose.\n\n{ATTRIBUTION}"
        ),
    )
    world.once()

    for kind in ("READY", "BLOCKED", "READY-NO-VERIFY"):
        assert world.events(kind, "tc3") == [], world.lines()
    assert world.item("tc3")["state"] == "working"


# Addendum 1.2, as amended (PR #372 round 1): the lander merges origin/main on top of a READY head. A
# merge of main inherits its first parent's outcome only when its resolution is empty (`git diff-tree
# --cc <merge>` prints nothing, as merge_ready requires) and its first parent is the head already seen
# with that outcome; an inherited outcome raises no new READY event.
def clean_merge(world: World, branch: str, first: str, second: str, message: str) -> str:
    """`second` merged into `first` with git's own merge result as its tree (an empty resolution),
    set as origin's `branch`."""
    world.git(world.work, "fetch", "-q", "origin")
    tree = world.git(world.work, "merge-tree", "--write-tree", first, second).splitlines()[0]
    text = world.tmp / "message.txt"
    text.write_text(message)
    sha = world.git(world.work, "commit-tree", tree, "-p", first, "-p", second, "-F", str(text))
    resolution = world.git(world.work, "diff-tree", "--no-commit-id", "--cc", sha)
    assert resolution == "", "the merge's resolution is not empty"
    world.git(world.work, "push", "-q", "origin", f"+{sha}:refs/heads/{branch}")
    return sha


def merge_main(world: World, branch: str) -> str:
    """origin/main merged cleanly into origin's `branch` (first parent: the branch's tip)."""
    tip, main = world.tip(branch), world.tip("main")
    assert tip
    assert main
    return clean_merge(world, branch, tip, main, f"Merge origin/main into {branch}\n")


def test_b2_a_clean_merge_of_main_on_a_ready_head_keeps_it_ready(world: World) -> None:
    world.launch_cloud("tc4", "tc4-branch")
    world.push("tc4-branch", ready)
    world.once(NOW)
    assert world.item("tc4")["state"] == "ready"

    world.push("main", plain)  # main moves on
    merged = merge_main(world, "tc4-branch")
    world.once("2026-10-04T21:10:00Z")
    item = world.item("tc4")
    assert (item["head"], item["state"]) == (merged, "ready"), item
    assert len(world.events("READY", "tc4")) == 1, world.lines()

    world.push("main", plain)  # main moves again: the first merge's main parent is now behind its tip
    again = merge_main(world, "tc4-branch")
    world.once("2026-10-04T21:12:00Z")
    item = world.item("tc4")
    assert (item["head"], item["state"]) == (again, "ready"), item
    assert len(world.events("READY", "tc4")) == 1, world.lines()


def test_b2_an_edited_merge_of_main_on_a_ready_head_is_not_ready(world: World) -> None:
    world.launch_cloud("tc8", "tc8-branch")
    ready_head = world.push("tc8-branch", ready)
    world.once(NOW)
    assert world.item("tc8")["state"] == "ready"

    main = world.push("main", plain)
    edited = world.push(  # the merge's own tree adds a file neither parent has
        "tc8-branch", lambda _tree: "Merge origin/main into tc8-branch\n", ready_head, main
    )
    assert world.git(world.work, "diff-tree", "--no-commit-id", "--cc", edited) != ""
    world.once("2026-10-04T21:10:00Z")
    item = world.item("tc8")
    assert (item["head"], item["state"]) == (edited, "working"), item
    assert len(world.events("READY", "tc8")) == 1, world.lines()


def test_b2_a_merge_of_another_branch_on_a_ready_head_is_not_ready(world: World) -> None:
    world.launch_cloud("tc5", "tc5-branch")
    ready_head = world.push("tc5-branch", ready)
    world.once(NOW)
    side = world.push("side", plain)  # not on origin/main
    clean_merge(world, "tc5-branch", ready_head, side, "Merge side into tc5-branch\n")
    world.once("2026-10-04T21:10:00Z")

    assert world.item("tc5")["state"] == "working"
