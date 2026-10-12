"""S24-A6 (session 24's brief, Wave A): "`launch` refuses a second builder on a ticket" (session 23 ran a
cloud and a local builder on FL8 at once).

`python -m scripts.factory.launch cloud|local ... --ticket T` refuses a builder launch while ticket T
already has a live builder launch: exit 2, first line `REFUSED <code>: <reason>` (launch-cli.md 1), the
reason naming the live builder's session; nothing is launched (no `claude` call, no worktree). Live, as
the governor and the watcher already read the launch records (`$VEXTRUS_FACTORY_DIR/launches/*.json`):
a cloud builder record whose judge was ok and whose STOP was not sent, started minutes ago with no
merged PR on its branch; a local builder record whose session `claude agents --json --all` lists with a
pid. An acceptance writer's record is not a builder, and a local session that has ended (no pid) is not
live: neither blocks the builder.

Cloud: the f1 seams (`launch_cloud(req, *, root, claude, scan, govern, snapshot, now)`, a temporary
bare origin and main checkout; `--record-dir` is `$VEXTRUS_FACTORY_DIR/launches`). Local: the f3
launcher's black-box world (stub `claude` and `uv`, the governor's file seams), run through `python -m
scripts.factory.launch local`. `VEXTRUS_PRS_FILE` lists the PRs (none open), so no `gh` is reached.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from scripts.factory.tests.acceptance.test_launch_local import Launcher, first_line, show
from scripts.factory.tests.acceptance.tf1.test_launch_cloud import (
    BRANCH,
    TICKET,
    FakeClaude,
    Run,
    World,
    clean_scan,
    git,
    ok_govern,
)

CLOUD_NOW = datetime(2026, 10, 4, 21, 30, 0, tzinfo=UTC)
LOCAL_NOW = "2026-10-04T21:08:00Z"
LIVE_CLOUD = "session_01LiveBuilder"
LIVE_LOCAL_ID = "0b5e2c71-9a3d-4e6f-8b1c-2d4e6f8a0b1c"


def builder_record(
    ticket: str,
    branch: str,
    *,
    where: str,
    started_at: str,
    role: str = "builder",
    session_id: str | None = None,
    name: str | None = None,
) -> dict[str, Any]:
    """A launch record as launch.py (cloud) or local.py (local) writes it."""
    record: dict[str, Any] = {
        "ticket": ticket,
        "branch": branch,
        "where": where,
        "role": role,
        "effort": "medium",
        "model": "claude-sonnet-5-5",
        "budget_minutes": 120,
        "session_id": session_id,
        "cli_version": "2.1.999",
        "started_at": started_at,
        "governor": {"unit": f"{where}-session", "ok": True},
        "leak_scan": {"status": "clean", "line": "leakscan: hits=0"},
        "judge": {"ok": True, "code": "ok", "reason": "cloned"} if where == "cloud" else None,
        "stop_sent": False,
        "untestable": None,
        "review": None,
    }
    if where == "local":
        record.update(name=name, worktree=f"/nowhere/.claude/worktrees/{ticket}", carried_merge_sha=None)
    return record


def put(folder: Path, record: dict[str, Any]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    stamp = str(record["started_at"]).replace("-", "").replace(":", "")
    (folder / f"{record['ticket']}-{stamp}.json").write_text(json.dumps(record))


# --- cloud ------------------------------------------------------------------------------------------


@pytest.fixture
def cloud(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    """tf1's world: a bare origin, the main checkout at `<tmp>/main` with the ticket's branch pushed
    (an `acceptance:` commit on it), a `claude` on PATH that answers only `--version`."""
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    factory = tmp_path / "factory"
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(factory))
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-04T21:30:00Z")
    prs = tmp_path / "prs.json"
    prs.write_text("[]")
    monkeypatch.setenv("VEXTRUS_PRS_FILE", str(prs))
    agents = tmp_path / "agents.json"
    agents.write_text("[]")
    monkeypatch.setenv("VEXTRUS_AGENTS_FILE", str(agents))
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake = bin_dir / "claude"
    fake.write_text(f"#!{sys.executable}\nimport sys\nprint('9.9.9 (Claude Code)')\n")
    fake.chmod(0o755)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")

    origin = tmp_path / "origin.git"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(origin))
    main = tmp_path / "main"
    git(tmp_path, "init", "-q", "-b", "main", str(main))
    git(main, "remote", "add", "origin", str(origin))
    prompt = tmp_path / "prompt.md"
    prompt.write_text("Build ticket x1.\n")
    made = World(tmp_path, origin, main, prompt)
    made.commit("chore: the first commit")
    git(main, "push", "-q", "-u", "origin", "main")
    made.push_branch(BRANCH, acceptance=True)
    monkeypatch.chdir(main)
    return made


def launches(world: World) -> Path:
    return world.tmp / "factory" / "launches"


def cloud_launch(world: World, capsys: pytest.CaptureFixture[str], claude: FakeClaude) -> Run:
    from scripts.factory.launch import launch_cloud, parse_cloud

    argv = [
        "--branch",
        BRANCH,
        "--prompt-file",
        str(world.prompt),
        "--ticket",
        TICKET,
        "--effort",
        "medium",
        "--record-dir",
        str(launches(world)),
    ]
    outcome = launch_cloud(
        parse_cloud(argv),
        root=world.main,
        claude=claude,
        scan=clean_scan,
        govern=ok_govern,
        snapshot=lambda: "[]",
        now=lambda: CLOUD_NOW,
    )
    printed = capsys.readouterr()
    lines = printed.out.splitlines()
    if not lines or lines[0] != outcome.line:
        lines = [outcome.line, *lines]
    return Run(outcome.exit_code, lines, printed.err)


def test_a_second_cloud_builder_on_a_ticket_with_a_live_cloud_builder_is_refused(
    cloud: World, capsys: pytest.CaptureFixture[str]
) -> None:
    put(
        launches(cloud),
        builder_record(
            TICKET, BRANCH, where="cloud", started_at="2026-10-04T21:00:00Z", session_id=LIVE_CLOUD
        ),
    )
    claude = FakeClaude()
    done = cloud_launch(cloud, capsys, claude)
    assert done.code == 2, f"a second builder was not refused: {done.out}"
    assert done.lines[0].startswith("REFUSED "), done.out
    assert LIVE_CLOUD in done.lines[0], done.out
    assert claude.calls == [], "a second builder was launched"


def test_a_cloud_builder_on_a_ticket_with_a_live_local_builder_is_refused(
    cloud: World, capsys: pytest.CaptureFixture[str]
) -> None:
    put(
        launches(cloud),
        builder_record(
            TICKET,
            BRANCH,
            where="local",
            started_at="2026-10-04T21:00:00Z",
            session_id=LIVE_LOCAL_ID,
            name=f"{TICKET}-builder",
        ),
    )
    row = {
        "id": "ae575c11",
        "cwd": "/nowhere",
        "kind": "background",
        "startedAt": "2026-10-04T21:00:00Z",
        "sessionId": LIVE_LOCAL_ID,
        "name": f"{TICKET}-builder",
        "state": "working",
        "pid": os.getpid(),
    }
    Path(os.environ["VEXTRUS_AGENTS_FILE"]).write_text(json.dumps([row]))
    claude = FakeClaude()
    done = cloud_launch(cloud, capsys, claude)
    assert done.code == 2, f"a second builder was not refused: {done.out}"
    assert done.lines[0].startswith("REFUSED "), done.out
    assert LIVE_LOCAL_ID in done.lines[0] or f"{TICKET}-builder" in done.lines[0], done.out
    assert claude.calls == [], "a second builder was launched"


def test_an_acceptance_writers_record_does_not_block_the_tickets_cloud_builder(
    cloud: World, capsys: pytest.CaptureFixture[str]
) -> None:
    put(
        launches(cloud),
        builder_record(
            TICKET,
            BRANCH,
            where="cloud",
            started_at="2026-10-04T21:00:00Z",
            session_id="session_01Writer",
            role="acceptance-writer",
        ),
    )
    claude = FakeClaude()
    done = cloud_launch(cloud, capsys, claude)
    assert done.code == 0, done.out
    assert len(claude.calls) == 1


# --- local ------------------------------------------------------------------------------------------


@pytest.fixture
def local(tmp_path: Path) -> Launcher:
    made = Launcher(tmp_path)
    (tmp_path / "prs.json").write_text("[]")
    return made


def local_launch(
    world: Launcher, ticket: str, branch: str, name: str
) -> subprocess.CompletedProcess[str]:
    env = world.env()
    env["VEXTRUS_PRS_FILE"] = str(world.tmp / "prs.json")
    env.pop("CLAUDE_CONFIG_DIR", None)
    argv = ["--ticket", ticket, "--branch", branch, "--effort", "high", "--name", name]
    argv += ["--prompt-file", str(world.prompt)]
    return subprocess.run(
        [sys.executable, "-m", "scripts.factory.launch", "local", *argv],
        cwd=world.main,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=300,
        check=False,
    )


def live_row(
    name: str, session: str, *, pid: int | None = 777, state: str = "working"
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": "ae575c11",
        "cwd": "/nowhere",
        "kind": "background",
        "startedAt": "2026-10-04T20:00:00Z",
        "sessionId": session,
        "name": name,
        "state": state,
    }
    if pid is not None:
        row["pid"] = pid
    return row


def test_a_second_local_builder_under_another_name_on_a_ticket_with_a_live_one_is_refused(
    local: Launcher,
) -> None:
    put(
        local.factory / "launches",
        builder_record(
            "t901",
            "f-ok",
            where="local",
            started_at="2026-10-04T20:00:00Z",
            session_id=LIVE_LOCAL_ID,
            name="t901-builder",
        ),
    )
    local.seams["agents"].write_text(json.dumps([live_row("t901-builder", LIVE_LOCAL_ID)]))
    done = local_launch(local, "t901", "f-ok", "t901-again")
    assert done.returncode == 2, f"a second builder was not refused: {show(done)}"
    assert first_line(done).startswith("REFUSED "), show(done)
    assert not first_line(done).startswith("REFUSED duplicate-name"), show(done)
    assert LIVE_LOCAL_ID in first_line(done) or "t901-builder" in first_line(done), show(done)
    assert local.bg_calls() == [], "a second builder was launched"
    assert not local.worktree("t901").exists()


def test_a_local_builder_on_a_ticket_with_a_live_cloud_builder_is_refused(local: Launcher) -> None:
    put(
        local.factory / "launches",
        builder_record(
            "t901", "f-ok", where="cloud", started_at="2026-10-04T20:30:00Z", session_id=LIVE_CLOUD
        ),
    )
    done = local_launch(local, "t901", "f-ok", "t901-builder")
    assert done.returncode == 2, f"a second builder was not refused: {show(done)}"
    assert first_line(done).startswith("REFUSED "), show(done)
    assert LIVE_CLOUD in first_line(done), show(done)
    assert local.bg_calls() == [], "a second builder was launched"
    assert not local.worktree("t901").exists()


def test_a_local_builder_whose_earlier_session_has_ended_may_be_launched_again(local: Launcher) -> None:
    put(
        local.factory / "launches",
        builder_record(
            "t901",
            "f-ok",
            where="local",
            started_at="2026-10-04T20:00:00Z",
            session_id=LIVE_LOCAL_ID,
            name="t901-builder",
        ),
    )
    ended = live_row("t901-builder", LIVE_LOCAL_ID, pid=None, state="failed")
    local.seams["agents"].write_text(json.dumps([ended]))
    done = local_launch(local, "t901", "f-ok", "t901-again")
    assert done.returncode == 0, show(done)
    assert first_line(done).startswith("OK launched t901-again "), show(done)
