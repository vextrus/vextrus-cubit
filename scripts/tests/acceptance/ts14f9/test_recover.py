"""Ticket S14-F9, issue #459: `python -m scripts.factory.recover` lists the dead local builders.

The authority (issue #459, as cut by the session-13 close plan, section 7 and section 8 row 19):
- "`recover.py` only lists dead pids and prints resume lines";
- "`recover.py`: dead-pid list and resume lines";
- acceptance check: "a dead pid gives one resume line, a live one none".
And the orchestrator's brief for this ticket: a local builder whose session is dead (no `pid`, or a `pid`
that is not alive, or one alive but running another command, as a reused pid is) and whose head is not
READY or BLOCKED gets exactly one resume line, the `scripts.factory.say` command that resumes it by its
full `sessionId`; a live session, a READY head and a BLOCKED head get none; a launch record whose
session has no agents row is listed dead by its record's sessionId; it only prints.

Pinned at the command's boundary: `python -m scripts.factory.recover` run as a subprocess in the main
checkout, with the seams the factory already has:
- `VEXTRUS_FACTORY_DIR`: the run folder; the local builders are its launch records,
  `launches/<ticket>-<utc>.json` with `"where": "local"`, written here by `local.write_record` itself
  (the launcher's own writer), each naming `session_id`, `branch`, `name` and `worktree`;
- `VEXTRUS_AGENTS_FILE`: the `claude agents --json --all` rows (fields as the CLI prints them: `id`,
  `cwd`, `kind`, `startedAt`, `sessionId`, `name`, `state`, and `pid` and `status` while a process
  runs);
- the head: the builder's branch, `refs/heads/<branch>` in the main checkout, which its worktree (a real
  `git worktree` at the record's `worktree`) shares, read by trailers.md 1 (`scripts.factory.trailers`);
- pid liveness is real: a live session's pid is a real child process whose command line names the claude
  CLI as it does on the machine (`/proc/<pid>/cmdline`'s first argument `claude`, or the installed
  binary `.../claude/versions/<version>`); a reused pid is a live process running `sleep`; a dead pid is
  one above the kernel's `pid_max`, so no process can hold it.

A resume line is the line holding `scripts.factory.say`; its command, from `uv run`, is a whole
`say` command: `uv run python -m scripts.factory.say <sessionId> --file <f> (--elapsed <n/m> | --ticket
<T>)`, the message file and elapsed time left to the reader (placeholders are allowed). Not pinned: any
other line's words, the exit code, the order of lines, and what is said of live or finished builders.
"""

from __future__ import annotations

import hashlib
import json
import os
import shlex
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import governor, local, status

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-06T10:00:00Z"
SAY = ["uv", "run", "python", "-m", "scripts.factory.say"]
ATTRIBUTION = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"


def session_id(n: int) -> str:
    return f"5f0c3a52-1b2d-4e3f-8a9b-{n:012d}"


def dead_pid() -> int:
    """A pid no process can hold: above the kernel's limit."""
    return int(Path("/proc/sys/kernel/pid_max").read_text().strip()) + 1000


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


class World:
    """A main checkout with its run folder, the agents seam, a stub `claude` and real processes."""

    def __init__(self, tmp: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        self.tmp = tmp
        self.monkeypatch = monkeypatch
        self.main = tmp / "main"
        self.factory = self.main / ".private" / "work" / "factory"
        self.agents_file = tmp / "agents.json"
        self.agents_file.write_text("[]")
        self.claude_calls = tmp / "claude-calls.log"
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )
        self.counter = 0
        self.children: list[subprocess.Popen[bytes]] = []
        self.rows: list[dict[str, Any]] = []
        self.main.mkdir()
        self.git("init", "-q", "-b", "main")
        (self.main / "README").write_text("seed\n")
        self.git("add", "README")
        self.git("commit", "-q", "-m", "seed")
        self.base = self.git("rev-parse", "HEAD")
        (self.factory / "launches").mkdir(parents=True)
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        claude = self.stubs / "claude"
        claude.write_text(
            f"#!{sys.executable}\nimport json, sys\n"
            f"open({str(self.claude_calls)!r}, 'a').write(json.dumps(sys.argv[1:]) + '\\n')\n"
            "print('[]')\n"
        )
        claude.chmod(0o755)

    # --- git
    def git_env(self) -> dict[str, str]:
        env = {
            k: v
            for k, v in os.environ.items()
            if not k.startswith("GIT_") and not k.startswith("VEXTRUS_") and k != "CLAUDE_PROJECT_DIR"
        }
        env.update(
            GIT_CONFIG_GLOBAL=str(self.gitconfig),
            GIT_CONFIG_NOSYSTEM="1",
            GIT_AUTHOR_DATE=NOW,
            GIT_COMMITTER_DATE=NOW,
        )
        return env

    def git(self, *args: str, stdin: str | None = None) -> str:
        done = subprocess.run(
            ["git", *args],
            cwd=self.main,
            env=self.git_env(),
            input=stdin,
            capture_output=True,
            text=True,
            check=False,
        )
        assert done.returncode == 0, f"git {args}: {done.stderr}"
        return done.stdout.strip()

    def commit(self, branch: str, head: str) -> str:
        """A new commit on `branch` whose message is a plain one, READY or BLOCKED (trailers.md 1)."""
        self.counter += 1
        parent = self.git("rev-parse", f"refs/heads/{branch}")
        blob = self.git("hash-object", "-w", "--stdin", stdin=f"change {self.counter}\n")
        entries = self.git("ls-tree", parent)
        tree = self.git("mktree", stdin=f"{entries}\n100644 blob {blob}\tchange-{self.counter}.txt\n")
        body = "W999: more of the widget\n\nSome work on the widget.\n"
        if head == "READY":
            body += f"\nFactory-State: READY\nFactory-Verify: {tree} ok\n\n{ATTRIBUTION}"
        elif head == "BLOCKED":
            body += (
                f"\nFactory-State: BLOCKED\nFactory-Reason: the spec names no exit code\n\n{ATTRIBUTION}"
            )
        else:
            assert head == "plain", head
        message = self.tmp / f"message-{self.counter}.txt"
        message.write_text(body)
        sha = self.git("commit-tree", tree, "-p", parent, "-F", str(message))
        self.git("update-ref", f"refs/heads/{branch}", sha)
        return sha

    # --- records, rows, processes
    def builder(self, ticket: str, n: int, head: str = "plain", name: str | None = None) -> str:
        """A local builder launched on its own branch and worktree, by local.py's own record writer,
        with one commit on its head; returns its sessionId."""
        branch = f"{ticket}-branch"
        worktree = self.main / ".claude" / "worktrees" / ticket
        self.git("branch", branch, self.base)
        self.git("worktree", "add", "-q", str(worktree), branch)
        prompt = self.tmp / "prompt.md"
        prompt.write_text("Build it.\n")
        args = local.parse(
            [
                *("--ticket", ticket, "--branch", branch, "--effort", "medium"),
                *("--name", name or f"{ticket}-local", "--prompt-file", str(prompt)),
            ]
        )
        self.monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(self.factory))
        sid = session_id(n)
        local.write_record(
            args,
            status.parse_utc(NOW),
            governor.Verdict("local-agent"),
            "2.1.999",
            sid,
            worktree,
            None,
            [],
        )
        self.commit(branch, head)
        return sid

    def cloud_builder(self, ticket: str) -> None:
        record: dict[str, Any] = {
            "ticket": ticket,
            "branch": f"{ticket}-branch",
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
        (self.factory / "launches" / f"{ticket}-20261006T100000Z.json").write_text(json.dumps(record))

    def claude_process(self, argv0: str = "claude") -> int:
        """A live process whose command line names the claude CLI (`argv0`); returns its pid."""
        child = subprocess.Popen([argv0, "3600"], executable="/bin/sleep")
        self.children.append(child)
        return child.pid

    def other_process(self) -> int:
        """A live process running another command (a pid reused after the session's process ended)."""
        child = subprocess.Popen(["sleep", "3600"])
        self.children.append(child)
        return child.pid

    def row(
        self,
        sid: str,
        ticket: str,
        state: str = "done",
        pid: int | None = None,
        name: str | None = None,
        kind: str = "background",
    ) -> None:
        row: dict[str, Any] = {
            "id": sid[:8],
            "cwd": str(self.main / ".claude" / "worktrees" / ticket),
            "kind": kind,
            "startedAt": 1791240106487 + len(self.rows),
            "sessionId": sid,
            "name": name or f"{ticket}-local",
            "state": state,
        }
        if pid is not None:
            row["pid"] = pid
            row["status"] = "busy"
        self.rows.append(row)
        self.agents_file.write_text(json.dumps(self.rows, indent=1))

    def close(self) -> None:
        for child in self.children:
            child.kill()
            child.wait()

    # --- the command
    def env(self) -> dict[str, str]:
        env = self.git_env()
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_NOW=NOW,
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_AGENTS_FILE=str(self.agents_file),
        )
        return env

    def recover(self) -> subprocess.CompletedProcess[str]:
        done = subprocess.run(
            [sys.executable, "-m", "scripts.factory.recover"],
            cwd=self.main,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
        assert "No module named" not in done.stderr, show(done)
        assert "Traceback" not in done.stderr, show(done)
        return done

    def resumed(self) -> list[str]:
        """The sessionId of each resume line, in order, each line's command checked as a whole `say`
        command."""
        done = self.recover()
        found = []
        for line in done.stdout.splitlines():
            if "scripts.factory.say" not in line:
                continue
            start = line.find("uv run python -m scripts.factory.say")
            assert start >= 0, f"a resume line without its `uv run` command: {line!r}\n{show(done)}"
            words = shlex.split(line[start:])
            assert words[:5] == SAY, line
            assert len(words) == 10, f"not one whole say command: {line!r}"
            options = dict(zip(words[6::2], words[7::2], strict=True))
            assert set(options) in ({"--file", "--elapsed"}, {"--file", "--ticket"}), line
            assert all(value and not value.startswith("--") for value in options.values()), line
            found.append(words[5])
        return found


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[World]:
    made = World(tmp_path, monkeypatch)
    yield made
    made.close()


@pytest.mark.parametrize(
    "argv0",
    ["claude", "/opt/example/.local/share/claude/versions/2.1.999"],
    ids=["claude", "installed-binary"],
)
def test_a_dead_pid_gives_one_resume_line_and_a_live_one_none(world: World, argv0: str) -> None:
    dead = world.builder("tr1", 1)
    live = world.builder("tr2", 2)
    world.row(dead, "tr1", state="working", pid=dead_pid())
    world.row(live, "tr2", state="working", pid=world.claude_process(argv0))

    assert world.resumed() == [dead]


@pytest.mark.parametrize("state", ["done", "working", "blocked", "stopped", "failed"])
def test_a_session_with_no_pid_gives_one_resume_line_whatever_its_row_state(
    world: World, state: str
) -> None:
    dead = world.builder("tr3", 3)
    world.row(dead, "tr3", state=state)

    assert world.resumed() == [dead]


def test_each_dead_session_gets_exactly_one_resume_line(world: World) -> None:
    no_pid = world.builder("tr4", 4)
    gone = world.builder("tr5", 5)
    reused = world.builder("tr6", 6)
    live = world.builder("tr7", 7)
    world.row(no_pid, "tr4", state="done")
    world.row(gone, "tr5", state="working", pid=dead_pid())
    world.row(reused, "tr6", state="working", pid=world.other_process())
    world.row(live, "tr7", state="working", pid=world.claude_process())

    assert sorted(world.resumed()) == sorted([no_pid, gone, reused])


def test_a_live_pid_running_another_command_counts_as_dead(world: World) -> None:
    reused = world.builder("tr8", 8)
    live = world.builder("tr9", 9)
    world.row(reused, "tr8", state="working", pid=world.other_process())
    world.row(live, "tr9", state="working", pid=world.claude_process())

    assert world.resumed() == [reused]


def test_a_ready_head_gives_no_resume_line(world: World) -> None:
    ready = world.builder("tr10", 10, head="READY")
    dead = world.builder("tr11", 11)
    world.row(ready, "tr10", state="done")
    world.row(dead, "tr11", state="done")

    assert world.resumed() == [dead]


def test_a_blocked_head_gives_no_resume_line(world: World) -> None:
    blocked = world.builder("tr12", 12, head="BLOCKED")
    dead = world.builder("tr13", 13)
    world.row(blocked, "tr12", state="done")
    world.row(dead, "tr13", state="done")

    assert world.resumed() == [dead]


def test_a_launch_record_with_no_agents_row_is_listed_dead_by_its_record_session_id(
    world: World,
) -> None:
    missing = world.builder("tr14", 14)
    live = world.builder("tr15", 15)
    world.row(live, "tr15", state="working", pid=world.claude_process())

    assert world.resumed() == [missing]


def test_a_live_session_under_the_same_name_does_not_make_the_recorded_session_live(
    world: World,
) -> None:
    """The builder's session is the record's sessionId: a live session restarted under a reused name
    is another session."""
    recorded = world.builder("tr16", 16, name="s14-reused")
    world.row(recorded, "tr16", state="done", name="s14-reused")
    world.row(session_id(99), "tr16", state="working", pid=world.claude_process(), name="s14-reused")

    assert world.resumed() == [recorded]


def test_a_session_attached_interactively_is_live(world: World) -> None:
    """say.py's rule: a session attached interactively has a background row with no pid and an
    interactive row holding the live pid; it is alive."""
    attached = world.builder("tr17", 17)
    dead = world.builder("tr18", 18)
    world.row(attached, "tr17", state="working")
    world.row(attached, "tr17", state="working", pid=world.claude_process(), kind="interactive")
    world.row(dead, "tr18", state="done")

    assert world.resumed() == [dead]


def test_a_dead_session_with_no_local_launch_record_gives_no_resume_line(world: World) -> None:
    """Only local builders are listed: not a session the factory did not launch, nor a cloud
    builder."""
    dead = world.builder("tr19", 19)
    world.row(dead, "tr19", state="done")
    world.row(session_id(77), "tr20", state="done", name="a-session-of-its-own")
    world.cloud_builder("tr21")

    assert world.resumed() == [dead]


def snapshot(world: World) -> dict[str, str]:
    files = {
        str(path.relative_to(world.tmp)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(world.tmp.rglob("*"))
        if path.is_file()
        and ".git" not in path.relative_to(world.tmp).parts
        and path != world.claude_calls
    }
    files["refs"] = world.git("for-each-ref", "--format=%(refname) %(objectname)")
    files["worktrees"] = world.git("worktree", "list", "--porcelain")
    return files


def test_recover_changes_nothing_it_only_prints(world: World) -> None:
    dead = world.builder("tr22", 22)
    gone = world.builder("tr23", 23)
    live = world.builder("tr24", 24)
    world.row(dead, "tr22", state="done")
    world.row(gone, "tr23", state="working", pid=dead_pid())
    world.row(live, "tr24", state="working", pid=world.claude_process())
    before = snapshot(world)

    assert sorted(world.resumed()) == sorted([dead, gone])

    assert snapshot(world) == before
    calls = world.claude_calls.read_text().splitlines() if world.claude_calls.exists() else []
    assert [call for call in calls if "agents" not in json.loads(call)] == []
